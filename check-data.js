const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const count = await prisma.materialData.count();
    console.log(`Total records in database: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.materialData.findFirst();
      console.log('\nSample record:');
      console.log(JSON.stringify(sample, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
