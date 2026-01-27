'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, CheckCircle, DollarSign, FileText } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MetricCard from './components/MetricCard';
import RekonsiliasiCard from './components/RekonsiliasiCard';

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState({
    totalAccrual: 0,
    totalRealisasi: 0,
    totalSaldo: 0,
    jumlahAccrual: 0,
  });

  useEffect(() => {
    // Check authentication on client side
    const auth = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(auth);

    if (!auth) {
      router.replace('/login');
      return;
    }

    fetchDashboardStats();
  }, [router]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/accrual');
      if (response.ok) {
        const accruals = await response.json();
        const totalAccrual = accruals.reduce((sum: number, item: any) => sum + item.totalAmount, 0);
        const totalRealisasi = accruals.reduce((sum: number, item: any) =>
          sum + (item.periodes?.reduce((pSum: number, p: any) => pSum + (p.totalRealisasi || 0), 0) || 0), 0);
        const totalSaldo = totalAccrual - totalRealisasi;

        setStats({
          totalAccrual,
          totalRealisasi,
          totalSaldo,
          jumlahAccrual: accruals.length,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64 flex-1 bg-gray-50 overflow-hidden">
        {/* Header */}
        <Header
          title="Dashboard"
          subtitle="Ringkasan aktivitas dan monitoring accrual"
        />

        {/* Content Area */}
        <div className="p-8 bg-gray-50">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Accrual"
              value={formatCurrency(stats.totalAccrual)}
              icon={<TrendingUp size={24} />}
              color="blue"
            />
            <MetricCard
              title="Total Realisasi"
              value={formatCurrency(stats.totalRealisasi)}
              icon={<CheckCircle size={24} />}
              color="green"
            />
            <MetricCard
              title="Total Saldo"
              value={formatCurrency(stats.totalSaldo)}
              icon={<DollarSign size={24} />}
              color="red"
            />
            <MetricCard
              title="Jumlah Accrual"
              value={stats.jumlahAccrual.toString()}
              icon={<FileText size={24} />}
              color="purple"
            />
          </div>

          {/* Rekonsiliasi Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RekonsiliasiCard
              title="Rekonsiliasi Accrual vs Realisasi"
              description="Monitoring selisih antara accrual yang dicatat dengan realisasi pembayaran"
              status="normal"
              percentage={85}
            />
            <RekonsiliasiCard
              title="Status Periode Accrual"
              description="Tracking periode accrual yang telah jatuh tempo"
              status="warning"
              percentage={72}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
