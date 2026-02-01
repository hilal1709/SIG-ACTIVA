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
  console.log('🔧 Setting up production database...\n');

  // Hash password untuk admin sistem
  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);

  // Create or update Admin System user
  const adminSystem = await prisma.user.upsert({
    where: { email: 'admin@semenindonesia.com' },
    update: {
      emailVerified: true,
      isApproved: true,
      verificationToken: null,
    },
    create: {
      username: 'admin',
      email: 'admin@semenindonesia.com',
      password: hashedPasswordAdmin,
      name: 'Administrator Sistem',
      role: 'ADMIN_SYSTEM',
      emailVerified: true,
      isApproved: true,
    },
  });

  console.log('✅ Admin user setup:', {
    email: adminSystem.email,
    emailVerified: adminSystem.emailVerified,
    isApproved: adminSystem.isApproved,
  });

  // Check existing users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      isApproved: true,
    },
  });

  console.log('\n📋 All users in production database:');
  users.forEach(user => {
    console.log(`  - ${user.email} | Verified: ${user.emailVerified} | Approved: ${user.isApproved} | Role: ${user.role}`);
  });

  console.log('\n✅ Production database ready!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
