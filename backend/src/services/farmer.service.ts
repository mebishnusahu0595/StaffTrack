import { prisma } from "../lib/prisma";

let farmerTableInitialized = false;

/**
 * Ensure PostgreSQL farmers table & indexes exist
 */
export async function initFarmersTable(): Promise<void> {
  if (farmerTableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS farmers (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        village TEXT,
        address TEXT,
        city TEXT,
        district TEXT,
        state TEXT,
        crop TEXT,
        land_size TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_farmers_company ON farmers(company_id)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_farmers_name ON farmers(name)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE farmers ADD COLUMN IF NOT EXISTS assigned_user_id TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE farmers ADD COLUMN IF NOT EXISTS assigned_user_name TEXT`);
    farmerTableInitialized = true;
  } catch (err) {
    console.error("Failed to ensure farmers table:", err);
  }
}

export interface FarmerInput {
  name: string;
  phone?: string;
  village?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  crop?: string;
  landSize?: string;
  notes?: string;
  assignedUserId?: string;
  assignedUserName?: string;
}

export async function listFarmers(companyId: string) {
  await initFarmersTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM farmers WHERE company_id = $1 ORDER BY created_at DESC`,
    companyId
  );
  return rows.map(mapFarmerRow);
}

export async function getFarmer(companyId: string, id: string) {
  await initFarmersTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM farmers WHERE id = $1 AND company_id = $2`,
    id, companyId
  );
  if (!rows.length) throw new Error("Farmer not found");
  return mapFarmerRow(rows[0]);
}

export async function createFarmer(companyId: string, input: FarmerInput) {
  await initFarmersTable();
  const id = `farmer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();

  await prisma.$executeRawUnsafe(
    `INSERT INTO farmers (id, company_id, name, phone, village, address, city, district, state, crop, land_size, notes, assigned_user_id, assigned_user_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    id, companyId,
    input.name,
    input.phone || null,
    input.village || null,
    input.address || null,
    input.city || null,
    input.district || null,
    input.state || null,
    input.crop || null,
    input.landSize || null,
    input.notes || null,
    input.assignedUserId || null,
    input.assignedUserName || null,
    now, now
  );

  return { id, companyId, ...input, createdAt: now, updatedAt: now };
}

export async function updateFarmer(companyId: string, id: string, input: Partial<FarmerInput>) {
  await initFarmersTable();
  const now = new Date();

  await prisma.$executeRawUnsafe(
    `UPDATE farmers SET
      name = COALESCE($3, name),
      phone = COALESCE($4, phone),
      village = COALESCE($5, village),
      address = COALESCE($6, address),
      city = COALESCE($7, city),
      district = COALESCE($8, district),
      state = COALESCE($9, state),
      crop = COALESCE($10, crop),
      land_size = COALESCE($11, land_size),
      notes = COALESCE($12, notes),
      assigned_user_id = CASE WHEN $13::text IS NOT NULL THEN $13 ELSE assigned_user_id END,
      assigned_user_name = CASE WHEN $14::text IS NOT NULL THEN $14 ELSE assigned_user_name END,
      updated_at = $15
    WHERE id = $1 AND company_id = $2`,
    id, companyId,
    input.name || null,
    input.phone || null,
    input.village || null,
    input.address || null,
    input.city || null,
    input.district || null,
    input.state || null,
    input.crop || null,
    input.landSize || null,
    input.notes || null,
    input.assignedUserId !== undefined ? input.assignedUserId : null,
    input.assignedUserName !== undefined ? input.assignedUserName : null,
    now
  );

  return getFarmer(companyId, id);
}

export async function deleteFarmer(companyId: string, id: string) {
  await initFarmersTable();
  await prisma.$executeRawUnsafe(
    `DELETE FROM farmers WHERE id = $1 AND company_id = $2`,
    id, companyId
  );
}

function mapFarmerRow(r: any) {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    phone: r.phone,
    village: r.village,
    address: r.address,
    city: r.city,
    district: r.district,
    state: r.state,
    crop: r.crop,
    landSize: r.land_size,
    notes: r.notes,
    assignedUserId: r.assigned_user_id,
    assignedUserName: r.assigned_user_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
