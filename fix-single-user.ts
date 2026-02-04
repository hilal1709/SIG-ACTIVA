import 'dotenv/config';
import { prisma } from './lib/prisma';

async function fixUser() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('Usage: npx tsx fix-single-user.ts <email>');
    console.log('Example: npx tsx fix-single-user.ts user@example.com');
    process.exit(1);
  }

  console.log(`🔧 Memperbaiki user: ${email}\n`);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('❌ User tidak ditemukan!');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('📊 Status SEBELUM diperbaiki:');
  console.log('   Email Verified:', user.emailVerified ? '✅' : '❌');
  console.log('   Is Approved:', user.isApproved ? '✅' : '❌');
  console.log('   Can Login:', (user.emailVerified && user.isApproved) ? '✅' : '❌');
  console.log('');

  // Update user
  const updated = await prisma.user.update({
    where: { email },
    data: {
      emailVerified: true,
      isApproved: true,
      verificationToken: null,
    },
  });

  console.log('✅ User berhasil diperbaiki!\n');
  console.log('📊 Status SETELAH diperbaiki:');
  console.log('   Email Verified:', updated.emailVerified ? '✅' : '❌');
  console.log('   Is Approved:', updated.isApproved ? '✅' : '❌');
  console.log('   Can Login:', (updated.emailVerified && updated.isApproved) ? '✅' : '❌');
  console.log('');
  console.log('🎉 User sekarang bisa login!');

  await prisma.$disconnect();
}

fixUser().catch((error) => {
  console.error('❌ Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
