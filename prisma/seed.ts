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

  // Clear existing prepaid data
  console.log('Clearing existing prepaid data...');
  await prisma.prepaidPeriode.deleteMany({});
  await prisma.prepaid.deleteMany({});
  console.log('Prepaid data cleared');

  // Skip seeding prepaid data - let user input manually
  console.log('Skipping prepaid data seed - table will be empty for manual input');

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
