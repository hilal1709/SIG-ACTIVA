import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating admin user...');

  const admin = await prisma.user.update({
    where: { email: 'admin@semenindonesia.com' },
    data: {
      emailVerified: true,
      isApproved: true,
      verificationToken: null,
    },
  });

  console.log('✅ Admin user updated:', {
    email: admin.email,
    emailVerified: admin.emailVerified,
    isApproved: admin.isApproved,
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
