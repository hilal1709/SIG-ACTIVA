import 'dotenv/config';
import { prisma } from './lib/prisma';

async function listUsers() {
  console.log('📋 Daftar Semua User:\n');
  
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log('Tidak ada user dalam database.');
    await prisma.$disconnect();
    return;
  }

  users.forEach((user, index) => {
    const emailStatus = user.emailVerified ? '✅' : '❌';
    const approvalStatus = user.isApproved ? '✅' : '❌';
    const canLogin = user.emailVerified && user.isApproved ? '🟢 Bisa Login' : '🔴 Tidak Bisa Login';
    
    console.log(`${index + 1}. ${user.name} (${user.email})`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email Verified: ${emailStatus}`);
    console.log(`   Approved: ${approvalStatus}`);
    console.log(`   Status: ${canLogin}`);
    console.log(`   Created: ${user.createdAt.toLocaleString('id-ID')}`);
    console.log('');
  });

  console.log(`Total: ${users.length} user`);
  await prisma.$disconnect();
}

listUsers().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
