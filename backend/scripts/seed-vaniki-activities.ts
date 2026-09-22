import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const mongoScript = `
const list = [];
db.b2binvoices.find().forEach(inv => {
  const store = db.stores.findOne({ _id: inv.storeId });
  const user = store ? db.users.findOne({ $or: [{ selectedStore: store._id }, { _id: store.adminId }] }) : null;
  list.push({
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount || 0,
    outstandingAmount: inv.outstandingAmount !== undefined ? inv.outstandingAmount : (inv.totalAmount - (inv.paidAmount || 0)),
    paymentStatus: inv.paymentStatus,
    paymentTerms: inv.paymentTerms || "Credit (Udhaar)",
    items: inv.items || [],
    storeName: store ? store.name : "",
    dealerName: user ? user.name : (store ? store.name : "Vaniki Dealer"),
    dealerMobile: user ? user.mobile : (store ? store.phone : ""),
    dealerCode: user ? user.dealerCode : "",
    shortCode: user ? user.shortCode : ""
  });
});
print(JSON.stringify(list));
`;

  let mongoJson = "";
  try {
    mongoJson = execSync(`mongosh vaniki-crop --quiet --eval '${mongoScript.replace(/'/g, "'\\''")}'`, { encoding: "utf8" }).trim();
  } catch (err) {
    console.error("Mongo query error:", err);
    return;
  }

  const invoices = JSON.parse(mongoJson);
  console.log("Fetched", invoices.length, "invoices from MongoDB");

  for (const inv of invoices) {
    const num = inv.invoiceNumber;
    let fourDigit = inv.shortCode || "";
    let cleanName = inv.dealerName || "Dealer";
    if (cleanName.includes("[") && cleanName.includes("]")) {
      const match = cleanName.match(/\[(\d+)\]\s*(.*)/);
      if (match) {
        fourDigit = match[1];
        cleanName = match[2].trim();
      }
    }

    const totalPetis = inv.items.reduce((s: number, it: any) => s + (it.petiQty || it.qty || 1), 0);

    await prisma.$executeRawUnsafe(
      `INSERT INTO vaniki_dealer_activities (
        id, company_id, user_id, staff_name, staff_phone, staff_email,
        action, dealer_code, four_digit_id, dealer_name, store_name, dealer_phone, dealer_city,
        order_id, invoice_number, total_amount, paid_amount, outstanding_amount,
        petis, items_count, payment_mode, proof_url, notes, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24::jsonb, $25
      ) ON CONFLICT (id) DO NOTHING`,
      `b2b_${num}`,
      "demo-corp-company",
      "cmpgk7wmp0001fiajm403d5f4",
      "Bishnu Prasad Sahu",
      "9301105706",
      "mebishnusahu0595@gmail.com",
      "ORDER_PLACED",
      inv.dealerCode || `VKD${fourDigit}`,
      fourDigit,
      cleanName,
      inv.storeName,
      inv.dealerMobile,
      "Chhattisgarh",
      num,
      num,
      inv.totalAmount,
      inv.paidAmount,
      inv.outstandingAmount,
      totalPetis,
      inv.items.length,
      inv.paymentTerms,
      null,
      `Wholesale B2B Order ${num} placed for ${inv.storeName}`,
      JSON.stringify({ items: inv.items, paymentStatus: inv.paymentStatus }),
      new Date(inv.invoiceDate)
    );
  }

  const count = await prisma.$queryRawUnsafe<any[]>("SELECT COUNT(*)::int as cnt FROM vaniki_dealer_activities");
  console.log("Seeded! Total count in vaniki_dealer_activities:", count[0]?.cnt);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
