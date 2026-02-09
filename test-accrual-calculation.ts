/**
 * Script untuk test dan debug perhitungan accrual
 * Jalankan dengan: npx ts-node test-accrual-calculation.ts
 */

import { prisma } from './lib/prisma';

async function testAccrualCalculation() {
  console.log('Testing Accrual Calculation Logic...\n');

  // Fetch sample accrual data
  const accruals = await prisma.accrual.findMany({
    take: 5,
    include: {
      periodes: {
        include: {
          realisasis: true
        },
        orderBy: {
          periodeKe: 'asc'
        }
      }
    }
  });

  console.log(`Found ${accruals.length} accruals to test\n`);

  for (const accrual of accruals) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Accrual: ${accrual.kdAkr} - ${accrual.deskripsi}`);
    console.log(`Vendor: ${accrual.vendor}`);
    console.log(`Total Amount: ${accrual.totalAmount}`);
    console.log(`Pembagian Type: ${accrual.pembagianType}`);
    console.log(`Jumlah Periode: ${accrual.jumlahPeriode}`);

    let totalAccrual = 0;
    let totalRealisasi = 0;

    console.log(`\nPeriode Details:`);
    console.log(`${'─'.repeat(80)}`);

    for (const periode of accrual.periodes) {
      const periodeRealisasi = periode.realisasis.reduce((sum, r) => sum + r.amount, 0);
      
      // Date parsing
      const [bulanName, tahunStr] = periode.bulan.split(' ');
      const bulanMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
        'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11
      };
      const periodeBulan = bulanMap[bulanName];
      const periodeTahun = parseInt(tahunStr);
      const today = new Date();
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const periodeDateOnly = new Date(periodeTahun, periodeBulan, 1);

      // Determine if accrual should be recognized
      const hasRealisasi = periodeRealisasi > 0;
      const isDatePassed = todayDate >= periodeDateOnly;
      const shouldRecognize = isDatePassed || hasRealisasi;

      console.log(`\n  Periode ${periode.periodeKe}: ${periode.bulan}`);
      console.log(`    Amount Accrual: Rp ${periode.amountAccrual.toLocaleString('id-ID')}`);
      console.log(`    Total Realisasi: Rp ${periodeRealisasi.toLocaleString('id-ID')} (${periode.realisasis.length} entries)`);
      console.log(`    Date Passed: ${isDatePassed} (periode: ${periodeDateOnly.toISOString().split('T')[0]}, today: ${todayDate.toISOString().split('T')[0]})`);
      console.log(`    Has Realisasi: ${hasRealisasi}`);
      console.log(`    Should Recognize: ${shouldRecognize ? '✓ YES' : '✗ NO'}`);

      if (accrual.pembagianType === 'manual' || shouldRecognize) {
        totalAccrual += periode.amountAccrual;
      }
      totalRealisasi += periodeRealisasi;
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`SUMMARY:`);
    console.log(`  Total Accrual (Recognized): Rp ${totalAccrual.toLocaleString('id-ID')}`);
    console.log(`  Total Realisasi: Rp ${totalRealisasi.toLocaleString('id-ID')}`);
    console.log(`  Saldo: Rp ${(totalAccrual - totalRealisasi).toLocaleString('id-ID')}`);
    console.log(`${'='.repeat(80)}`);
  }

  console.log('\n\nTest completed!');
}

testAccrualCalculation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
