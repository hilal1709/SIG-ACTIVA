import 'dotenv/config';
import { prisma } from './lib/prisma';

async function checkUser() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('Usage: ts-node check-user-detailed.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('❌ User not found:', email);
    process.exit(1);
  }

  console.log('\n📊 User Details:');
  console.log('================');
  console.log('ID:', user.id);
  console.log('Username:', user.username);
  console.log('Email:', user.email);
  console.log('Name:', user.name);
  console.log('Role:', user.role);
  console.log('\n🔐 Status:');
  console.log('Email Verified:', user.emailVerified ? '✅ Yes' : '❌ No');
  console.log('Is Approved:', user.isApproved ? '✅ Yes' : '❌ No');
  console.log('Verification Token:', user.verificationToken || '(none)');
  console.log('\n📅 Timestamps:');
  console.log('Created:', user.createdAt);
  console.log('Updated:', user.updatedAt);

  // Check if user can login
  console.log('\n🚦 Login Status:');
  if (user.emailVerified && user.isApproved) {
    console.log('✅ User CAN login');
  } else {
    console.log('❌ User CANNOT login:');
    if (!user.emailVerified) {
      console.log('   - Email not verified');
    }
    if (!user.isApproved) {
      console.log('   - Not approved by admin');
    }
  }

  await prisma.$disconnect();
}

checkUser().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
