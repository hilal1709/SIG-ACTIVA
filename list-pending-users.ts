import { prisma } from './lib/prisma';

async function listPendingUsers() {
  try {
    // Cari semua user yang belum di-approve
    const pendingUsers = await prisma.user.findMany({
      where: {
        isApproved: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        isApproved: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (pendingUsers.length === 0) {
      console.log('✅ Tidak ada user yang menunggu approval.');
      await prisma.$disconnect();
      return;
    }

    console.log(`\n📋 DAFTAR USER MENUNGGU APPROVAL (${pendingUsers.length} user)\n`);
    console.log('='.repeat(100));

    pendingUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name} (@${user.username})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Email Verified: ${user.emailVerified ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${user.createdAt.toLocaleString('id-ID')}`);
      console.log(`   Status: ${user.emailVerified ? '⏳ Siap di-approve' : '⚠️ Menunggu verifikasi email'}`);
      console.log('-'.repeat(100));
    });

    console.log('\n💡 CARA APPROVE USER:');
    console.log('   npx tsx approve-user.ts <email>');
    console.log('\nContoh:');
    if (pendingUsers.length > 0) {
      console.log(`   npx tsx approve-user.ts ${pendingUsers[0].email}`);
    }

    // Summary
    const emailVerified = pendingUsers.filter(u => u.emailVerified).length;
    const notVerified = pendingUsers.filter(u => !u.emailVerified).length;

    console.log('\n📊 SUMMARY:');
    console.log(`   Total pending: ${pendingUsers.length}`);
    console.log(`   ✅ Email verified: ${emailVerified} (siap di-approve)`);
    console.log(`   ❌ Email not verified: ${notVerified}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listPendingUsers();
