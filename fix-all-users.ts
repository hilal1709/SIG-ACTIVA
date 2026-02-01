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
  console.log('🔧 Auto-verifying approved users...\n');

  // Update all approved users to also be email verified
  const result = await prisma.user.updateMany({
    where: {
      isApproved: true,
      emailVerified: false,
    },
    data: {
      emailVerified: true,
      verificationToken: null,
    },
  });

  console.log(`✅ Updated ${result.count} users to emailVerified: true\n`);

  // Show all users
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

  console.log('📋 All users:');
  users.forEach(user => {
    const status = user.emailVerified && user.isApproved ? '✅ CAN LOGIN' : '❌ CANNOT LOGIN';
    console.log(`  ${status} | ${user.email} | ${user.role}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
