'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Plus, MoreVertical, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { exportToCSV } from '../utils/exportUtils';

// Mapping Kode Akun dan Klasifikasi
const KODE_AKUN_KLASIFIKASI: Record<string, string[]> = {
  '21600001': ['Gaji', 'Cuti Tahunan'],
  '21600003': ['JASPRO'],
  '21600004': ['THR'],
  '21600005': ['JASPRO', 'GAJI'],
  '21600006': ['PCD PPH 21'],
  '21600008': ['BK REMBANG', 'BK TUBAN', 'LAIN-LAIN', 'TL REMBANG', 'TL TUBAN'],
  '21600009': ['PBB BABAT LAMONGAN', 'PBB BANGKALAN', 'PBB BANJARMASIN', 'PBB BANYUWANGI', 'PBB CIGADING', 'PBB DAGEN', 'PBB GRESIK', 'PBB JAKARTA', 'PBB LAMONGAN', 'PBB MEMPAWAH', 'PBB NAROGONG', 'PBB PASURUAN', 'PBB PELINDO', 'PBB REMBANG', 'PBB SAYUNG', 'PBB SIDOARJO', 'PBB SORONG', 'PBB SQ TOWER', 'PBB SURABAYA', 'PPB TUBAN'],
  '21600010': ['AAB TBN', 'Cigading', 'Infra', 'KEAMANAN GRESIK', 'KEAMANAN PP', 'KEAMANAN TUBAN', 'Kebersihan Gresik', 'Kebersihan Tuban', 'Lain-lain', 'Operasional Kantor', 'OPERASIONAL PABRIK', 'Parkir', 'PEMELIHARAAN ALL AREA PBR TUBAN', 'Pemeliharaan Autonomous', 'PEMELIHARAAN FM', 'PEMELIHARAAN GUSI & SQ', 'Pemeliharaan Listrik', 'Pemeliharaan Pbr Gresik', 'PEMELIHARAAN PBR TUBAN', 'REVERSE', 'TRANSPORTASI'],
  '21600011': ['GUNUNG SARI', 'PABRIK GRESIK', 'PABRIK TUBAN', 'PERDIN GRESIK', 'PERDIN TUBAN', 'PP CIGADING', 'REKLAS PLN'],
  '21600012': ['OA'],
  '21600018': ['LAIN-LAIN', 'JASA AUDIT', 'Marketing', 'LGRC', 'SDM', 'ICT'],
  '21600019': ['BILLBOARD, IKLAN, DAN PAJAK', 'Lainnya', 'Point', 'Product Knowledge', 'SALES PROMO'],
  '21600020': ['AAB TBN', 'AFVAL', 'ASET', 'ASURANSI', 'BAHAN', 'DEPT CLD 2021', 'DEPT QA', 'Dept Rnd', 'DEPT TREASURY', 'GCG', 'ICT', 'ICT LINK NET', 'Innovation Award', 'JAMUAN TAMU', 'Jasa audit', 'Kalender', 'Kantong', 'KENDARAAN PP', 'KOMSAR', 'KON HUKUM', 'KON PAJAK', 'KON TALENT', 'KSO', 'LAIN-LAIN', 'LGRC', 'Litbang', 'MAKLON CB', 'MAKLON CWD', 'Maklon TJP', 'MSA', 'Obligasi', 'PAJAK', 'PELABUHAN', 'Pengl. Gudang/Sprepart', 'PJK. UM OP Mgr Sales', 'Right Issue', 'ROYALTY', 'RT', 'SDM', 'Seragam', 'Set-Off Prepaid', 'SEWA KENDARAAN', 'SEWA PACKING PLAN', 'SPPD', 'Troughput', 'UKL PP', 'UM', 'UNIT SHE'],
  '21600021': ['CSR'],
  '21600022': ['GRESIK', 'TUBAN'],
  '21600024': ['BK REMBANG', 'BK TUBAN', 'BK TUBAN SM', 'Driver', 'Handak', 'Lain-lain', 'SOLAR REMBANG', 'SOLAR TUBAN', 'SUPPORT SG', 'SUPPORT TB', 'TL REMBANG', 'TL TUBAN'],
  '21600025': ['BALIKPAPAN', 'BANJARMASIN', 'BANYUWANGI', 'CELUKAN BAWANG', 'CIGADING', 'CIWANDAN', 'DC BUFFER', 'MAKLON', 'NAROGONG', 'PONTIANAK', 'SEWA PALET', 'SORONG', 'TERSUS TUBAN', 'TJ PRIOK', 'TUBAN'],
  '21600026': ['IAR', 'Asuransi Kesehatan'],
  '21600034': ['PD'],
  '21600007': ['PENGOBATAN'],
  '21600033': ['LAIN-LAIN'],
};

interface Accrual {
  id: number;
  companyCode?: string;
  noPo?: string;
  kdAkr: string;
  alokasi?: string;
  kdAkunBiaya: string;
  vendor: string;
  deskripsi: string;
  amount: number;
  costCenter?: string;
  accrDate: string;
  periode?: string;
  status: string;
  type?: string;
}

interface AccrualFormData {
  companyCode: string;
  noPo: string;
  assignment: string;
  kdAkr: string;
  kdAkunBiaya: string;
  vendor: string;
  deskripsi: string;
  klasifikasi: string;
  amount: string;
  costCenter: string;
  startDate: string;
  periode: string;
}

export default function MonitoringAccrualPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [accrualData, setAccrualData] = useState<Accrual[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<AccrualFormData>({
    companyCode: '',
    noPo: '',
    assignment: '',
    kdAkr: '',
    kdAkunBiaya: '',
    vendor: '',
    deskripsi: '',
    klasifikasi: '',
    amount: '',
    costCenter: '',
    startDate: '',
    periode: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Get available klasifikasi based on selected kode akun
  const availableKlasifikasi = useMemo(() => {
    if (!formData.kdAkr) return [];
    return KODE_AKUN_KLASIFIKASI[formData.kdAkr] || [];
  }, [formData.kdAkr]);

  // Fetch accrual data
  useEffect(() => {
    fetchAccrualData();
  }, []);

  const fetchAccrualData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/accrual');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setAccrualData(data);
    } catch (error) {
      console.error('Error fetching accrual data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalAccrual = accrualData.reduce((sum, item) => sum + item.amount, 0);
  const pendingCount = accrualData.filter(item => item.status === 'Pending').length;
  const approvedCount = accrualData.filter(item => item.status === 'Approved').length;
  const reversedCount = accrualData.filter(item => item.status === 'Reversed').length;

  // Filter data
  const filteredData = accrualData.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.kdAkr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaAkun.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.deskripsi.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
    const matchesType = filterType === 'All' || item.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleExport = () => {
    const headers = ['kdAkr', 'namaAkun', 'vendor', 'deskripsi', 'amount', 'accrDate', 'status'];
    exportToCSV(filteredData, 'Monitoring_Accrual.csv', headers);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // If kode akun changes, reset klasifikasi
    if (name === 'kdAkr') {
      setFormData(prev => ({ ...prev, [name]: value, klasifikasi: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/accrual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyCode: formData.companyCode || null,
          noPo: formData.noPo || null,
          kdAkr: formData.kdAkr,
          alokasi: formData.assignment || null,
          kdAkunBiaya: formData.kdAkunBiaya,
          vendor: formData.vendor,
          deskripsi: formData.deskripsi,
          amount: parseFloat(formData.amount),
          costCenter: formData.costCenter || null,
          accrDate: formData.startDate,
          periode: formData.periode || null,
          status: 'Pending',
          type: formData.klasifikasi,
        }),
      });

      if (!response.ok) throw new Error('Failed to create accrual');

      // Reset form and close modal
      setFormData({
        companyCode: '',
        noPo: '',
        assignment: '',
        kdAkr: '',
        kdAkunBiaya: '',
        vendor: '',
        deskripsi: '',
        klasifikasi: 'Linear',
        amount: '',
        costCenter: '',
        startDate: '',
        periode: '',
      });
      setShowModal(false);
      
      // Refresh data
      fetchAccrualData();
      alert('Data accrual berhasil ditambahkan!');
    } catch (error) {
      console.error('Error creating accrual:', error);
      alert('Gagal menambahkan data accrual. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-orange-100 text-orange-700';
      case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Reversed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64 flex-1 bg-gray-50 overflow-hidden">
        {/* Header */}
        <Header
          title="Monitoring Accrual"
          subtitle="Monitoring dan input data accrual dengan export laporan SAP"
        />

        {/* Content Area */}
        <div className="p-8 bg-gray-50">
          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <>
              {/* Filter Bar */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Search */}
                  <div className="relative flex-1 min-w-62.5">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Cari berdasarkan..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Download size={18} />
                      Export Laporan SAP
                    </button>
                    <button 
                      onClick={() => setShowModal(true)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Plus size={18} />
                      Tambah Data Accrual
                    </button>
                  </div>
                </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-2">Total Accrual</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {formatCurrency(totalAccrual)}
              </h3>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-2">Pending</p>
              <h3 className="text-2xl font-bold text-gray-800">{pendingCount}</h3>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-2">Approved</p>
              <h3 className="text-2xl font-bold text-gray-800">{approvedCount}</h3>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-2">Reversed</p>
              <h3 className="text-2xl font-bold text-gray-800">{reversedCount}</h3>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
              <table className="w-full text-sm" style={{ minWidth: '1200px' }}>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Company Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      No PO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Assignment/Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Kode Akun Accrual
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Kode Akun Biaya
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Deskripsi
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Klasifikasi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Cost Center
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Periode
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Total Accrual
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Total Realisasi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Saldo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-gray-800 whitespace-nowrap">{item.companyCode || '-'}</td>
                      <td className="px-4 py-4 text-gray-800 whitespace-nowrap">{item.noPo || '-'}</td>
                      <td className="px-4 py-4 text-gray-800 whitespace-nowrap">{item.alokasi || '-'}</td>
                      <td className="px-4 py-4 text-gray-800 whitespace-nowrap font-medium">{item.kdAkr}</td>
                      <td className="px-4 py-4 text-gray-800">{item.kdAkunBiaya}</td>
                      <td className="px-4 py-4 text-gray-600">{item.vendor}</td>
                      <td className="px-4 py-4 text-gray-600 max-w-xs truncate" title={item.deskripsi}>{item.deskripsi}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          item.type === 'Linear' ? 'bg-blue-100 text-blue-700' : 
                          item.type === 'Verbal' ? 'bg-purple-100 text-purple-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {item.type || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-gray-800 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-4 text-gray-800 whitespace-nowrap">{item.costCenter || '-'}</td>
                      <td className="px-4 py-4 text-center text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(item.accrDate)}
                      </td>
                      <td className="px-4 py-4 text-gray-800 whitespace-nowrap">{item.periode || '-'}</td>
                      <td className="px-4 py-4 text-right font-medium text-gray-800 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-800 whitespace-nowrap">
                        {formatCurrency(0)}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-gray-800 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button className="text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {filteredData.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Tidak ada data yang ditemukan</p>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Form Tambah Data Accrual */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Tambah Data Accrual</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-red-100 transition-colors rounded-full hover:bg-white/10 p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <form onSubmit={handleSubmit} className="p-6 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Company Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Company Code
                  </label>
                  <select
                    name="companyCode"
                    value={formData.companyCode}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                  >
                    <option value="">Pilih Company Code</option>
                    <option value="2000">2000</option>
                    <option value="7000">7000</option>
                  </select>
                </div>

                {/* No PO */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    No PO
                  </label>
                  <input
                    type="text"
                    name="noPo"
                    value={formData.noPo}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan nomor PO"
                  />
                </div>

                {/* Assignment/Order */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Assignment/Order
                  </label>
                  <input
                    type="text"
                    name="assignment"
                    value={formData.assignment}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan assignment/order"
                  />
                </div>

                {/* Kode Akun Accrual */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kode Akun Accrual <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="kdAkr"
                    value={formData.kdAkr}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                  >
                    <option value="">Pilih Kode Akun</option>
                    {Object.keys(KODE_AKUN_KLASIFIKASI).map((kodeAkun) => (
                      <option key={kodeAkun} value={kodeAkun}>
                        {kodeAkun}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kode Akun Biaya */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kode Akun Biaya <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="kdAkunBiaya"
                    value={formData.kdAkunBiaya}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan kode akun biaya"
                  />
                </div>

                {/* Vendor */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vendor <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="vendor"
                    value={formData.vendor}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan nama vendor"
                  />
                </div>

                {/* Klasifikasi */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Klasifikasi <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="klasifikasi"
                    value={formData.klasifikasi}
                    onChange={handleInputChange}
                    required
                    disabled={!formData.kdAkr || availableKlasifikasi.length === 0}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!formData.kdAkr ? 'Pilih Kode Akun terlebih dahulu' : 'Pilih Klasifikasi'}
                    </option>
                    {availableKlasifikasi.map((klasifikasi) => (
                      <option key={klasifikasi} value={klasifikasi}>
                        {klasifikasi}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan jumlah amount"
                  />
                </div>

                {/* Cost Center */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost Center
                  </label>
                  <input
                    type="text"
                    name="costCenter"
                    value={formData.costCenter}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan cost center"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                  />
                </div>

                {/* Periode */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Periode
                  </label>
                  <input
                    type="text"
                    name="periode"
                    value={formData.periode}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Contoh: 12 bulan"
                  />
                </div>

                {/* Deskripsi - Full Width */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Deskripsi <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    name="deskripsi"
                    value={formData.deskripsi}
                    onChange={handleInputChange}
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all resize-none"
                    placeholder="Masukkan deskripsi accrual"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 bg-white px-6 py-4 -mx-6 -mb-6 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
