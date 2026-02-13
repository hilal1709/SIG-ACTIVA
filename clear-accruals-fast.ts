import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Menghapus semua data accrual (FAST MODE)...');
  const startTime = Date.now();
  
  try {
    // Disable foreign key constraints untuk mempercepat
    await prisma.$executeRaw`SET session_replication_role = replica;`;
    
    // Hapus data dengan batch untuk menghindari memory issues
    console.log('Menghapus AccrualRealisasi...');
    await prisma.$executeRaw`TRUNCATE TABLE "AccrualRealisasi" RESTART IDENTITY CASCADE;`;
    
    console.log('Menghapus AccrualPeriode...');
    await prisma.$executeRaw`TRUNCATE TABLE "AccrualPeriode" RESTART IDENTITY CASCADE;`;
    
    console.log('Menghapus Accrual...');
    await prisma.$executeRaw`TRUNCATE TABLE "Accrual" RESTART IDENTITY CASCADE;`;
    
    // Enable kembali foreign key constraints
    await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Semua data accrual berhasil dihapus dalam ${duration} detik`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    // Ensure constraints are re-enabled even if error occurs
    await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
    throw error;
  }
  
  await pool.end();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
