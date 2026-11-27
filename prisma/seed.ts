import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // Hash password untuk admin sistem
  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);

  // Create Admin System user
  const adminSystem = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      email: 'admin@semenindonesia.com',
      role: 'ADMIN_SYSTEM',
      isApproved: true, // Admin selalu approved
      emailVerified: true, // Admin selalu verified
    },
    create: {
      username: 'admin',
      email: 'admin@semenindonesia.com',
      password: hashedPasswordAdmin,
      name: 'Administrator Sistem',
      role: 'ADMIN_SYSTEM',
      isApproved: true, // Admin selalu approved
      emailVerified: true, // Admin selalu verified
    },
  });

  console.log('Admin System user created:', { 
    id: adminSystem.id, 
    username: adminSystem.username, 
    name: adminSystem.name,
    role: adminSystem.role 
  });

  const costCompanies = [
    {
      companyCode: '2000',
      companyName: 'Company 2000',
      groups: [
        { code: 'ADUM', name: 'ADUM', displayOrder: 1 },
        { code: 'PASAR', name: 'PASAR', displayOrder: 2 },
      ],
    },
    {
      companyCode: '7000',
      companyName: 'Company 7000',
      groups: [
        { code: 'HPP', name: 'HPP', displayOrder: 1 },
        { code: 'ADUM', name: 'ADUM', displayOrder: 2 },
        { code: 'PASAR', name: 'PASAR', displayOrder: 3 },
      ],
    },
  ];

  for (const companySeed of costCompanies) {
    const company = await prisma.costCompany.upsert({
      where: { companyCode: companySeed.companyCode },
      update: {
        companyName: companySeed.companyName,
        active: true,
      },
      create: {
        companyCode: companySeed.companyCode,
        companyName: companySeed.companyName,
      },
    });

    for (const group of companySeed.groups) {
      await prisma.costGroup.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: group.code,
          },
        },
        update: {
          name: group.name,
          displayOrder: group.displayOrder,
          active: true,
        },
        create: {
          companyId: company.id,
          ...group,
        },
      });
    }
  }

  console.log('Cost Structure company and group master data synced');

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
