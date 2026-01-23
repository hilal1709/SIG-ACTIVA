import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Menghapus semua data accrual...');
  
  const result = await prisma.accrual.deleteMany({});
  
  console.log(`Berhasil menghapus ${result.count} data accrual`);
  
  await pool.end();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
