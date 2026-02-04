import 'dotenv/config';
import { prisma } from './lib/prisma';

async function fixApprovedUsers() {
  console.log('🔧 Mencari user yang sudah approved tapi email belum terverifikasi...\n');

  // Find users yang sudah approved tapi email belum verified
  const affectedUsers = await prisma.user.findMany({
    where: {
      isApproved: true,
      emailVerified: false,
    },
  });

  if (affectedUsers.length === 0) {
    console.log('✅ Tidak ada user yang perlu diperbaiki.');
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 Ditemukan ${affectedUsers.length} user yang perlu diperbaiki:\n`);
  
  affectedUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name} (${user.email})`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Email Verified: ❌`);
    console.log(`   - Is Approved: ✅`);
    console.log('');
  });

  // Ask for confirmation (or just proceed if run via script)
  console.log('🔄 Memverifikasi email untuk semua user yang sudah approved...\n');

  // Update all affected users
  const result = await prisma.user.updateMany({
    where: {
      isApproved: true,
      emailVerified: false,
    },
    data: {
      emailVerified: true,
      verificationToken: null, // Clear token
    },
  });

  console.log(`✅ Berhasil memperbaiki ${result.count} user!`);
  console.log('');
  console.log('User sekarang bisa login dengan email dan password mereka.');

  await prisma.$disconnect();
}

fixApprovedUsers().catch((error) => {
  console.error('❌ Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
