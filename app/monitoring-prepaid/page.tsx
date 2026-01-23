'use client';

import { useState } from 'react';
import { Search, Download, Plus, MoreVertical } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { mockPrepaidData } from '../utils/mockData';
import { exportToCSV } from '../utils/exportUtils';

export default function MonitoringPrepaidPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  // Calculate totals
  const totalPrepaidValue = mockPrepaidData.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalRemaining = mockPrepaidData.reduce((sum, item) => sum + item.remaining, 0);
  const activeItems = mockPrepaidData.length;

  // Filter data
  const filteredData = mockPrepaidData.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.kdAkr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaAkun.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'All' || item.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const handleExport = () => {
    const headers = ['kdAkr', 'namaAkun', 'alokasi', 'vendor', 'totalAmount', 'remaining', 'period', 'type'];
    exportToCSV(filteredData, 'Monitoring_Prepaid.csv', headers);
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Header */}
        <Header
          title="Monitoring Prepaid"
          subtitle="Monitoring dan input data prepaid dengan laporan SAP"
        />

        {/* Content Area */}
        <div className="p-8">
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

              {/* Filter Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('All')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'All'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('Linear')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'Linear'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Linear
                </button>
                <button
                  onClick={() => setFilterType('Verbal')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'Verbal'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Verbal
                </button>
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
                <button className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                  <Plus size={18} />
                  Tambah Data Prepaid
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Kd Akr dan Alokasi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Nama Akun
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      Total Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      Remaining
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                      Period
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                      Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-800">{item.kdAkr}</div>
                        <div className="text-xs text-gray-500">{item.alokasi}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-800">{item.namaAkun}</td>
                      <td className="px-4 py-4 text-gray-600">{item.vendor}</td>
                      <td className="px-4 py-4 text-right font-medium text-gray-800">
                        {formatCurrency(item.totalAmount)}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-gray-800">
                        {formatCurrency(item.remaining)}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-800">
                        {item.period} {item.periodUnit}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            item.type === 'Linear'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {item.type}
                        </span>
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
        </div>
      </div>
    </div>
  );
}
