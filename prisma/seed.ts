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

  // Hash password untuk admin sistem
  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);

  // Create Admin System user
  const adminSystem = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      email: 'admin@semenindonesia.com',
      role: 'ADMIN_SYSTEM',
    },
    create: {
      username: 'admin',
      email: 'admin@semenindonesia.com',
      password: hashedPasswordAdmin,
      name: 'Administrator Sistem',
      role: 'ADMIN_SYSTEM',
    },
  });

  console.log('Admin System user created:', { 
    id: adminSystem.id, 
    username: adminSystem.username, 
    name: adminSystem.name,
    role: adminSystem.role 
  });

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
