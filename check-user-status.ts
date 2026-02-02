import { prisma } from './lib/prisma';

async function checkUserStatus() {
  // Bisa diubah atau menggunakan argument dari command line
  const email = process.argv[2] || 'aszra.tjahjaningrat23@student.ui.ac.id';
  
  try {
    console.log(`\n🔍 Mengecek status user dengan email: ${email}\n`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        isApproved: true,
        verificationToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      console.log('❌ User tidak ditemukan dengan email:', email);
      console.log('\n💡 Pastikan email yang Anda masukkan benar.');
      return;
    }

    console.log('='.repeat(70));
    console.log('📋 INFORMASI USER');
    console.log('='.repeat(70));
    console.log(`ID               : ${user.id}`);
    console.log(`Username         : ${user.username}`);
    console.log(`Email            : ${user.email}`);
    console.log(`Name             : ${user.name}`);
    console.log(`Role             : ${user.role}`);
    console.log(`Created At       : ${user.createdAt.toLocaleString('id-ID')}`);
    console.log(`Updated At       : ${user.updatedAt.toLocaleString('id-ID')}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('🔐 STATUS AKSES');
    console.log('='.repeat(70));
    console.log(`Email Verified   : ${user.emailVerified ? '✅ SUDAH TERVERIFIKASI' : '❌ BELUM TERVERIFIKASI'}`);
    console.log(`Admin Approval   : ${user.isApproved ? '✅ SUDAH DI-APPROVE' : '⏳ MENUNGGU APPROVAL'}`);
    console.log(`Verif. Token     : ${user.verificationToken ? '🔑 ' + user.verificationToken.substring(0, 20) + '...' : '✓ Null (sudah digunakan)'}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎯 DIAGNOSIS');
    console.log('='.repeat(70));
    
    if (user.emailVerified && user.isApproved) {
      console.log('✅ STATUS: User BISA LOGIN!');
      console.log('');
      console.log('Semua persyaratan sudah terpenuhi:');
      console.log('  ✓ Email sudah diverifikasi');
      console.log('  ✓ Admin sudah approve');
      console.log('');
      console.log('💡 Jika user masih tidak bisa login:');
      console.log('   1. Pastikan email dan password yang dimasukkan benar');
      console.log('   2. Coba clear cache browser (Ctrl+Shift+Delete)');
      console.log('   3. Coba di incognito/private mode');
      console.log('   4. Cek console browser untuk error (F12 → Console)');
    } else {
      console.log('❌ STATUS: User TIDAK BISA LOGIN');
      console.log('');
      console.log('Masalah yang ditemukan:');
      
      if (!user.emailVerified) {
        console.log('  ✗ Email belum terverifikasi');
        console.log('    → User harus klik link verifikasi di email');
      }
      
      if (!user.isApproved) {
        console.log('  ✗ Belum di-approve oleh admin');
        console.log('    → Admin harus approve user ini di User Management');
        console.log('    → Atau jalankan: npx tsx approve-user.ts ' + email);
      }
    }
    
    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\n💡 Pastikan database connection tersedia dan benar.');
  } finally {
    await prisma.$disconnect();
  }
}

checkUserStatus();
