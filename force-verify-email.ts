import { prisma } from './lib/prisma';

async function forceVerifyEmail() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('❌ Cara penggunaan: npx tsx force-verify-email.ts <email>');
    console.log('Contoh: npx tsx force-verify-email.ts aszra.tjahjaningrat23@student.ui.ac.id');
    process.exit(1);
  }

  try {
    console.log(`\n🔍 Mencari user dengan email: ${email}\n`);
    
    // Cari user berdasarkan email
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
      },
    });

    if (!user) {
      console.log('❌ User tidak ditemukan dengan email:', email);
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log('='.repeat(70));
    console.log('📋 INFORMASI USER');
    console.log('='.repeat(70));
    console.log(`ID               : ${user.id}`);
    console.log(`Username         : ${user.username}`);
    console.log(`Name             : ${user.name}`);
    console.log(`Email            : ${user.email}`);
    console.log(`Role             : ${user.role}`);
    console.log(`Email Verified   : ${user.emailVerified ? '✅ SUDAH' : '❌ BELUM'}`);
    console.log(`Admin Approved   : ${user.isApproved ? '✅ SUDAH' : '❌ BELUM'}`);
    console.log(`Verif. Token     : ${user.verificationToken ? 'Ada (belum diverifikasi)' : 'Null'}`);

    if (user.emailVerified) {
      console.log('\n⚠️ Email user ini sudah terverifikasi sebelumnya.');
      
      if (user.isApproved) {
        console.log('✅ User sudah bisa login!');
      } else {
        console.log('⏳ User masih perlu di-approve admin.');
      }
      
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('\n' + '='.repeat(70));
    console.log('🔧 MEMVERIFIKASI EMAIL...');
    console.log('='.repeat(70));

    // Force verify email
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null, // Hapus token setelah verifikasi
      },
    });

    console.log('\n✅ SUCCESS! Email berhasil diverifikasi (force)!');
    console.log('\n' + '='.repeat(70));
    console.log('📊 STATUS TERBARU');
    console.log('='.repeat(70));
    console.log(`Email Verified   : ${updatedUser.emailVerified ? '✅ SUDAH' : '❌ BELUM'}`);
    console.log(`Admin Approved   : ${updatedUser.isApproved ? '✅ SUDAH' : '❌ BELUM'}`);
    console.log(`Verif. Token     : ${updatedUser.verificationToken || 'Null (sudah diverifikasi)'}`);
    
    if (updatedUser.emailVerified && updatedUser.isApproved) {
      console.log('\n🎉 USER SEKARANG SUDAH BISA LOGIN!');
      console.log('\n💡 Instruksi untuk user:');
      console.log('   1. Buka halaman login');
      console.log('   2. Masukkan email dan password');
      console.log('   3. Klik tombol Masuk');
    } else if (updatedUser.emailVerified && !updatedUser.isApproved) {
      console.log('\n⏳ Email sudah terverifikasi, tapi masih perlu approval admin.');
      console.log('\n💡 Jalankan: npx tsx approve-user.ts ' + email);
    }

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\n💡 Pastikan database connection tersedia.');
  } finally {
    await prisma.$disconnect();
  }
}

forceVerifyEmail();
