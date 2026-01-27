'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null;
}
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Data untuk chart
const trendData = [
  { bulan: 'Jul', nilai: 1.8 },
  { bulan: 'Agu', nilai: 2.1 },
  { bulan: 'Sep', nilai: 2.0 },
  { bulan: 'Okt', nilai: 2.3 },
  { bulan: 'Nov', nilai: 2.2 },
  { bulan: 'Des', nilai: 2.1 },
  { bulan: 'Jan', nilai: 2.2 },
];

const pieData = [
  { name: 'Material', value: 83, color: '#DC2626' },
  { name: 'Jasa', value: 4, color: '#F59E0B' },
  { name: 'Kontrak', value: 13, color: '#FCD34D' },
];

const prepaidData = [
  { bulan: 'Jul', realisasi: 150, schedule: 180 },
  { bulan: 'Agu', realisasi: 200, schedule: 220 },
  { bulan: 'Sep', realisasi: 180, schedule: 200 },
  { bulan: 'Okt', realisasi: 220, schedule: 240 },
  { bulan: 'Nov', realisasi: 250, schedule: 260 },
  { bulan: 'Des', realisasi: 280, schedule: 300 },
  { bulan: 'Jan', realisasi: 320, schedule: 310 },
];

const accrualData = [
  { bulan: 'Jul', realisasi: 200, schedule: 180 },
  { bulan: 'Agu', realisasi: 220, schedule: 200 },
  { bulan: 'Sep', realisasi: 210, schedule: 220 },
  { bulan: 'Okt', realisasi: 240, schedule: 250 },
  { bulan: 'Nov', realisasi: 260, schedule: 270 },
  { bulan: 'Des', realisasi: 500, schedule: 480 },
  { bulan: 'Jan', realisasi: 520, schedule: 500 },
];

const recentActivities = [
  {
    title: 'Data prepaid baru diteruskan',
    subtitle: 'Prepaid Insurance - PT ACA',
    time: '2 jam yang lalu',
  },
  {
    title: 'Laporan accrual disetujui',
    subtitle: 'Accrual Utilities - PT PLN',
    time: '4 jam yang lalu',
  },
  {
    title: 'Selesmasnya SAP berhasil',
    subtitle: 'Journal Spreading Batch',
    time: '6 jam yang lalu',
  },
  {
    title: 'Export report berhasil',
    subtitle: 'Open Item Report',
    time: '1 hari yang lalu',
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Header */}
        <Header
          title="Dashboard"
          subtitle="Visualisasi data dan ringkasan aktivitas akuntan"
        />

        {/* Content Area */}
        <div className="p-8">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Material"
              value="Rp 2.195 M"
              change="+2.1%"
              changeType="increase"
              subtitle="dari bulan lalu"
              icon={<Package size={24} className="text-red-600" />}
              iconBgColor="bg-red-50"
            />
            <MetricCard
              title="Total Prepaid"
              value="Rp 360 M"
              change="+23%"
              changeType="increase"
              subtitle="dari bulan lalu"
              icon={<TrendingUp size={24} className="text-orange-600" />}
              iconBgColor="bg-orange-50"
            />
            <MetricCard
              title="Total Accrual"
              value="Rp 200 M"
              change="69.7%"
              changeType="decrease"
              subtitle="dari target"
              icon={<Clock size={24} className="text-red-600" />}
              iconBgColor="bg-red-50"
            />
            <MetricCard
              title="Open Items"
              value="126"
              change="+4 dari bulan"
              changeType="increase"
              subtitle="lalu"
              icon={<FileText size={24} className="text-yellow-600" />}
              iconBgColor="bg-yellow-50"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Line Chart - Tren Nilai Material */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Tren Nilai Material (7 Bulan Terakhir)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="nilai"
                    stroke="#DC2626"
                    strokeWidth={3}
                    dot={{ fill: '#DC2626', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart - Distribusi Kategori Material */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Distribusi Kategori Material
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Monitoring Prepaid */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Monitoring Prepaid: Schedule vs Realisasi Post
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={prepaidData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="realisasi" fill="#F59E0B" name="Realisasi Post" />
                  <Bar dataKey="schedule" fill="#FCD34D" name="Schedule" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monitoring Accrual */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Monitoring Accrual: Schedule vs Realisasi Post
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={accrualData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="realisasi" fill="#DC2626" name="Realisasi Post" />
                  <Bar dataKey="schedule" fill="#F87171" name="Schedule" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Aktivitas Terkini
            </h3>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {activity.title}
                    </p>
                    <p className="text-sm text-gray-500">{activity.subtitle}</p>
                  </div>
                  <span className="text-xs text-gray-400">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
