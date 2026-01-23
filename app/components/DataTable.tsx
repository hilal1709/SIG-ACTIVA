'use client';

interface MaterialData {
  id: string;
  name: string;
  stokAwal: { ops: string; sap: string; selisih: string };
  produksi: { ops: string; sap: string; selisih: string };
  jenis: { ops: string; sap: string; selisih: string };
  akhir: { ops: string };
}

interface DataTableProps {
  data: MaterialData[];
}

export default function DataTable({ data }: DataTableProps) {
  const getCellClass = (value: string) => {
    if (value === '0' || value === '0.0') return 'text-gray-800';
    if (value.startsWith('-')) return 'text-red-600 font-medium';
    const numValue = parseFloat(value.replace(/,/g, ''));
    if (!isNaN(numValue) && numValue > 0) return 'text-yellow-600 font-medium';
    return 'text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                Material_ID
              </th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-semibold text-gray-700 border-r border-gray-200">
                1 - Stok Awal
              </th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-semibold text-gray-700 border-r border-gray-200">
                2 - Produksi
              </th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-semibold text-gray-700 border-r border-gray-200">
                3 - Jenis
              </th>
              <th rowSpan={2} className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                4 - 1
              </th>
            </tr>
            <tr>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50">OPS</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50">SAP</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50 border-r border-gray-200">Selisih</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50">OPS</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50">SAP</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50 border-r border-gray-200">Selisih</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50">OPS</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50">SAP</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50 border-r border-gray-200">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 text-sm border-r border-gray-200">
                  <div className="font-semibold text-gray-800">{row.id}</div>
                  <div className="text-xs text-gray-500">{row.name}</div>
                </td>
                {/* Stok Awal */}
                <td className="px-4 py-3 text-sm text-right">{row.stokAwal.ops}</td>
                <td className="px-4 py-3 text-sm text-right">{row.stokAwal.sap}</td>
                <td className={`px-4 py-3 text-sm text-right border-r border-gray-200 ${getCellClass(row.stokAwal.selisih)}`}>
                  {row.stokAwal.selisih}
                </td>
                {/* Produksi */}
                <td className="px-4 py-3 text-sm text-right">{row.produksi.ops}</td>
                <td className="px-4 py-3 text-sm text-right">{row.produksi.sap}</td>
                <td className={`px-4 py-3 text-sm text-right border-r border-gray-200 ${getCellClass(row.produksi.selisih)}`}>
                  {row.produksi.selisih}
                </td>
                {/* Jenis */}
                <td className="px-4 py-3 text-sm text-right">{row.jenis.ops}</td>
                <td className="px-4 py-3 text-sm text-right">{row.jenis.sap}</td>
                <td className={`px-4 py-3 text-sm text-right border-r border-gray-200 ${getCellClass(row.jenis.selisih)}`}>
                  {row.jenis.selisih}
                </td>
                {/* Akhir */}
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{row.akhir.ops}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
