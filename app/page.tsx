'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { TrendingUp, CheckCircle, DollarSign, FileText, Package, CreditCard, Clock } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MetricCard from './components/MetricCard';
import RekonsiliasiCard from './components/RekonsiliasiCard';
import SimpleBarChart from './components/SimpleBarChart';
import DonutChart from './components/DonutChart';
import StatusCard from './components/StatusCard';

interface DashboardSummary {
  material: {
    summary: Array<{ label: string; value: number; amount: number }>;
    byType: Array<{ label: string; value: number }>;
    total: number;
  };
  prepaid: {
    status: { active: number; cleared: number; pending: number };
    financial: { total: number; cleared: number; remaining: number };
    topVendors: Array<{ label: string; value: number }>;
    total: number;
  };
  accrual: {
    status: { active: number; cleared: number; pending: number };
    financial: { total: number; realized: number; remaining: number };
    topVendors: Array<{ label: string; value: number }>;
    total: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalAccrual: 0,
    totalRealisasi: 0,
    totalSaldo: 0,
    jumlahAccrual: 0,
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
    fetchDashboardSummary();
  }, []);

  const fetchDashboardStats = useCallback(async () => {
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
  }, []);

  const fetchDashboardSummary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/summary');
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }, []);

  // Memoized chart data
  const materialChartData = useMemo(() => {
    if (!summary) return [];
    return summary.material.summary.slice(0, 5).map(item => ({
      label: item.label,
      value: item.value,
    }));
  }, [summary]);

  const prepaidDonutData = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Active', value: summary.prepaid.status.active, color: '#2563eb' },
      { label: 'Cleared', value: summary.prepaid.status.cleared, color: '#059669' },
      { label: 'Pending', value: summary.prepaid.status.pending, color: '#f59e0b' },
    ];
  }, [summary]);

  const accrualDonutData = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Active', value: summary.accrual.status.active, color: '#dc2626' },
      { label: 'Cleared', value: summary.accrual.status.cleared, color: '#059669' },
      { label: 'Pending', value: summary.accrual.status.pending, color: '#f59e0b' },
    ];
  }, [summary]);

  const topVendorsData = useMemo(() => {
    if (!summary) return [];
    return summary.prepaid.topVendors.map(v => ({
      label: v.label,
      value: v.value,
    }));
  }, [summary]);

  const topAccrualVendorsData = useMemo(() => {
    if (!summary) return [];
    return summary.accrual.topVendors.map(v => ({
      label: v.label,
      value: v.value,
    }));
  }, [summary]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-64 flex-1 bg-gray-50 overflow-hidden">
        {/* Header */}
        <Header
          title="Dashboard"
          subtitle="Ringkasan aktivitas dan monitoring accrual"
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* Content Area */}
        <div className="p-4 md:p-8 bg-gray-50">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="animate-fadeIn delay-100">
              <MetricCard
                title="Total Accrual"
                value={formatCurrency(stats.totalAccrual)}
                icon={<TrendingUp size={24} />}
                color="blue"
              />
            </div>
            <div className="animate-fadeIn delay-200">
              <MetricCard
                title="Total Realisasi"
                value={formatCurrency(stats.totalRealisasi)}
                icon={<CheckCircle size={24} />}
                color="green"
              />
            </div>
            <div className="animate-fadeIn delay-300">
              <MetricCard
                title="Total Saldo"
                value={formatCurrency(stats.totalSaldo)}
                icon={<DollarSign size={24} />}
                color="red"
              />
            </div>
            <div className="animate-fadeIn delay-400">
              <MetricCard
                title="Jumlah Accrual"
                value={stats.jumlahAccrual.toString()}
                icon={<FileText size={24} />}
                color="purple"
              />
            </div>
          </div>

          {/* Additional Overview Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              <div className="animate-fadeIn delay-100">
                <MetricCard
                  title="Total Material"
                  value={summary.material.total.toString()}
                  icon={<Package size={24} />}
                  color="indigo"
                />
              </div>
              <div className="animate-fadeIn delay-200">
                <MetricCard
                  title="Total Prepaid"
                  value={summary.prepaid.total.toString()}
                  icon={<CreditCard size={24} />}
                  color="teal"
                />
              </div>
              <div className="animate-fadeIn delay-300">
                <MetricCard
                  title="Saldo Prepaid"
                  value={formatCurrency(summary.prepaid.financial.remaining)}
                  icon={<Clock size={24} />}
                  color="orange"
                />
              </div>
            </div>
          )}

          {/* Charts Section */}
          {!loading && summary && (
            <>
              {/* Material & Prepaid Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
                <SimpleBarChart
                  data={materialChartData}
                  title="Material per Plant"
                  color="#2563eb"
                />
                
                <DonutChart
                  data={prepaidDonutData}
                  title="Status Prepaid"
                  centerText={summary.prepaid.total.toString()}
                  centerSubtext="Total Prepaid"
                />
              </div>

              {/* Accrual & Vendors Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
                <DonutChart
                  data={accrualDonutData}
                  title="Status Accrual"
                  centerText={summary.accrual.total.toString()}
                  centerSubtext="Total Accrual"
                />
                
                <SimpleBarChart
                  data={topVendorsData}
                  title="Top 5 Vendor Prepaid"
                  color="#059669"
                />
              </div>

              {/* Vendor Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
                <SimpleBarChart
                  data={topAccrualVendorsData}
                  title="Top 5 Vendor Accrual"
                  color="#dc2626"
                />
                
                <StatusCard
                  title="Ringkasan Status"
                  items={[
                    {
                      label: 'Prepaid Active',
                      count: summary.prepaid.status.active,
                      status: 'success',
                    },
                    {
                      label: 'Prepaid Pending',
                      count: summary.prepaid.status.pending,
                      status: 'warning',
                    },
                    {
                      label: 'Accrual Active',
                      count: summary.accrual.status.active,
                      status: 'error',
                    },
                    {
                      label: 'Accrual Pending',
                      count: summary.accrual.status.pending,
                      status: 'pending',
                    },
                  ]}
                />
              </div>
            </>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600">Memuat data visualisasi...</p>
              </div>
            </div>
          )}

          {/* Rekonsiliasi Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn delay-300">
            <RekonsiliasiCard
              title="Rekonsiliasi Accrual vs Realisasi"
              description="Monitoring selisih antara accrual yang dicatat dengan realisasi pembayaran"
              status={stats.totalAccrual > 0 ? (stats.totalRealisasi / stats.totalAccrual >= 0.8 ? 'normal' : 'warning') : 'normal'}
              percentage={stats.totalAccrual > 0 ? Math.round((stats.totalRealisasi / stats.totalAccrual) * 100) : 0}
            />
            <RekonsiliasiCard
              title="Status Prepaid"
              description="Tracking prepaid yang telah diamortisasi"
              status={summary?.prepaid?.financial?.total && summary.prepaid.financial.total > 0 ? (summary.prepaid.financial.cleared / summary.prepaid.financial.total >= 0.7 ? 'normal' : 'warning') : 'normal'}
              percentage={summary?.prepaid?.financial?.total && summary.prepaid.financial.total > 0 ? Math.round((summary.prepaid.financial.cleared / summary.prepaid.financial.total) * 100) : 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
