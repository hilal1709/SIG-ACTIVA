import { prisma } from './lib/prisma';

async function approveUser() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('❌ Cara penggunaan: npx tsx approve-user.ts <email>');
    console.log('Contoh: npx tsx approve-user.ts aszra.tjahjaningrat23@student.ui.ac.id');
    process.exit(1);
  }

  try {
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
      },
    });

    if (!user) {
      console.log('❌ User tidak ditemukan dengan email:', email);
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log('\n=== INFORMASI USER ===');
    console.log('ID:', user.id);
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Role:', user.role);
    console.log('Email Verified:', user.emailVerified ? '✅ YES' : '❌ NO');
    console.log('Is Approved:', user.isApproved ? '✅ YES' : '❌ NO');

    if (user.isApproved) {
      console.log('\n⚠️ User ini sudah di-approve sebelumnya.');
      await prisma.$disconnect();
      process.exit(0);
    }

    if (!user.emailVerified) {
      console.log('\n⚠️ WARNING: User ini belum verifikasi email!');
      console.log('User harus verifikasi email terlebih dahulu sebelum di-approve.');
      console.log('\nTetap ingin approve? (User akan bisa login setelah verifikasi email)');
    }

    // Update user menjadi approved
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isApproved: true,
      },
    });

    console.log('\n✅ SUCCESS! User berhasil di-approve!');
    console.log('\n=== STATUS TERBARU ===');
    console.log('Email Verified:', updatedUser.emailVerified ? '✅ YES' : '❌ NO');
    console.log('Is Approved:', updatedUser.isApproved ? '✅ YES' : '❌ NO');
    
    if (updatedUser.emailVerified && updatedUser.isApproved) {
      console.log('\n🎉 User sekarang sudah bisa login!');
    } else if (!updatedUser.emailVerified && updatedUser.isApproved) {
      console.log('\n⏳ User bisa login setelah verifikasi email.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approveUser();
