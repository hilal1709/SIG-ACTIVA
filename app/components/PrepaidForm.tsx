'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PrepaidData {
  id?: number;
  companyCode: string;
  noPo: string;
  alokasi: string;
  kdAkr: string;
  namaAkun: string;
  deskripsi: string;
  klasifikasi: string;
  totalAmount: string;
  startDate: string;
  period: string;
  periodUnit: string;
  type: string;
  vendor: string;
  costCenter: string;
  headerText: string;
}

interface PrepaidFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: any;
  mode?: 'create' | 'edit';
}

export default function PrepaidForm({ isOpen, onClose, onSuccess, editData, mode = 'create' }: PrepaidFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PrepaidData>({
    companyCode: '',
    noPo: '',
    alokasi: '',
    kdAkr: '',
    namaAkun: '',
    deskripsi: '',
    klasifikasi: '',
    totalAmount: '',
    startDate: '',
    period: '',
    periodUnit: 'bulan',
    type: 'Linear',
    vendor: '',
    costCenter: '',
    headerText: ''
  });

  // Load data when in edit mode
  useEffect(() => {
    if (mode === 'edit' && editData) {
      setFormData({
        id: editData.id,
        companyCode: editData.companyCode || '',
        noPo: editData.noPo || '',
        alokasi: editData.alokasi || '',
        kdAkr: editData.kdAkr || '',
        namaAkun: editData.namaAkun || '',
        deskripsi: editData.deskripsi || '',
        klasifikasi: editData.klasifikasi || '',
        totalAmount: editData.totalAmount?.toString() || '',
        startDate: editData.startDate?.split('T')[0] || '',
        period: editData.period?.toString() || '',
        periodUnit: editData.periodUnit || 'bulan',
        type: editData.type || 'Linear',
        vendor: editData.vendor || '',
        costCenter: editData.costCenter || '',
        headerText: editData.headerText || ''
      });
    } else {
      // Reset form for create mode
      setFormData({
        companyCode: '',
        noPo: '',
        alokasi: '',
        kdAkr: '',
        namaAkun: '',
        deskripsi: '',
        klasifikasi: '',
        totalAmount: '',
        startDate: '',
        period: '',
        periodUnit: 'bulan',
        type: 'Linear',
        vendor: '',
        costCenter: '',
        headerText: ''
      });
    }
  }, [mode, editData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = mode === 'edit' && formData.id 
        ? `/api/prepaid?id=${formData.id}` 
        : '/api/prepaid';
      
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          totalAmount: parseFloat(formData.totalAmount),
          period: parseInt(formData.period),
        }),
      });

      if (response.ok) {
        alert(`Data prepaid berhasil ${mode === 'edit' ? 'diupdate' : 'ditambahkan'}!`);
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Gagal menyimpan data'}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Terjadi kesalahan saat menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-800">
            {mode === 'edit' ? 'Edit Data Prepaid' : 'Tambah Data Prepaid'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Code
              </label>
              <input
                type="text"
                name="companyCode"
                value={formData.companyCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Masukkan company code"
              />
            </div>

            {/* No PO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                No PO
              </label>
              <input
                type="text"
                name="noPo"
                value={formData.noPo}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Masukkan nomor PO"
              />
            </div>

            {/* Assignment/Order (Alokasi) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment/Order <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="alokasi"
                value={formData.alokasi}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Masukkan assignment/order"
              />
            </div>

            {/* Kode Akun Prepaid */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kode Akun Prepaid <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="kdAkr"
                value={formData.kdAkr}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Contoh: 1401001"
              />
            </div>

            {/* Kode Akun Biaya */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kode Akun Biaya <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="namaAkun"
                value={formData.namaAkun}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Contoh: Prepaid Insurance"
              />
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Nama vendor"
              />
            </div>

            {/* Klasifikasi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Klasifikasi
              </label>
              <input
                type="text"
                name="klasifikasi"
                value={formData.klasifikasi}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Contoh: Insurance, Rent, Service"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Total amount"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Periode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Periode <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="period"
                  value={formData.period}
                  onChange={handleChange}
                  required
                  min="1"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="12"
                />
                <select
                  name="periodUnit"
                  value={formData.periodUnit}
                  onChange={handleChange}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="bulan">Bulan</option>
                  <option value="tahun">Tahun</option>
                </select>
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="Linear">Linear</option>
                <option value="Verbal">Verbal</option>
              </select>
            </div>

            {/* Cost Center */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Center
              </label>
              <input
                type="text"
                name="costCenter"
                value={formData.costCenter}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Contoh: CC-001"
              />
            </div>

            {/* Header Text */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Header Text (untuk jurnal SAP)
              </label>
              <input
                type="text"
                name="headerText"
                value={formData.headerText}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Header text untuk jurnal SAP"
              />
            </div>

            {/* Deskripsi */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi
              </label>
              <textarea
                name="deskripsi"
                value={formData.deskripsi}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                placeholder="Deskripsi prepaid"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
