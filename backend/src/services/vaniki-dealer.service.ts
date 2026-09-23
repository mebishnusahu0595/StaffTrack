import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { AuthUser } from "../types/auth";

const VANIKI_API_BASE = process.env.VANIKI_API_BASE || "https://vanikicrop.com/api/staff/dealers";
const VANIKI_API_KEY = process.env.VANIKI_API_KEY || "vaniki_stafftrack_key_2026";

async function vanikiFetch(path: string, options: RequestInit = {}) {
  const url = `${VANIKI_API_BASE}${path}`;
  const headers: Record<string, string> = {
    "x-api-key": VANIKI_API_KEY,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Vaniki API returned ${res.status}`;
    throw new AppError(res.status, errorMsg);
  }

  return data?.data || data;
}

let tableInitialized = false;

/**
 * Ensure PostgreSQL vaniki_dealer_activities table & indexes exist
 */
export async function initVanikiTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS vaniki_dealer_activities (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        user_id TEXT,
        staff_name TEXT NOT NULL,
        staff_phone TEXT,
        staff_email TEXT,
        action TEXT NOT NULL,
        dealer_code TEXT,
        four_digit_id TEXT,
        dealer_name TEXT NOT NULL,
        store_name TEXT,
        dealer_phone TEXT,
        dealer_city TEXT,
        order_id TEXT,
        invoice_number TEXT,
        total_amount DOUBLE PRECISION DEFAULT 0,
        paid_amount DOUBLE PRECISION DEFAULT 0,
        outstanding_amount DOUBLE PRECISION DEFAULT 0,
        petis INTEGER DEFAULT 0,
        items_count INTEGER DEFAULT 0,
        payment_mode TEXT,
        proof_url TEXT,
        notes TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_vaniki_activities_created_at ON vaniki_dealer_activities(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vaniki_activities_action ON vaniki_dealer_activities(action);
      CREATE INDEX IF NOT EXISTS idx_vaniki_activities_user ON vaniki_dealer_activities(user_id);
    `);
    tableInitialized = true;
  } catch (err) {
    console.error("Failed to ensure vaniki_dealer_activities table:", err);
  }
}

export interface VanikiActivityInput {
  id?: string;
  companyId?: string;
  userId?: string;
  staffName: string;
  staffPhone?: string;
  staffEmail?: string;
  action: "DEALER_LOOKUP" | "ORDER_PLACED" | "CREDIT_PAYMENT" | "CREDIT_LIMIT_ADJUSTED";
  dealerCode?: string;
  fourDigitId?: string;
  dealerName: string;
  storeName?: string;
  dealerPhone?: string;
  dealerCity?: string;
  orderId?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  petis?: number;
  itemsCount?: number;
  paymentMode?: string;
  proofUrl?: string;
  notes?: string;
  metadata?: any;
  createdAt?: Date;
}

/**
 * Record a field staff activity (dealer code entry/lookup or wholesale order)
 */
export async function recordActivity(data: VanikiActivityInput): Promise<void> {
  await initVanikiTable();
  const id = data.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = data.createdAt || new Date();

  try {
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
      ) ON CONFLICT (id) DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        paid_amount = EXCLUDED.paid_amount,
        outstanding_amount = EXCLUDED.outstanding_amount,
        metadata = EXCLUDED.metadata`,
      id,
      data.companyId || null,
      data.userId || null,
      data.staffName,
      data.staffPhone || null,
      data.staffEmail || null,
      data.action,
      data.dealerCode || null,
      data.fourDigitId || null,
      data.dealerName,
      data.storeName || null,
      data.dealerPhone || null,
      data.dealerCity || null,
      data.orderId || null,
      data.invoiceNumber || null,
      data.totalAmount || 0,
      data.paidAmount || 0,
      data.outstandingAmount || 0,
      data.petis || 0,
      data.itemsCount || 0,
      data.paymentMode || null,
      data.proofUrl || null,
      data.notes || null,
      JSON.stringify(data.metadata || {}),
      createdAt
    );
  } catch (err) {
    console.error("Error saving vaniki activity:", err);
  }
}

/**
 * Lookup dealer by 4-digit ID or mobile number & record staff lookup activity
 */
export async function lookupDealer(codeOrMobile: string, actor?: AuthUser) {
  const trimmed = codeOrMobile.trim();
  if (!trimmed) {
    throw new AppError(400, "Dealer code or mobile number is required");
  }

  const result = await vanikiFetch(`/lookup/${encodeURIComponent(trimmed)}`, {
    method: "GET",
  });

  // Automatically record this staff lookup event
  if (result?.dealer) {
    const dealer = result.dealer;
    const credit = result.credit || {};
    const ledger = result.ledgerSummary || {};

    const fourDigit =
      dealer.fourDigitId ||
      dealer.shortCode ||
      (dealer.dealerCode ? dealer.dealerCode.replace(/\D/g, "").slice(-4) : "");

    recordActivity({
      companyId: actor?.companyId,
      userId: actor?.id,
      staffName: actor?.name || "Field Staff",
      staffPhone: (actor as any)?.phone || actor?.email || "",
      staffEmail: actor?.email || "",
      action: "DEALER_LOOKUP",
      dealerCode: dealer.dealerCode,
      fourDigitId: fourDigit,
      dealerName: dealer.cleanName || dealer.name || "Dealer",
      storeName: dealer.storeName || "",
      dealerPhone: dealer.mobile || "",
      dealerCity: dealer.address?.city || dealer.storeLocation || "",
      totalAmount: credit.creditLimit || 0,
      outstandingAmount: ledger.totalOutstanding || 0,
      metadata: {
        creditLimit: credit.creditLimit || 0,
        totalInvoiced: ledger.totalInvoiced || 0,
        totalPaid: ledger.totalPaid || 0,
        totalOutstanding: ledger.totalOutstanding || 0,
        unpaidInvoices: ledger.unpaidInvoiceCount || 0,
        address: dealer.address,
        gstNumber: dealer.gstNumber,
      },
    }).catch((err) => console.error("Failed to log lookup activity:", err));
  }

  return result;
}

/**
 * Fetch wholesale products catalog
 */
export async function getWholesaleProducts() {
  return vanikiFetch("/products", {
    method: "GET",
  });
}

/**
 * Fetch SuperAdmin configured dynamic bank details & UPI QR Code
 */
export async function getBankDetails() {
  return vanikiFetch("/bank-details", {
    method: "GET",
  });
}


/**
 * Fetch SuperAdmin configured real-time warehouses/garages list
 */
export async function getGarages() {
  try {
    return await vanikiFetch("/garages", {
      method: "GET",
    });
  } catch (err) {
    console.warn("Could not fetch garages from /garages endpoint, returning defaults:", err);
    return ["Vaniki garage", "Raipur Central Hub", "Bilaspur Depot"];
  }
}

/**
 * Place wholesale order for dealer with payment terms & notes
 */
export async function placeDealerOrder(
  dealerCode: string,
  payload: {
    garageName?: string;
    items: Array<{
      productId?: string;
      variantId?: string;
      productName: string;
      petiQuantity: number;
      petiSize: number;
      petiUnit?: string;
      packSize?: string;
      dealerPrice: number;
      mrp?: number;
      taxRate?: number;
      hsnCode?: string;
    }>;
    paymentMethod?: string;
    paymentMode?: string;
    paidAmount?: number;
    totalAmount?: number;
    paymentProofUrl?: string;
    screenshots?: string[];
    notes?: string;
    dealDescription?: string;
    utr?: string;
    documentUrl?: string;
    documentName?: string;
  },
  actor: AuthUser
) {

  const cleanCode = dealerCode.trim();
  if (!cleanCode) {
    throw new AppError(400, "Dealer code is required");
  }

  if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new AppError(400, "At least 1 product is required in the order");
  }

  const staffInfo = {
    staffId: actor.id,
    staffName: actor.name || "Field Staff",
    staffMobile: (actor as any).phone || actor.email || "",
  };

  const paymentMode = payload.paymentMode || payload.paymentMethod || "credit";
  const paidAmount = Number(payload.paidAmount || 0);
  const dealNotes = payload.dealDescription || payload.notes || "";
  const screenshots = payload.screenshots || (payload.paymentProofUrl ? [payload.paymentProofUrl] : []);

  const orderBody = {
    garageName: payload.garageName || undefined,
    items: payload.items,
    paymentMode,

    paymentMethod: paymentMode,
    payment: {
      mode: paymentMode,
      paidAmount,
      totalAmount: payload.totalAmount,
      utr: payload.utr || "",
      paymentProofScreenshots: screenshots,
    },
    paidAmount,
    totalAmount: payload.totalAmount,
    paymentProofUrl: payload.paymentProofUrl || screenshots[0] || "",
    screenshots,
    dealDescription: dealNotes,
    notes: dealNotes,
    staffInfo,
    staffId: actor.id,
    staffName: staffInfo.staffName,
    staffMobile: staffInfo.staffMobile,
  };

  const orderRes = await vanikiFetch(`/${encodeURIComponent(cleanCode)}/orders`, {
    method: "POST",
    body: JSON.stringify(orderBody),
    headers: {
      "x-staff-id": actor.id,
      "x-staff-name": staffInfo.staffName,
      "x-staff-phone": staffInfo.staffMobile,
    },
  });

  // Calculate petis
  const totalPetis = (payload.items || []).reduce(
    (sum: number, it: any) => sum + Number(it.petiQuantity || it.qty || 1),
    0
  );

  const orderData = orderRes?.data || orderRes;
  const dealerObj = orderData?.dealer || {};
  const fourDigit =
    dealerObj.fourDigitId ||
    (dealerObj.dealerCode ? dealerObj.dealerCode.replace(/\D/g, "").slice(-4) : cleanCode.replace(/\D/g, "").slice(-4));

  // Automatically record this staff order placed activity
  recordActivity({
    companyId: actor.companyId,
    userId: actor.id,
    staffName: actor.name || "Field Staff",
    staffPhone: (actor as any).phone || actor.email || "",
    staffEmail: actor.email || "",
    action: "ORDER_PLACED",
    dealerCode: dealerObj.dealerCode || cleanCode,
    fourDigitId: fourDigit,
    dealerName: dealerObj.cleanName || dealerObj.name || "Dealer",
    storeName: dealerObj.storeName || "",
    dealerPhone: dealerObj.mobile || "",
    orderId: orderData?.orderId || "",
    invoiceNumber: orderData?.invoiceNumber || "",
    totalAmount: Number(orderData?.totalAmount ?? payload.totalAmount ?? 0),
    paidAmount: Number(orderData?.paidAmount ?? paidAmount),
    outstandingAmount: Number(orderData?.outstandingAmount ?? Math.max(0, (payload.totalAmount || 0) - paidAmount)),
    petis: totalPetis,
    itemsCount: (payload.items || []).length,
    paymentMode,
    proofUrl: payload.paymentProofUrl || payload.documentUrl || screenshots[0] || "",
    notes: dealNotes,
    metadata: {
      garageName: payload.garageName || null,
      items: orderData?.items || payload.items,

      invoiceNumber: orderData?.invoiceNumber,
      orderId: orderData?.orderId,
      utr: payload.utr,
      paymentStatus: orderData?.paymentStatus,
      placedAt: orderData?.placedAt || new Date().toISOString(),
      documentUrl: payload.documentUrl || null,
      documentName: payload.documentName || null,
    },
  }).catch((err) => console.error("Failed to log order activity:", err));

  return orderRes;
}

export interface CreditTransactionInput {
  dealerCode: string;
  type: "PAYMENT" | "LIMIT_ADJUST";
  amount?: number;
  newLimit?: number;
  paymentMode?: "neft" | "upi";
  utr?: string;
  proofUrl?: string;
  notes?: string;
}

/**
 * Record payment of credit due (NEFT / UPI) or adjustment of dealer credit limit
 */
export async function adjustCreditOrRecordPayment(actor: AuthUser, payload: CreditTransactionInput) {
  await initVanikiTable();
  const cleanCode = (payload.dealerCode || "").trim();
  if (!cleanCode) {
    throw new AppError(400, "Dealer code is required");
  }

  // Look up existing dealer details from Vaniki
  let dealerInfo: any = {};
  let currentOutstanding = 0;
  let currentLimit = 0;
  try {
    const res = await vanikiFetch(`/lookup/${encodeURIComponent(cleanCode)}`, { method: "GET" });
    if (res?.dealer) {
      dealerInfo = res.dealer;
      currentOutstanding = Number(res?.ledgerSummary?.totalOutstanding || 0);
      currentLimit = Number(res?.credit?.creditLimit || 50000);
    }
  } catch (err) {
    console.warn("Could not fetch remote dealer during credit transaction:", err);
  }

  const staffName = actor.name || "Field Staff";
  const staffPhone = (actor as any).phone || actor.email || "";
  const fourDigit = dealerInfo.fourDigitId || dealerInfo.shortCode || cleanCode.replace(/\D/g, "").slice(-4);
  const dealerName = dealerInfo.cleanName || dealerInfo.name || "Dealer";
  const storeName = dealerInfo.storeName || "";
  const dealerPhone = dealerInfo.mobile || "";
  const dealerCity = dealerInfo.address?.city || dealerInfo.storeLocation || "";

  if (payload.type === "PAYMENT") {
    const payAmount = Number(payload.amount || 0);
    if (payAmount <= 0) {
      throw new AppError(400, "Payment amount must be greater than zero");
    }
    const newOutstanding = Math.max(0, currentOutstanding - payAmount);
    const paymentMode = payload.paymentMode === "neft" ? "NEFT" : "UPI";

    try {
      await vanikiFetch(`/${encodeURIComponent(cleanCode)}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: payAmount,
          paymentMode,
          utr: payload.utr || "",
          proofUrl: payload.proofUrl || "",
          notes: payload.notes || "",
          staffId: actor.id,
          staffName,
          staffPhone
        })
      });
    } catch (apiErr) {
      console.warn("Vaniki remote payment API notification note:", apiErr);
    }

    const activityId = `act_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await recordActivity({
      id: activityId,
      companyId: actor.companyId,
      userId: actor.id,
      staffName,
      staffPhone,
      staffEmail: actor.email || "",
      action: "CREDIT_PAYMENT",
      dealerCode: cleanCode,
      fourDigitId: fourDigit,
      dealerName,
      storeName,
      dealerPhone,
      dealerCity,
      paidAmount: payAmount,
      outstandingAmount: newOutstanding,
      paymentMode,
      proofUrl: payload.proofUrl || "",
      notes: payload.notes || `Credit due payment received via ${paymentMode}`,
      metadata: {
        type: "CREDIT_PAYMENT",
        paymentMode,
        utr: payload.utr || "",
        previousOutstanding: currentOutstanding,
        newOutstanding,
        paidAmount: payAmount,
        staffName,
        staffPhone,
        paidAt: new Date().toISOString()
      }
    });

    return {
      success: true,
      action: "CREDIT_PAYMENT",
      paidAmount: payAmount,
      newOutstanding,
      paymentMode,
      utr: payload.utr,
      proofUrl: payload.proofUrl,
      staffName
    };
  } else {
    // LIMIT_ADJUST
    const newLimit = Number(payload.newLimit || 0);
    if (newLimit < 0) {
      throw new AppError(400, "Credit limit cannot be negative");
    }

    try {
      await vanikiFetch(`/${encodeURIComponent(cleanCode)}/credit-limit`, {
        method: "POST",
        body: JSON.stringify({
          creditLimit: newLimit,
          reason: payload.notes || "",
          staffId: actor.id,
          staffName
        })
      });
    } catch (apiErr) {
      console.warn("Vaniki remote credit limit API notification note:", apiErr);
    }

    const activityId = `act_lim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await recordActivity({
      id: activityId,
      companyId: actor.companyId,
      userId: actor.id,
      staffName,
      staffPhone,
      staffEmail: actor.email || "",
      action: "CREDIT_LIMIT_ADJUSTED",
      dealerCode: cleanCode,
      fourDigitId: fourDigit,
      dealerName,
      storeName,
      dealerPhone,
      dealerCity,
      totalAmount: newLimit,
      outstandingAmount: currentOutstanding,
      notes: payload.notes || `Credit limit updated to ₹${newLimit}`,
      metadata: {
        type: "CREDIT_LIMIT_ADJUSTED",
        previousLimit: currentLimit,
        newLimit,
        reason: payload.notes || "",
        staffName,
        staffPhone,
        updatedAt: new Date().toISOString()
      }
    });

    return {
      success: true,
      action: "CREDIT_LIMIT_ADJUSTED",
      previousLimit: currentLimit,
      newLimit,
      staffName
    };
  }
}

/**
 * Fetch all staff dealer activities with filtering, pagination and summary KPIs
 */

export async function getVanikiActivities(params: {
  action?: string;
  search?: string;
  staffId?: string;
  limit?: number;
  offset?: number;
}) {
  await initVanikiTable();

  const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
  const offset = Math.max(0, Number(params.offset) || 0);

  const conditions: string[] = ["1=1"];
  const values: any[] = [];
  let paramIdx = 1;

  if (params.action && params.action !== "ALL") {
    conditions.push(`action = $${paramIdx++}`);
    values.push(params.action);
  }

  if (params.staffId && params.staffId !== "ALL") {
    conditions.push(`user_id = $${paramIdx++}`);
    values.push(params.staffId);
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(`(
      staff_name ILIKE $${paramIdx} OR
      dealer_name ILIKE $${paramIdx} OR
      store_name ILIKE $${paramIdx} OR
      four_digit_id ILIKE $${paramIdx} OR
      dealer_code ILIKE $${paramIdx} OR
      invoice_number ILIKE $${paramIdx} OR
      notes ILIKE $${paramIdx}
    )`);
    values.push(term);
    paramIdx++;
  }

  const whereClause = conditions.join(" AND ");

  const selectQuery = `
    SELECT 
      id, company_id, user_id, staff_name, staff_phone, staff_email,
      action, dealer_code, four_digit_id, dealer_name, store_name, dealer_phone, dealer_city,
      order_id, invoice_number, total_amount, paid_amount, outstanding_amount,
      petis, items_count, payment_mode, proof_url, notes, metadata,
      created_at
    FROM vaniki_dealer_activities
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const rows = await prisma.$queryRawUnsafe<any[]>(selectQuery, ...values, limit, offset);

  // Overall & Today KPI Stats
  const statsQuery = `
    SELECT
      COUNT(*) FILTER (WHERE action = 'ORDER_PLACED')::int AS total_orders,
      COALESCE(SUM(total_amount) FILTER (WHERE action = 'ORDER_PLACED'), 0)::float AS total_order_value,
      COALESCE(SUM(paid_amount) FILTER (WHERE action = 'ORDER_PLACED'), 0)::float AS total_paid,
      COALESCE(SUM(outstanding_amount) FILTER (WHERE action = 'ORDER_PLACED'), 0)::float AS total_outstanding,
      COUNT(*) FILTER (WHERE action = 'DEALER_LOOKUP')::int AS total_lookups,
      COUNT(DISTINCT staff_name)::int AS active_staff_count,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today_activities_count
    FROM vaniki_dealer_activities
  `;

  const statsRes = await prisma.$queryRawUnsafe<any[]>(statsQuery);
  const statsRow = statsRes[0] || {};

  const totalCountRes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS count FROM vaniki_dealer_activities WHERE ${whereClause}`,
    ...values
  );
  const total = totalCountRes[0]?.count || 0;

  const activities = rows.map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    userId: r.user_id,
    staffName: r.staff_name,
    staffPhone: r.staff_phone,
    staffEmail: r.staff_email,
    action: r.action,
    dealerCode: r.dealer_code,
    fourDigitId: r.four_digit_id,
    dealerName: r.dealer_name,
    storeName: r.store_name,
    dealerPhone: r.dealer_phone,
    dealerCity: r.dealer_city,
    orderId: r.order_id,
    invoiceNumber: r.invoice_number,
    totalAmount: Number(r.total_amount || 0),
    paidAmount: Number(r.paid_amount || 0),
    outstandingAmount: Number(r.outstanding_amount || 0),
    petis: Number(r.petis || 0),
    itemsCount: Number(r.items_count || 0),
    paymentMode: r.payment_mode,
    proofUrl: r.proof_url,
    notes: r.notes,
    metadata: r.metadata,
    createdAt: r.created_at,
  }));

  return {
    activities,
    total,
    stats: {
      totalOrders: Number(statsRow.total_orders || 0),
      totalOrderValue: Math.round(Number(statsRow.total_order_value || 0)),
      totalPaid: Math.round(Number(statsRow.total_paid || 0)),
      totalOutstanding: Math.round(Number(statsRow.total_outstanding || 0)),
      totalLookups: Number(statsRow.total_lookups || 0),
      activeStaffCount: Number(statsRow.active_staff_count || 0),
      todayActivitiesCount: Number(statsRow.today_activities_count || 0),
    },
  };
}
