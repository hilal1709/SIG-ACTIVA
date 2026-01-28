'use client';

import { useState, useEffect } from 'react';
import { Search, Download, Plus, MoreVertical, Edit, Trash2, FileDown } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PrepaidForm from '../components/PrepaidForm';
import { exportToCSV } from '../utils/exportUtils';

interface PrepaidPeriode {
  id: number;
  periodeKe: number;
  bulan: string;
  tahun: number;
  amountPrepaid: number;
  isAmortized: boolean;
  amortizedDate?: Date;
}

interface Prepaid {
  id: number;
  companyCode?: string;
  noPo?: string;
  alokasi: string;
  kdAkr: string;
  namaAkun: string;
  deskripsi?: string;
  klasifikasi?: string;
  totalAmount: number;
  startDate: string;
  period: number;
  periodUnit: string;
  remaining: number;
  vendor: string;
  type: string;
  periodes: PrepaidPeriode[];
}

export default function MonitoringPrepaidPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [prepaidData, setPrepaidData] = useState<Prepaid[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [editData, setEditData] = useState<Prepaid | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  // Fetch data dari API
  useEffect(() => {
    fetchPrepaidData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdown !== null) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  const fetchPrepaidData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prepaid');
      
      if (response.ok) {
        const data = await response.json();
        setPrepaidData(data);
      } else {
        console.error('Failed to fetch prepaid data');
      }
    } catch (error) {
      console.error('Error fetching prepaid data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalPrepaidValue = prepaidData.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalRemaining = prepaidData.reduce((sum, item) => sum + item.remaining, 0);
  const activeItems = prepaidData.length;

  // Filter data
  const filteredData = prepaidData.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.kdAkr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaAkun.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const handleExport = () => {
    const headers = ['kdAkr', 'namaAkun', 'alokasi', 'vendor', 'totalAmount', 'remaining', 'period', 'type'];
    exportToCSV(filteredData, 'Monitoring_Prepaid.csv', headers);
  };

  const handleEdit = (item: Prepaid) => {
    setEditData(item);
    setEditMode('edit');
    setIsFormOpen(true);
    setOpenDropdown(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data prepaid ini?')) {
      return;
    }

    try {
      const response = await fetch(`/api/prepaid?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Data prepaid berhasil dihapus!');
        fetchPrepaidData();
      } else {
        alert('Gagal menghapus data prepaid');
      }
    } catch (error) {
      console.error('Error deleting prepaid:', error);
      alert('Terjadi kesalahan saat menghapus data');
    }
    setOpenDropdown(null);
  };

  const handleExportSingle = (item: Prepaid) => {
    const headers = ['companyCode', 'noPo', 'alokasi', 'kdAkr', 'namaAkun', 'deskripsi', 'klasifikasi', 'totalAmount', 'startDate', 'period', 'remaining'];
    exportToCSV([item], `Prepaid_${item.kdAkr}.csv`, headers);
    setOpenDropdown(null);
  };

  const handleAddNew = () => {
    setEditData(null);
    setEditMode('create');
    setIsFormOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <Header
          title="Monitoring Prepaid"
          subtitle="Monitoring dan input data prepaid dengan laporan SAP"
        />

        {/* Content Area */}
        <div className="p-8 flex-1 overflow-y-auto">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-2">Total Prepaid Value</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {formatCurrency(totalPrepaidValue)}
              </h3>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-2">Remaining Amount</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {formatCurrency(totalRemaining)}
              </h3>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-600 mb-2">Active Items</p>
              <h3 className="text-2xl font-bold text-gray-800">{activeItems}</h3>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
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
                  onClick={handleAddNew}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus size={18} />
                  Tambah Data Prepaid
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Memuat data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-w-full bg-white" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                <table className="w-full text-sm bg-white min-w-max">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Company Code
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                        No PO
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Assignment/Order
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Kode Akun Prepaid
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Kode Akun Biaya
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        Deskripsi
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        Klasifikasi
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">
                        Amount
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Start Date
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Finish Date
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">
                        Periode
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Total Prepaid
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                        Total Realisasi
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">
                        Saldo
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((item) => {
                      const startDate = new Date(item.startDate);
                      const finishDate = new Date(startDate);
                      finishDate.setMonth(finishDate.getMonth() + item.period);
                      
                      const totalRealisasi = item.totalAmount - item.remaining;
                      const saldo = item.remaining;
                      
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-3 text-gray-800 whitespace-nowrap">
                            {item.companyCode || '-'}
                          </td>
                          <td className="px-3 py-3 text-gray-800 whitespace-nowrap">
                            {item.noPo || '-'}
                          </td>
                          <td className="px-3 py-3 text-gray-800">
                            {item.alokasi}
                          </td>
                          <td className="px-3 py-3 text-gray-800 whitespace-nowrap">
                            {item.kdAkr}
                          </td>
                          <td className="px-3 py-3 text-gray-800">
                            {item.namaAkun}
                          </td>
                          <td className="px-3 py-3 text-gray-600">
                            {item.deskripsi || '-'}
                          </td>
                          <td className="px-3 py-3 text-gray-600">
                            {item.klasifikasi || '-'}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gray-800">
                            {formatCurrency(item.totalAmount)}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-800 whitespace-nowrap">
                            {startDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-800 whitespace-nowrap">
                            {finishDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-800">
                            {item.period} {item.periodUnit}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gray-800">
                            {formatCurrency(item.totalAmount)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gray-800">
                            {formatCurrency(totalRealisasi)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gray-800">
                            {formatCurrency(saldo)}
                          </td>
                          <td className="px-3 py-3 text-center relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdown(openDropdown === item.id ? null : item.id);
                              }}
                              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                            >
                              <MoreVertical size={18} />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openDropdown === item.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  <Edit size={16} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleExportSingle(item)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  <FileDown size={16} />
                                  Export
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
                                >
                                  <Trash2 size={16} />
                                  Hapus
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredData.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Tidak ada data yang ditemukan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prepaid Form Modal */}
      <PrepaidForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditData(null);
          setEditMode('create');
        }}
        onSuccess={fetchPrepaidData}
        mode={editMode}
        editData={editData}
      />
    </div>
  );
}
