import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // Hash password untuk admin
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: 'Admin Akuntansi',
      role: 'admin',
    },
  });

  console.log('Admin user created:', { id: admin.id, username: admin.username, name: admin.name });

  // Seed prepaid data
  console.log('Seeding prepaid data...');
  
  // Prepaid 1: Prepaid Insurance
  const prepaid1 = await prisma.prepaid.create({
    data: {
      companyCode: '1000',
      kdAkr: '1401001',
      alokasi: 'PT Asuransi Central Asia',
      namaAkun: 'Prepaid Insurance',
      vendor: 'PT Asuransi Central Asia',
      deskripsi: 'Asuransi property dan equipment tahunan',
      klasifikasi: 'Insurance',
      totalAmount: 120000000,
      remaining: 120000000,
      costCenter: 'CC-001',
      startDate: new Date('2026-01-01'),
      period: 12,
      periodUnit: 'bulan',
      type: 'Linear',
      pembagianType: 'otomatis',
      periodes: {
        create: Array.from({ length: 12 }, (_, i) => {
          const date = new Date('2026-01-01');
          date.setMonth(date.getMonth() + i);
          return {
            periodeKe: i + 1,
            bulan: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
            tahun: date.getFullYear(),
            amountPrepaid: 120000000 / 12,
            isAmortized: false
          };
        })
      }
    }
  });

  // Prepaid 2: Prepaid Rent
  const prepaid2 = await prisma.prepaid.create({
    data: {
      companyCode: '1000',
      kdAkr: '1401002',
      alokasi: 'PT Asta Adi Nusantara',
      namaAkun: 'Prepaid Rent',
      vendor: 'PT Asta Adi Nusantara',
      deskripsi: 'Sewa kantor 6 bulan',
      klasifikasi: 'Rent',
      totalAmount: 60000000,
      remaining: 60000000,
      costCenter: 'CC-002',
      startDate: new Date('2026-01-01'),
      period: 6,
      periodUnit: 'bulan',
      type: 'Linear',
      pembagianType: 'otomatis',
      periodes: {
        create: Array.from({ length: 6 }, (_, i) => {
          const date = new Date('2026-01-01');
          date.setMonth(date.getMonth() + i);
          return {
            periodeKe: i + 1,
            bulan: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
            tahun: date.getFullYear(),
            amountPrepaid: 60000000 / 6,
            isAmortized: false
          };
        })
      }
    }
  });

  // Prepaid 3: Prepaid Service Contract
  const prepaid3 = await prisma.prepaid.create({
    data: {
      companyCode: '1000',
      kdAkr: '1401003',
      alokasi: 'PT Mahindra Indo Pro',
      namaAkun: 'Prepaid Service Contract',
      vendor: 'PT Mahindra Indo Pro',
      deskripsi: 'Kontrak maintenance mesin tahunan',
      klasifikasi: 'Service',
      totalAmount: 180000000,
      remaining: 180000000,
      costCenter: 'CC-003',
      startDate: new Date('2026-01-01'),
      period: 12,
      periodUnit: 'bulan',
      type: 'Verbal',
      pembagianType: 'otomatis',
      periodes: {
        create: Array.from({ length: 12 }, (_, i) => {
          const date = new Date('2026-01-01');
          date.setMonth(date.getMonth() + i);
          return {
            periodeKe: i + 1,
            bulan: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
            tahun: date.getFullYear(),
            amountPrepaid: 180000000 / 12,
            isAmortized: false
          };
        })
      }
    }
  });

  console.log('Prepaid data seeded:', { 
    prepaid1: prepaid1.id, 
    prepaid2: prepaid2.id,
    prepaid3: prepaid3.id 
  });

  // Skip seeding accrual data - let user input manually
  console.log('Skipping accrual data seed - table will be empty for manual input');

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
