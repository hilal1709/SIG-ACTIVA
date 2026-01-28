'use client';

import React from 'react';
import { Download } from 'lucide-react';

interface MaterialData {
  materialId: string;
  materialName: string;
  location: string;
  stokAwal: {
    opr: number;
    sap: number;
    selisih: number;
    total: number;
  };
  produksi: {
    opr: number;
    sap: number;
    selisih: number;
    total: number;
  };
  rilis: {
    opr: number;
    sap: number;
    selisih: number;
    total: number;
  };
  stokAkhir: {
    opr: number;
    sap: number;
    selisih: number;
    total: number;
  };
  blank: number;
  blankTotal: number;
  grandTotal: number;
}

interface MaterialPivotTableProps {
  data: MaterialData[];
  selectedKategori?: string;
}

export default function MaterialPivotTable({ data, selectedKategori = 'all' }: MaterialPivotTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 border border-gray-200">
        <p className="text-center text-gray-500">Tidak ada data untuk ditampilkan. Silakan import file Excel terlebih dahulu.</p>
      </div>
    );
  }

  // Determine which categories to show based on filter
  const showStokAwal = selectedKategori === 'all' || selectedKategori === 'stok awal';
  const showProduksi = selectedKategori === 'all' || selectedKategori === 'produksi';
  const showRilis = selectedKategori === 'all' || selectedKategori === 'rilis';
  const showStokAkhir = selectedKategori === 'all' || selectedKategori === 'stok akhir';

  // Group data by material
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.materialId]) {
      acc[item.materialId] = {
        materialId: item.materialId,
        materialName: item.materialName,
        locations: []
      };
    }
    acc[item.materialId].locations.push(item);
    return acc;
  }, {} as Record<string, { materialId: string; materialName: string; locations: MaterialData[] }>);

  const formatNumber = (num: number) => {
    if (num === 0) return '0';
    return num.toLocaleString('id-ID');
  };

  const getCellClass = (value: number) => {
    if (value < 0) return 'text-red-600 font-medium';
    if (value > 0) return 'text-green-600 font-medium';
    return 'text-black';
  };

  const formatSelisih = (selisih: number, sap: number, applyFilter: boolean = true) => {
    // If filter is disabled, always show the value
    if (!applyFilter) {
      return formatNumber(selisih);
    }
    
    // If SAP is 0, show selisih if non-zero
    if (sap === 0) {
      return selisih !== 0 ? formatNumber(selisih) : '-';
    }
    // Calculate percentage
    const percentage = Math.abs((selisih / sap) * 100);
    // Only show if > 5%
    if (percentage > 5) {
      return formatNumber(selisih);
    }
    return '-';
  };

  const handleExport = () => {
    // Create CSV content
    const headers = [
      'Material ID', 'Material Name', 'Location',
      'Stok Awal OPR', 'Stok Awal SAP', 'Stok Awal Selisih', 'Stok Awal Total',
      'Produksi OPR', 'Produksi SAP', 'Produksi Selisih', 'Produksi Total',
      'Rilis OPR', 'Rilis SAP', 'Rilis Selisih', 'Rilis Total',
      'Stok Akhir OPR', 'Stok Akhir SAP', 'Stok Akhir Selisih', 'Stok Akhir Total',
      'Blank', 'Blank Total', 'Grand Total'
    ];

    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        row.materialId,
        `"${row.materialName}"`,
        `"${row.location}"`,
        row.stokAwal.opr,
        row.stokAwal.sap,
        row.stokAwal.selisih,
        row.stokAwal.total,
        row.produksi.opr,
        row.produksi.sap,
        row.produksi.selisih,
        row.produksi.total,
        row.rilis.opr,
        row.rilis.sap,
        row.rilis.selisih,
        row.rilis.total,
        row.stokAkhir.opr,
        row.stokAkhir.sap,
        row.stokAkhir.selisih,
        row.stokAkhir.total,
        row.blank,
        row.blankTotal,
        row.grandTotal
      ].join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Material_Data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="overflow-hidden">
      {/* Table with proper scroll - contained within parent */}
      <div className="overflow-x-auto w-full relative" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <table className="text-xs border-collapse w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-300" style={{ position: 'sticky', top: 0, zIndex: 60 }}>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th rowSpan={2} style={{ 
                position: 'sticky', 
                left: 0, 
                zIndex: 70,
                minWidth: '180px',
                maxWidth: '180px',
                width: '180px',
                backgroundColor: '#f3f4f6',
                boxShadow: '4px 0 8px rgba(0,0,0,0.1)'
              }} className="px-2 py-2 text-left font-semibold text-black border-r-2 border-gray-400">
                Row Labels
              </th>
              {showStokAwal && (
                <th colSpan={3} className="px-1 py-1.5 text-center font-semibold text-black border-r border-gray-300 bg-blue-50 whitespace-nowrap text-xs">
                  1 - Stok Awal
                </th>
              )}
              {showProduksi && (
                <th colSpan={3} className="px-1 py-1.5 text-center font-semibold text-black border-r border-gray-300 bg-green-50 whitespace-nowrap text-xs">
                  2 - Produksi
                </th>
              )}
              {showRilis && (
                <th colSpan={3} className="px-1 py-1.5 text-center font-semibold text-black border-r border-gray-300 bg-yellow-50 whitespace-nowrap text-xs">
                  3 - Rilis
                </th>
              )}
              {showStokAkhir && (
                <th colSpan={3} className="px-1 py-1.5 text-center font-semibold text-black border-r border-gray-300 bg-purple-50 whitespace-nowrap text-xs">
                  4 - Stok Akhir
                </th>
              )}
            </tr>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              {/* Stok Awal */}
              {showStokAwal && (
                <>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-blue-50 whitespace-nowrap text-xs">OPR</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-blue-50 whitespace-nowrap text-xs">SAP</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-300 bg-blue-50 whitespace-nowrap text-xs">Selisih</th>
                </>
              )}
              {/* Produksi */}
              {showProduksi && (
                <>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-green-50 whitespace-nowrap text-xs">OPR</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-green-50 whitespace-nowrap text-xs">SAP</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-300 bg-green-50 whitespace-nowrap text-xs">Selisih</th>
                </>
              )}
              {/* Rilis */}
              {showRilis && (
                <>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-yellow-50 whitespace-nowrap text-xs">OPR</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-yellow-50 whitespace-nowrap text-xs">SAP</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-300 bg-yellow-50 whitespace-nowrap text-xs">Selisih</th>
                </>
              )}
              {/* Stok Akhir */}
              {showStokAkhir && (
                <>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-purple-50 whitespace-nowrap text-xs">OPR</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-200 bg-purple-50 whitespace-nowrap text-xs">SAP</th>
                  <th className="px-1 py-1.5 text-center font-medium text-black border-r border-gray-300 bg-purple-50 whitespace-nowrap text-xs">Selisih</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.values(groupedData).map((material, idx) => (
              <React.Fragment key={idx}>
                {/* Material Header Row - Fixed to only first column */}
                <tr className="bg-orange-50 border-t border-b-2 border-gray-400">
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 40,
                    minWidth: '180px',
                    maxWidth: '180px',
                    width: '180px',
                    backgroundColor: '#fff7ed',
                    boxShadow: '4px 0 8px rgba(0,0,0,0.15)',
                    fontWeight: 'bold'
                  }} className="px-2 py-2 text-black text-xs border-r-2 border-gray-500">
                    {material.materialId} | {material.materialName}
                  </td>
                  {/* Empty cells for other columns to maintain table structure */}
                  <td colSpan={
                    (showStokAwal ? 3 : 0) + 
                    (showProduksi ? 3 : 0) + 
                    (showRilis ? 3 : 0) + 
                    (showStokAkhir ? 3 : 0)
                  } className="bg-orange-50"></td>
                </tr>
                {/* Location Rows */}
                {material.locations.map((loc, locIdx) => (
                  <tr key={locIdx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      minWidth: '180px',
                      maxWidth: '180px',
                      width: '180px',
                      backgroundColor: 'white',
                      boxShadow: '4px 0 8px rgba(0,0,0,0.08)'
                    }} className="px-2 py-1.5 text-black border-r-2 border-gray-400 pl-4 text-xs hover:bg-gray-50">
                      {loc.location}
                    </td>
                    {/* Stok Awal */}
                    {showStokAwal && (
                      <>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.stokAwal.opr)}</td>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.stokAwal.sap)}</td>
                        <td className={`px-1 py-1.5 text-right border-r border-gray-300 whitespace-nowrap text-xs ${getCellClass(loc.stokAwal.selisih)}`}>
                          {formatSelisih(loc.stokAwal.selisih, loc.stokAwal.sap)}
                        </td>
                      </>
                    )}
                    {/* Produksi */}
                    {showProduksi && (
                      <>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.produksi.opr)}</td>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.produksi.sap)}</td>
                        <td className={`px-1 py-1.5 text-right border-r border-gray-300 whitespace-nowrap text-xs ${getCellClass(loc.produksi.selisih)}`}>
                          {formatSelisih(loc.produksi.selisih, loc.produksi.sap, false)}
                        </td>
                      </>
                    )}
                    {/* Rilis */}
                    {showRilis && (
                      <>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.rilis.opr)}</td>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.rilis.sap)}</td>
                        <td className={`px-1 py-1.5 text-right border-r border-gray-300 whitespace-nowrap text-xs ${getCellClass(loc.rilis.selisih)}`}>
                          {formatSelisih(loc.rilis.selisih, loc.rilis.sap, false)}
                        </td>
                      </>
                    )}
                    {/* Stok Akhir */}
                    {showStokAkhir && (
                      <>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.stokAkhir.opr)}</td>
                        <td className="px-1 py-1.5 text-right border-r border-gray-200 whitespace-nowrap text-black text-xs">{formatNumber(loc.stokAkhir.sap)}</td>
                        <td className={`px-1 py-1.5 text-right border-r border-gray-300 whitespace-nowrap text-xs ${getCellClass(loc.stokAkhir.selisih)}`}>
                          {formatSelisih(loc.stokAkhir.selisih, loc.stokAkhir.sap)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
