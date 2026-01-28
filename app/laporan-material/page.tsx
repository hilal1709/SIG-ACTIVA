'use client';

import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Search, AlertCircle, TrendingDown, Package, MapPin, Calculator, Factory, FolderOpen, Navigation } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ExcelImport from '../components/ExcelImport';
import MaterialPivotTable from '../components/MaterialPivotTable';
import { exportToExcel } from '../utils/exportUtils';

interface MaterialData {
  materialId: string;
  materialName: string;
  location: string;
  stokAwal: { opr: number; sap: number; selisih: number; total: number };
  produksi: { opr: number; sap: number; selisih: number; total: number };
  rilis: { opr: number; sap: number; selisih: number; total: number };
  stokAkhir: { opr: number; sap: number; selisih: number; total: number };
  blank: number;
  blankTotal: number;
  grandTotal: number;
}

export default function LaporanMaterialPage() {
  const [selectedLokasi, setSelectedLokasi] = useState('All');
  const [selectedFasilitas, setSelectedFasilitas] = useState('all');
  const [selectedKategori, setSelectedKategori] = useState('all');
  const [selectedSelisih, setSelectedSelisih] = useState('ada selisih');
  const [searchTerm, setSearchTerm] = useState('');
  const [importedData, setImportedData] = useState<MaterialData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Load history dates on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/material-data?action=history');
        if (response.ok) {
          const dates = await response.json();
          // Sort dates to ensure latest is first
          const sortedDates = dates.sort((a: string, b: string) => 
            new Date(b).getTime() - new Date(a).getTime()
          );
          setHistoryDates(sortedDates);
          if (sortedDates.length > 0) {
            setSelectedDate(sortedDates[0]); // Set to latest
          }
        }
      } catch (error) {
        console.error('Error loading history:', error);
      }
    };

    loadHistory();
  }, []);

  // Load data when selected date changes
  useEffect(() => {
    if (!selectedDate) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        console.log('Loading data for date:', selectedDate);
        const response = await fetch(`/api/material-data?importDate=${selectedDate}`);
        console.log('API Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Data loaded from database:', data.length, 'records');
          setImportedData(data);
        } else {
          console.error('Failed to load data, status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
        }
      } catch (error) {
        console.error('Error loading material data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedDate]);

  // Dynamically extract unique locations from imported data
  const uniqueLocations = useMemo(() => {
    if (importedData.length === 0) return ['All'];
    const locations = new Set(importedData.map(item => item.location).filter(Boolean));
    return ['All', ...Array.from(locations)];
  }, [importedData]);

  // Calculate dynamic statistics from imported data
  const dynamicStats = useMemo(() => {
    if (importedData.length === 0) {
      return {
        totalSelisih: 0,
        selisihPerKategori: {
          stokAwal: 0,
          produksi: 0,
          rilis: 0,
          stokAkhir: 0,
        },
        selisihPerLokasi: {},
      };
    }

    const stats = {
      totalSelisih: 0,
      selisihPerKategori: {
        stokAwal: 0,
        produksi: 0,
        rilis: 0,
        stokAkhir: 0,
      },
      selisihPerLokasi: {} as Record<string, number>,
      selisihPerFasilitas: {
        pabrik: 0,
        gudang: 0,
      },
    };

    importedData.forEach(item => {
      // Sum all selisih values
      const stokAwalSelisih = item.stokAwal?.selisih || 0;
      const produksiSelisih = item.produksi?.selisih || 0;
      const rilisSelisih = item.rilis?.selisih || 0;
      const stokAkhirSelisih = item.stokAkhir?.selisih || 0;

      const totalItemSelisih = stokAwalSelisih + produksiSelisih + rilisSelisih + stokAkhirSelisih;

      stats.totalSelisih += totalItemSelisih;
      
      stats.selisihPerKategori.stokAwal += stokAwalSelisih;
      stats.selisihPerKategori.produksi += produksiSelisih;
      stats.selisihPerKategori.rilis += rilisSelisih;
      stats.selisihPerKategori.stokAkhir += stokAkhirSelisih;

      // Group by location
      const location = item.location || 'Unknown';
      if (!stats.selisihPerLokasi[location]) {
        stats.selisihPerLokasi[location] = 0;
      }
      stats.selisihPerLokasi[location] += totalItemSelisih;

      // Categorize by facility (Pabrik vs Gudang) based on location name
      const locationLower = location.toLowerCase();
      if (locationLower.includes('pl') || locationLower.includes('cp')) {
        stats.selisihPerFasilitas.pabrik += totalItemSelisih;
      } else {
        stats.selisihPerFasilitas.gudang += totalItemSelisih;
      }
    });

    return stats;
  }, [importedData]);

  // Calculate additional metrics
  const additionalMetrics = useMemo(() => {
    const totalMaterials = new Set(importedData.map(item => item.materialId)).size;
    const totalLocations = new Set(importedData.map(item => item.location)).size;
    const avgSelisihPerMaterial = totalMaterials > 0 ? dynamicStats.totalSelisih / totalMaterials : 0;
    
    // Find location with highest absolute selisih
    const lokasiWithMaxSelisih = Object.entries(dynamicStats.selisihPerLokasi)
      .reduce((max, [loc, val]) => 
        Math.abs(val) > Math.abs(max.value) ? { location: loc, value: val } : max,
        { location: 'N/A', value: 0 }
      );

    return {
      totalMaterials,
      totalLocations,
      avgSelisihPerMaterial,
      highestSelisihLocation: lokasiWithMaxSelisih,
    };
  }, [importedData, dynamicStats]);

  // Convert stats to chart data
  const volumeSelisihPerKategori = useMemo(() => [
    { name: 'Stok Awal', value: dynamicStats.selisihPerKategori.stokAwal },
    { name: 'Produksi', value: dynamicStats.selisihPerKategori.produksi },
    { name: 'Rilis', value: dynamicStats.selisihPerKategori.rilis },
    { name: 'Stok Akhir', value: dynamicStats.selisihPerKategori.stokAkhir },
  ], [dynamicStats]);

  const volumeSelisihPerFasilitas = useMemo(() => [
    { name: 'Pabrik', value: 'selisihPerFasilitas' in dynamicStats ? (dynamicStats.selisihPerFasilitas?.pabrik || 0) : 0 },
    { name: 'Gudang', value: 'selisihPerFasilitas' in dynamicStats ? (dynamicStats.selisihPerFasilitas?.gudang || 0) : 0 },
  ], [dynamicStats]);

  const volumeSelisihPerLokasi = useMemo(() => 
    Object.entries(dynamicStats.selisihPerLokasi)
      .map(([name, value]) => ({
        name: name.length > 20 ? name.substring(0, 17) + '...' : name, // Truncate long names
        fullName: name,
        value,
      }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) // Sort by absolute value descending
      .slice(0, 10), // Limit to top 10
  [dynamicStats]);

  // Filter imported data based on selections
  const filteredData = useMemo(() => {
    if (importedData.length === 0) return [];

    return importedData.filter(item => {
      const matchesSearch = searchTerm === '' || 
        item.materialId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.materialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLokasi = selectedLokasi === 'All' || item.location === selectedLokasi;
      
      // Filter by Fasilitas (based on location name pattern)
      let matchesFasilitas = true;
      if (selectedFasilitas !== 'all') {
        const locationLower = (item.location || '').toLowerCase();
        if (selectedFasilitas === 'pabrik') {
          matchesFasilitas = locationLower.includes('pl') || locationLower.includes('cp');
        } else if (selectedFasilitas === 'gudang') {
          matchesFasilitas = !locationLower.includes('pl') && !locationLower.includes('cp');
        }
      }
      
      // Filter by Kategori (check if the selected category has non-zero values)
      let matchesKategori = true;
      if (selectedKategori !== 'all') {
        if (selectedKategori === 'stok awal') {
          matchesKategori = (item.stokAwal?.selisih || 0) !== 0;
        } else if (selectedKategori === 'produksi') {
          matchesKategori = (item.produksi?.selisih || 0) !== 0;
        } else if (selectedKategori === 'rilis') {
          matchesKategori = (item.rilis?.selisih || 0) !== 0;
        } else if (selectedKategori === 'stok akhir') {
          matchesKategori = (item.stokAkhir?.selisih || 0) !== 0;
        }
      }
      
      // Filter by Selisih (check if any category has non-zero selisih AND non-zero OPR)
      let matchesSelisih = true;
      if (selectedSelisih === 'ada selisih') {
        matchesSelisih = (
          ((item.stokAwal?.selisih || 0) !== 0 && (item.stokAwal?.opr || 0) !== 0) ||
          ((item.produksi?.selisih || 0) !== 0 && (item.produksi?.opr || 0) !== 0) ||
          ((item.rilis?.selisih || 0) !== 0 && (item.rilis?.opr || 0) !== 0) ||
          ((item.stokAkhir?.selisih || 0) !== 0 && (item.stokAkhir?.opr || 0) !== 0)
        );
      }
      
      return matchesSearch && matchesLokasi && matchesFasilitas && matchesKategori && matchesSelisih;
    });
  }, [importedData, searchTerm, selectedLokasi, selectedFasilitas, selectedKategori, selectedSelisih]);

  const handleExport = async () => {
    if (importedData.length > 0) {
      try {
        // Export all imported data in Excel format
        const exportData = importedData.map(item => ({
          'Material ID': item.materialId || '',
          'Material Name': item.materialName || '',
          'Location': item.location || '',
          'Stok Awal - OPR': item.stokAwal?.opr ?? 0,
          'Stok Awal - SAP': item.stokAwal?.sap ?? 0,
          'Stok Awal - Selisih': item.stokAwal?.selisih ?? 0,
          'Produksi - OPR': item.produksi?.opr ?? 0,
          'Produksi - SAP': item.produksi?.sap ?? 0,
          'Produksi - Selisih': item.produksi?.selisih ?? 0,
          'Rilis - OPR': item.rilis?.opr ?? 0,
          'Rilis - SAP': item.rilis?.sap ?? 0,
          'Rilis - Selisih': item.rilis?.selisih ?? 0,
          'Stok Akhir - OPR': item.stokAkhir?.opr ?? 0,
          'Stok Akhir - SAP': item.stokAkhir?.sap ?? 0,
          'Stok Akhir - Selisih': item.stokAkhir?.selisih ?? 0,
        }));
        
        console.log('Exporting data:', exportData.length, 'rows');
        console.log('Sample data:', exportData[0]);
        
        await exportToExcel(exportData, 'Material_Reconciliation.xlsx');
      } catch (error) {
        console.error('Export error:', error);
        alert('Gagal export data: ' + error);
      }
    }
  };

  const handleDataImport = async (data: MaterialData[]) => {
    setImportedData(data);
    
    // Save to database
    try {
      console.log('Saving data to database...', data.length, 'records');
      
      const response = await fetch('/api/material-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to save data');
      }

      const result = await response.json();
      console.log('Data saved to database successfully:', result);
      
      // Reload history and auto-select the new import
      const historyResponse = await fetch('/api/material-data?action=history');
      if (historyResponse.ok) {
        const dates = await historyResponse.json();
        // Sort dates to ensure latest is first
        const sortedDates = dates.sort((a: string, b: string) => 
          new Date(b).getTime() - new Date(a).getTime()
        );
        setHistoryDates(sortedDates);
        // Auto-select the newest date (should be the one we just imported)
        if (sortedDates.length > 0) {
          setSelectedDate(sortedDates[0]);
        }
      }
      
      alert(`✅ Data berhasil diimport dan disimpan ke database!\n\nTotal: ${result.count} records tersimpan`);
    } catch (error: any) {
      console.error('Error saving to database:', error);
      alert(`❌ Data berhasil diimport tetapi gagal disimpan ke database:\n\n${error.message}\n\nSilakan cek console untuk detail error.`);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64 flex-1 overflow-hidden">
        {/* Header */}
        <Header
          title="Laporan Material"
          subtitle="Laporan material terintegrasi dengan SAP"
        />

        {/* Content Area with proper overflow */}
        <div className="p-8 space-y-6 overflow-x-hidden">
          {/* History Selector - Show if there are multiple imports */}
          {historyDates.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="text-blue-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Pilih Data Import</p>
                    <p className="text-xs text-gray-500">Menampilkan 2 data import terakhir</p>
                  </div>
                </div>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {historyDates.map((date, index) => (
                    <option key={date} value={date}>
                      {index === 0 ? '📌 ' : ''}
                      {new Date(date).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {index === 0 ? ' (Terbaru)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Excel Import Section */}
          <ExcelImport onDataImport={handleDataImport} />

          {/* Show loading message */}
          {isLoading && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                <p className="text-sm text-gray-600">Memuat data...</p>
              </div>
            </div>
          )}

          {/* Show message if no data */}
          {!isLoading && importedData.length === 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-blue-600" size={24} />
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 mb-1">Import Data Excel</h3>
                  <p className="text-sm text-blue-700">
                    Silakan import file Excel untuk melihat visualisasi data material dan statistik rekonsiliasi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Material Pivot Table - Show if data is imported */}
          {importedData.length > 0 && (
            <>
              {/* Rekonsiliasi Volume Produksi Section */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
                  <div>
                    <h2 className="text-2xl font-bold text-red-700 mb-2">
                      Rekonsiliasi Volume Produksi
                    </h2>
                    <p className="text-sm text-gray-700 mb-1">
                      PT Semen Indonesia (Persero) Tbk
                    </p>
                    <p className="text-sm text-gray-600">Pabrik Tuban & Gresik</p>
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg transition-colors shadow-md"
                  >
                    <Download size={18} />
                    <span className="font-medium">Export Data</span>
                  </button>
                </div>

                {/* Summary Cards Grid - 2x2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 pb-0">
                  {/* Total Volume Selisih */}
                  <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <TrendingDown className="text-red-600" size={20} />
                      </div>
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Total Volume Selisih</p>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {dynamicStats.totalSelisih.toLocaleString('id-ID')}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Dari {additionalMetrics.totalMaterials} material
                    </p>
                  </div>

                  {/* Total Materials */}
                  <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Package className="text-red-600" size={20} />
                      </div>
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Total Material</p>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {additionalMetrics.totalMaterials}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Jenis Material Unik
                    </p>
                  </div>

                  {/* Total Locations */}
                  <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <MapPin className="text-red-600" size={20} />
                      </div>
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Total Lokasi</p>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {additionalMetrics.totalLocations}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Locations
                    </p>
                  </div>

                  {/* Average Selisih */}
                  <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Calculator className="text-red-600" size={20} />
                      </div>
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Rata-rata Selisih</p>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {additionalMetrics.avgSelisihPerMaterial.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Per Material
                    </p>
                  </div>
                </div>

                {/* Charts Grid - 2 columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 pt-4 pb-6">
                  {/* Volume Selisih per Kategori */}
                  <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <FolderOpen className="text-red-600" size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Volume Selisih per Kategori</p>
                        <p className="text-xs text-gray-500">4 Kategori Stok</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={volumeSelisihPerKategori} layout="vertical" margin={{ left: 0, right: 10 }}>
                        <XAxis type="number" hide />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={100} 
                          tick={{ fontSize: 12, fontWeight: 500 }} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip 
                          formatter={(value) => value ? value.toLocaleString('id-ID') : '0'}
                          contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="value" fill="#DC2626" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Volume Selisih per Lokasi */}
                  <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <Navigation className="text-red-600" size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">Volume Selisih per Lokasi</p>
                          <p className="text-xs text-gray-500">Top 10 Lokasi dengan Selisih Tertinggi</p>
                        </div>
                      </div>
                      {additionalMetrics.highestSelisihLocation.location !== 'N/A' && (
                        <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <p className="text-xs text-red-600 font-medium">
                            Tertinggi: {additionalMetrics.highestSelisihLocation.location.substring(0, 15)}...
                          </p>
                        </div>
                      )}
                    </div>
                    {volumeSelisihPerLokasi.length > 0 ? (
                      <ResponsiveContainer width="100%" height={Math.max(300, volumeSelisihPerLokasi.length * 30)}>
                        <BarChart data={volumeSelisihPerLokasi} layout="vertical" margin={{ left: 0, right: 20 }}>
                          <XAxis type="number" hide />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={150} 
                            tick={{ fontSize: 11, fontWeight: 500 }} 
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            formatter={(value) => value ? value.toLocaleString('id-ID') : '0'}
                            labelFormatter={(label) => {
                              const item = volumeSelisihPerLokasi.find(i => i.name === label);
                              return item?.fullName || label;
                            }}
                            contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                          />
                          <Bar dataKey="value" fill="#DC2626" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-12">No data available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Filters Row - 3 filters like in design */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Search Material */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search Material"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white shadow-sm"
                  />
                </div>

                {/* Fasilitas Filter */}
                <select
                  value={selectedFasilitas}
                  onChange={(e) => setSelectedFasilitas(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white shadow-sm appearance-none cursor-pointer"
                >
                  <option value="all">fasilitas: all</option>
                  <option value="pabrik">fasilitas: pabrik</option>
                  <option value="gudang">fasilitas: gudang</option>
                </select>

                {/* Kategori Filter */}
                <select
                  value={selectedKategori}
                  onChange={(e) => setSelectedKategori(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white shadow-sm appearance-none cursor-pointer"
                >
                  <option value="all">kategori: all</option>
                  <option value="stok awal">kategori: stok awal</option>
                  <option value="produksi">kategori: produksi</option>
                  <option value="rilis">kategori: rilis</option>
                  <option value="stok akhir">kategori: stok akhir</option>
                </select>

                {/* Selisih Filter */}
                <select
                  value={selectedSelisih}
                  onChange={(e) => setSelectedSelisih(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white shadow-sm appearance-none cursor-pointer"
                >
                  <option value="all">selisih: all</option>
                  <option value="ada selisih">selisih: ada selisih</option>
                </select>

                {/* Lokasi Filter */}
                <select
                  value={selectedLokasi}
                  onChange={(e) => setSelectedLokasi(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white shadow-sm appearance-none cursor-pointer"
                >
                  {uniqueLocations.map(l => (
                    <option key={l} value={l}>lokasi: {l === 'All' ? 'all' : l}</option>
                  ))}
                </select>
              </div>

              {/* Perbandingan Stok per Material Table */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                  <h3 className="text-lg font-bold text-red-600">Perbandingan Stok per Material</h3>
                </div>
                <MaterialPivotTable data={filteredData} selectedKategori={selectedKategori} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
