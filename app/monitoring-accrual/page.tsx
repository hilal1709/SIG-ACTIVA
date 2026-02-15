'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Download, Plus, MoreVertical, X, Edit2, Trash2, Upload, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { exportToCSV } from '../utils/exportUtils';
import { KODE_AKUN_KLASIFIKASI } from '../utils/accrualKlasifikasi';

// Lazy load components yang tidak critical untuk initial render
const Sidebar = dynamic(() => import('../components/Sidebar'), { 
  ssr: false,
  loading: () => <div className="w-64 bg-gray-900 animate-pulse" />
});
const Header = dynamic(() => import('../components/Header'), {
  ssr: false,
  loading: () => <div className="h-20 bg-white border-b animate-pulse" />
});

// Lazy load Excel libraries untuk mengurangi bundle size awal
let XLSX: any = null;
let ExcelJS: any = null;

const loadExcelLibraries = async () => {
  if (!XLSX) {
    XLSX = (await import('xlsx')).default;
  }
  if (!ExcelJS) {
    ExcelJS = (await import('exceljs')).default;
  }
  return { XLSX, ExcelJS };
};

interface AccrualPeriode {
  id: number;
  periodeKe: number;
  bulan: string;
  tahun: number;
  amountAccrual: number;
  totalRealisasi?: number;
  saldo?: number;
}

interface Accrual {
  id: number;
  companyCode?: string;
  noPo?: string;
  kdAkr: string;
  alokasi?: string;
  kdAkunBiaya: string;
  vendor: string;
  deskripsi: string;
  headerText?: string;
  klasifikasi?: string;
  totalAmount: number;
  costCenter?: string;
  startDate: string;
  jumlahPeriode: number;
  pembagianType: string;
  periodes?: AccrualPeriode[];
}

interface AccrualFormData {
  companyCode: string;
  noPo: string;
  assignment: string;
  kdAkr: string;
  kdAkunBiaya: string;
  vendor: string;
  deskripsi: string;
  headerText: string;
  klasifikasi: string;
  totalAmount: string;
  costCenter: string;
  startDate: string;
  jumlahPeriode: string;
  pembagianType: string;
  periodeAmounts: string[]; // For manual input
}

interface RealisasiFormData {
  tanggalRealisasi: string;
  amount: string;
  keterangan: string;
}

interface RealisasiData {
  id: number;
  tanggalRealisasi: string;
  amount: number;
  keterangan?: string;
}

// Standalone helper function to calculate accrual (can be used outside React component)
function calculateAccrualAmount(item: Accrual): number {
  if (!item.periodes || item.periodes.length === 0) return 0;
  
  if (item.pembagianType === 'manual') {
    return item.periodes.reduce((sum, p) => sum + p.amountAccrual, 0);
  }
  
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const bulanMap: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
    'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11
  };
  
  let totalAccrual = 0;
  let rollover = 0; // Track rollover to calculate effective realisasi
  
  for (let i = 0; i < item.periodes.length; i++) {
    const p = item.periodes[i];
    const [bulanName, tahunStr] = p.bulan.split(' ');
    const periodeBulan = bulanMap[bulanName];
    const periodeTahun = parseInt(tahunStr);
    const periodeDateOnly = new Date(periodeTahun, periodeBulan, 1);
    
    // Calculate effective realisasi with rollover (amountAccrual negatif, cap pakai abs)
    const realisasiPeriode = p.totalRealisasi ?? 0;
    const totalAvailable = realisasiPeriode + rollover;
    const capAccrual = Math.abs(p.amountAccrual);
    const effectiveRealisasi = Math.min(totalAvailable, capAccrual);
    const newRollover = Math.max(0, totalAvailable - capAccrual);
    
    const isPeriodDue = todayDate >= periodeDateOnly;
    
    // Recognize accrual ONLY if:
    // 1. Period is due (date has passed), OR
    // 2. There is effective realisasi in this period (from direct input or rollover)
    const hasEffectiveRealisasi = effectiveRealisasi > 0;
    const shouldRecognize = isPeriodDue || hasEffectiveRealisasi;
    
    if (shouldRecognize) {
      totalAccrual += p.amountAccrual;
    }
    
    // Update rollover for next iteration
    rollover = newRollover;
  }
  
  return totalAccrual;
}

export default function MonitoringAccrualPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [accrualData, setAccrualData] = useState<Accrual[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number | string>>(new Set());
  const [expandedKodeAkun, setExpandedKodeAkun] = useState<Set<string>>(new Set());
  const [expandedVendor, setExpandedVendor] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState<AccrualFormData>({
    companyCode: '',
    noPo: '',
    assignment: '',
    kdAkr: '',
    kdAkunBiaya: '',
    vendor: '',
    deskripsi: '',
    headerText: '',
    klasifikasi: '',
    totalAmount: '',
    costCenter: '',
    startDate: '',
    jumlahPeriode: '12',
    pembagianType: 'otomatis',
    periodeAmounts: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [showRealisasiModal, setShowRealisasiModal] = useState(false);
  const [selectedPeriode, setSelectedPeriode] = useState<AccrualPeriode | null>(null);
  const [realisasiViewOnly, setRealisasiViewOnly] = useState(false);
  const [realisasiData, setRealisasiData] = useState<RealisasiData[]>([]);
  const [realisasiForm, setRealisasiForm] = useState<RealisasiFormData>({
    tanggalRealisasi: new Date().toISOString().split('T')[0],
    amount: '',
    keterangan: '',
  });
  const [submittingRealisasi, setSubmittingRealisasi] = useState(false);
  const [editingRealisasiId, setEditingRealisasiId] = useState<number | null>(null);
  const [editingPeriodeId, setEditingPeriodeId] = useState<number | null>(null);
  const [editPeriodeAmount, setEditPeriodeAmount] = useState<string>('');
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [showImportGlobalModal, setShowImportGlobalModal] = useState(false);
  const [uploadingGlobalExcel, setUploadingGlobalExcel] = useState(false);
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);
  const [uploadingImportExcel, setUploadingImportExcel] = useState(false);
  // Portal dropdown Jurnal SAP (agar tidak tertutup header tabel)
  const [openJurnalRect, setOpenJurnalRect] = useState<{ top: number; right: number; bottom: number; left: number } | null>(null);
  const [openJurnalItem, setOpenJurnalItem] = useState<Accrual | null>(null);

  const closeJurnalDropdown = useCallback(() => {
    setOpenJurnalRect(null);
    setOpenJurnalItem(null);
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.forEach(id => { if (typeof id === 'string' && id.startsWith('jurnal-')) next.delete(id); });
      return next;
    });
  }, []);

  // Get available klasifikasi based on selected kode akun
  const availableKlasifikasi = useMemo(() => {
    if (!formData.kdAkr) return [];
    return KODE_AKUN_KLASIFIKASI[formData.kdAkr] || [];
  }, [formData.kdAkr]);

  // Debounce search term for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load user role from localStorage
  useEffect(() => {
    const role = localStorage.getItem('userRole') || '';
    console.log('User Role loaded:', role);
    setUserRole(role);
    setIsRoleLoaded(true);
  }, []);

  // Check if user can edit (only ADMIN_SYSTEM and STAFF_ACCOUNTING)
  const canEdit = userRole === 'ADMIN_SYSTEM' || userRole === 'STAFF_ACCOUNTING';
  
  // Debug log untuk memastikan nilai
  useEffect(() => {
    if (isRoleLoaded) {
      console.log('Can Edit:', canEdit, 'User Role:', userRole);
    }
  }, [canEdit, userRole, isRoleLoaded]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside dropdown (trigger button) or portal menu
      if (!target.closest('.jurnal-dropdown-container') && !target.closest('.jurnal-dropdown-menu')) {
        setOpenJurnalRect(null);
        setOpenJurnalItem(null);
        setExpandedRows(prev => {
          const newSet = new Set(prev);
          // Remove all jurnal dropdown states
          Array.from(newSet).forEach(id => {
            if (typeof id === 'string' && id.startsWith('jurnal-')) {
              newSet.delete(id);
            }
          });
          return newSet.size !== prev.size ? newSet : prev;
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper function to calculate accrual (memoized for better performance)
  const calculateItemAccrual = useCallback((item: Accrual) => {
    return calculateAccrualAmount(item);
  }, []);

  // Helper function to calculate periode allocations with rollover
  const calculatePeriodeAllocations = useCallback((periodes: AccrualPeriode[]) => {
    if (!periodes || periodes.length === 0) return [];
    
    let rollover = 0;
    const capAccrual = (p: AccrualPeriode) => Math.abs(p.amountAccrual);
    return periodes.map((periode) => {
      const realisasiPeriode = periode.totalRealisasi || 0;
      const totalAvailable = realisasiPeriode + rollover;
      const effectiveRealisasi = Math.min(totalAvailable, capAccrual(periode));
      const saldo = periode.amountAccrual + effectiveRealisasi; // Saldo = accrual (negatif) + realisasi (positif)
      const rolloverOut = Math.max(0, totalAvailable - capAccrual(periode));
      
      const result = {
        ...periode,
        totalRealisasi: effectiveRealisasi,
        saldo
      };
      
      rollover = rolloverOut;
      return result;
    });
  }, []);

  // Helper function to calculate realisasi (memoized) - uses effective realisasi with rollover
  const calculateItemRealisasi = useCallback((item: Accrual) => {
    if (!item.periodes || item.periodes.length === 0) return 0;
    let rollover = 0;
    let total = 0;
    for (const periode of item.periodes) {
      const realisasiPeriode = periode.totalRealisasi || 0;
      const totalAvailable = realisasiPeriode + rollover;
      const capAccrual = Math.abs(periode.amountAccrual);
      const effectiveRealisasi = Math.min(totalAvailable, capAccrual);
      total += effectiveRealisasi;
      rollover = Math.max(0, totalAvailable - capAccrual);
    }
    return total;
  }, []);

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

  // Format currency helper (memoized)
  const formatCurrency = useCallback((amount: number) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absAmount);
    
    return isNegative ? `-${formatted}` : formatted;
  }, []);

  // Calculate totals (optimized with useMemo)
  const totalAccrual = useMemo(() => {
    return accrualData.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [accrualData]);
  
  const totalPeriodes = useMemo(() => {
    return accrualData.reduce((sum, item) => sum + (item.periodes?.length || 0), 0);
  }, [accrualData]);

  // Filter data (optimized with debounced search and cached toLowerCase)
  const filteredData = useMemo(() => {
    if (debouncedSearchTerm === '') return accrualData;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return accrualData.filter(item => {
      return item.kdAkr.toLowerCase().includes(searchLower) ||
        item.kdAkunBiaya.toLowerCase().includes(searchLower) ||
        item.vendor.toLowerCase().includes(searchLower) ||
        item.deskripsi.toLowerCase().includes(searchLower);
    });
  }, [accrualData, debouncedSearchTerm]);

  // Group data by kode akun accrual, then by vendor (dengan pre-calculated totals)
  const groupedByKodeAkun = useMemo(() => {
    const groups: Record<string, Record<string, Accrual[]>> = {};
    filteredData.forEach(item => {
      if (!groups[item.kdAkr]) {
        groups[item.kdAkr] = {};
      }
      if (!groups[item.kdAkr][item.vendor]) {
        groups[item.kdAkr][item.vendor] = [];
      }
      groups[item.kdAkr][item.vendor].push(item);
    });
    return groups;
  }, [filteredData]);

  // Pre-calculate totals untuk setiap item (cache untuk performa)
  const itemTotalsCache = useMemo(() => {
    const cache = new Map<number, { accrual: number; realisasi: number }>();
    filteredData.forEach(item => {
      cache.set(item.id, {
        accrual: calculateItemAccrual(item),
        realisasi: calculateItemRealisasi(item)
      });
    });
    return cache;
  }, [filteredData, calculateItemAccrual, calculateItemRealisasi]);

  const handleExport = () => {
    const headers = ['kdAkr', 'namaAkun', 'vendor', 'deskripsi', 'amount', 'accrDate', 'status'];
    exportToCSV(filteredData, 'Monitoring_Accrual.csv', headers);
  };

  const handleDownloadAllItemsReport = async () => {
    try {
      // Load ExcelJS on demand
      const { ExcelJS: ExcelJSLib } = await loadExcelLibraries();
      const workbook = new ExcelJSLib.Workbook();
      const worksheet = workbook.addWorksheet('Detail All Accruals');
    
    // Headers
    worksheet.getRow(1).height = 30;
    const headers = ['KODE AKUN', 'KLASIFIKASI', 'PEKERJAAN', 'VENDOR', 'PO/PR', 'ORDER', 'KETERANGAN', 'NILAI PO', 'DOC DATE', 'DELIV DATE', 'OUSTANDING'];
    
    worksheet.getRow(1).values = headers;
    worksheet.getRow(1).eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF404040' }
      };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    // Column widths
    worksheet.columns = [
      { width: 12 },  // KODE AKUN
      { width: 15 },  // KLASIFIKASI
      { width: 12 },  // PEKERJAAN
      { width: 35 },  // VENDOR
      { width: 15 },  // PO/PR
      { width: 15 },  // ORDER
      { width: 45 },  // KETERANGAN
      { width: 15 },  // NILAI PO
      { width: 12 },  // DOC DATE
      { width: 12 },  // DELIV DATE
      { width: 15 }   // OUSTANDING
    ];
    
    let currentRow = 2;
    
    // Loop through all items
    Object.entries(groupedByKodeAkun).forEach(([kodeAkun, vendorGroups]) => {
      Object.entries(vendorGroups).forEach(([vendor, items]) => {
        items.forEach((item) => {
          // Calculate total outstanding for this item using the standalone helper function
          const totalAccrual = calculateAccrualAmount(item);
          const totalRealisasi = item.periodes?.reduce((sum, p) => sum + (p.totalRealisasi || 0), 0) || 0;
          const totalOutstanding = totalAccrual + totalRealisasi; // accrual negatif, realisasi positif
          
          const row = worksheet.getRow(currentRow);
          
          row.getCell(1).value = item.kdAkr;
          row.getCell(2).value = item.klasifikasi?.toUpperCase() || 'TRANSPORTATION';
          row.getCell(3).value = item.klasifikasi || 'OA';
          row.getCell(4).value = item.vendor;
          row.getCell(5).value = item.noPo || '';
          row.getCell(6).value = item.alokasi || '';
          row.getCell(7).value = item.deskripsi;
          row.getCell(8).value = item.totalAmount;
          row.getCell(8).numFmt = '#,##0.000';
          
          // DOC DATE
          const docDate = new Date(item.startDate);
          row.getCell(9).value = `${docDate.getDate().toString().padStart(2, '0')}/${(docDate.getMonth() + 1).toString().padStart(2, '0')}/${docDate.getFullYear()}`;
          
          // DELIV DATE
          const endDate = new Date(item.startDate);
          endDate.setMonth(endDate.getMonth() + item.jumlahPeriode);
          row.getCell(10).value = `${endDate.getDate().toString().padStart(2, '0')}/${(endDate.getMonth() + 1).toString().padStart(2, '0')}/${endDate.getFullYear()}`;
          
          // OUTSTANDING
          row.getCell(11).value = totalOutstanding;
          row.getCell(11).numFmt = '#,##0.000';
          
          // Apply borders and styling
          for (let col = 1; col <= 11; col++) {
            const cell = row.getCell(col);
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            if (col === 8 || col === 11) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
          }
          
          currentRow++;
        });
      });
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Detail_All_Accruals_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Gagal membuat laporan. Silakan coba lagi.');
    }
  };

  const handleDownloadGlobalReport = async () => {
    try {
      // Load ExcelJS on demand
      const { ExcelJS: ExcelJSLib } = await loadExcelLibraries();
      const workbook = new ExcelJSLib.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Akrual');
    
    // Title - "Kebutuhan lain rekon akru utang AU exclude 21600001 dan 21600020 (SDM)"
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Kebutuhan lain rekon akru utang AU exclude 21600001 dan 21600020 (SDM)';
    titleCell.font = { name: 'Calibri', size: 11, bold: true };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' }
    };
    
    // Headers
    worksheet.getRow(2).height = 30;
    const headers = ['GL ACCOUNT', 'VENDOR', 'SUM OF AMOUNT IN LOC. CURR.'];
    
    worksheet.getRow(2).values = headers;
    worksheet.getRow(2).eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B0F0' }
      };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    // Column widths
    worksheet.columns = [
      { width: 15 },  // GL ACCOUNT
      { width: 40 },  // VENDOR
      { width: 25 }   // SUM OF AMOUNT
    ];
    
    let currentRow = 3;
    
    // Calculate summary data grouped by kdAkr (GL Account) and vendor
    const summaryData: Record<string, Record<string, number>> = {};
    
    Object.entries(groupedByKodeAkun).forEach(([kodeAkun, vendorGroups]) => {
      Object.entries(vendorGroups).forEach(([vendor, items]) => {
        items.forEach((item) => {
          const glAccount = item.kdAkr; // Using kode akun accrual
          const vendorName = item.vendor;
          
          // Calculate saldo same as display table: Total Accrual + Total Realisasi (accrual negatif, realisasi positif)
          const totalAccrual = calculateAccrualAmount(item);
          const totalRealisasi = calculateItemRealisasi(item);
          const totalSaldo = totalAccrual + totalRealisasi;
          
          // Group by GL Account and Vendor
          if (!summaryData[glAccount]) {
            summaryData[glAccount] = {};
          }
          if (!summaryData[glAccount][vendorName]) {
            summaryData[glAccount][vendorName] = 0;
          }
          summaryData[glAccount][vendorName] += totalSaldo;
        });
      });
    });
    
    // Sort GL Accounts
    const sortedGLAccounts = Object.keys(summaryData).sort();
    
    let totalGrandTotal = 0;
    
    // Loop through sorted GL Accounts
    sortedGLAccounts.forEach((glAccount) => {
      const vendors = summaryData[glAccount];
      const sortedVendors = Object.keys(vendors).sort();
      
      sortedVendors.forEach((vendor, index) => {
        const amount = vendors[vendor];
        totalGrandTotal += amount;
        
        const row = worksheet.getRow(currentRow);
        
        // Only show GL Account on first vendor row
        if (index === 0) {
          row.getCell(1).value = parseFloat(glAccount);
          row.getCell(1).numFmt = '0';
        } else {
          row.getCell(1).value = '';
        }
        
        row.getCell(2).value = vendor;
        row.getCell(3).value = amount;
        row.getCell(3).numFmt = '#,##0.00';
        
        // Add borders
        for (let col = 1; col <= 3; col++) {
          const cell = row.getCell(col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          if (col === 1) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (col === 2) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
        }
        
        currentRow++;
      });
    });
    
    // Add TOTAL row
    const totalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    const totalLabelCell = totalRow.getCell(1);
    totalLabelCell.value = 'TOTAL';
    totalLabelCell.font = { name: 'Calibri', size: 11, bold: true };
    totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B0F0' }
    };
    totalLabelCell.font = { ...totalLabelCell.font, color: { argb: 'FFFFFFFF' } };
    
    const totalAmountCell = totalRow.getCell(3);
    totalAmountCell.value = totalGrandTotal;
    totalAmountCell.numFmt = '#,##0.00';
    totalAmountCell.font = { name: 'Calibri', size: 11, bold: true };
    totalAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
    totalAmountCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B0F0' }
    };
    totalAmountCell.font = { ...totalAmountCell.font, color: { argb: 'FFFFFFFF' } };
    
    for (let col = 1; col <= 3; col++) {
      const cell = totalRow.getCell(col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap_Akrual_Global_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating global report:', error);
      alert('Gagal membuat laporan global. Silakan coba lagi.');
    }
  };

  const handleDownloadJurnalSAPPerItem = async (item: Accrual) => {
    try {
      // Load ExcelJS on demand
      const { ExcelJS: ExcelJSLib } = await loadExcelLibraries();
      
      // Use company code from item
      const companyCode = item.companyCode || '2000';
      
      if (!item.companyCode) {
        alert('Company code tidak ditemukan untuk item ini');
        return;
      }
      
      const workbook = new ExcelJSLib.Workbook();
    const worksheet = workbook.addWorksheet('Jurnal SAP');
    
    // Headers row 1 (field names)
    worksheet.getRow(1).height = 15;
    const headers1 = [
      'xblnr', 'bukrs', 'blart', 'bldat', 'budat', 'waers', 'kursf', 'bktxt', 
      'zuonr', 'hkont', 'wrbtr', 'sgtxt', 'prctr', 'kostl', '', 'nplnr', 'aufnr', 'valut', 'flag'
    ];
    
    // Header satu warna (ikuti line lain, tanpa kuning)
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFE699' } };
    
    worksheet.getRow(1).values = headers1;
    worksheet.getRow(1).eachCell((cell: any) => {
      cell.fill = headerFill;
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'bottom' };
    });
    
    // Headers row 2 (descriptions)
    worksheet.getRow(2).height = 15;
    const headers2 = [
      'Reference', 'company', 'doc type', 'doc date', 'posting date', 'currency', 'kurs', 
      'header text', 'Vendor/cu:', 'account', 'amount', 'line text', 'profit center', 
      'cost center', '', 'Network', 'order numi', 'value date', ''
    ];
    
    worksheet.getRow(2).values = headers2;
    worksheet.getRow(2).eachCell((cell: any) => {
      cell.fill = headerFill;
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'bottom' };
    });
    
    // Column widths
    worksheet.columns = [
      { width: 12 },  // xblnr
      { width: 10 },  // bukrs
      { width: 9 },   // blart
      { width: 9 },   // bldat
      { width: 12 },  // budat
      { width: 10 },  // waers
      { width: 8 },   // kursf
      { width: 30 },  // bktxt
      { width: 12 },  // zuonr
      { width: 12 },  // hkont
      { width: 15 },  // wrbtr
      { width: 30 },  // sgtxt
      { width: 12 },  // prctr
      { width: 12 },  // kostl
      { width: 3 },   // empty
      { width: 10 },  // nplnr
      { width: 12 },  // aufnr
      { width: 12 },  // valut
      { width: 5 }    // flag
    ];
    
    // Calculate total accrual for this single item
    const totalAccrual = item.periodes?.reduce((sum, p) => {
      if (item.pembagianType === 'manual') {
        return sum + p.amountAccrual;
      }
      
      // Untuk otomatis, cek tanggal periode saja
      // Parse bulan periode (format: "Jan 2026")
      const [bulanName, tahunStr] = p.bulan.split(' ');
      const bulanMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
        'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11
      };
      const periodeBulan = bulanMap[bulanName];
      const periodeTahun = parseInt(tahunStr);
      
      // Tanggal 1 bulan periode tersebut
      const today = new Date();
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const periodeDateOnly = new Date(periodeTahun, periodeBulan, 1);
      
      // Akui accrual jika sudah jatuh tempo ATAU jika sudah ada realisasi
      const totalRealisasi = p.totalRealisasi ?? 0;
      const hasRealisasi = totalRealisasi > 0;
      if (todayDate >= periodeDateOnly || hasRealisasi) {
        return sum + p.amountAccrual;
      }
      return sum;
    }, 0) || 0;
    
    const absTotalAccrual = Math.abs(totalAccrual);
    if (absTotalAccrual > 0) {
      // Parse tanggal from start date
      const startDate = new Date(item.startDate);
      const docDate = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`;
      const year = startDate.getFullYear();
      
      // Entry 1: DEBIT - Kode Akun Biaya (positive amount)
      const row1 = worksheet.getRow(3);
      row1.height = 15;
      
      row1.getCell(1).value = ''; // xblnr - kosong
      row1.getCell(2).value = companyCode; // bukrs
      row1.getCell(3).value = 'SA'; // blart
      row1.getCell(4).value = docDate; // bldat
      row1.getCell(5).value = docDate; // budat
      row1.getCell(6).value = 'IDR'; // waers
      row1.getCell(7).value = ''; // kursf
      row1.getCell(8).value = item.headerText || ''; // bktxt
      row1.getCell(9).value = ''; // zuonr
      row1.getCell(10).value = item.kdAkunBiaya; // hkont (expense account)
      row1.getCell(11).value = Math.round(absTotalAccrual); // wrbtr (positive)
      row1.getCell(11).numFmt = '0';
      row1.getCell(12).value = item.headerText || ''; // sgtxt
      row1.getCell(13).value = ''; // prctr
      row1.getCell(14).value = item.costCenter || ''; // kostl
      row1.getCell(15).value = ''; // empty
      row1.getCell(16).value = ''; // nplnr
      row1.getCell(17).value = ''; // aufnr
      row1.getCell(18).value = ''; // valut
      row1.getCell(19).value = 'G'; // flag
      
      // Apply font and alignment to all cells (NO BORDERS)
      for (let col = 1; col <= 19; col++) {
        const cell = row1.getCell(col);
        cell.font = { name: 'Aptos Narrow', size: 12 };
        if (col === 11) {
          cell.alignment = { horizontal: 'right', vertical: 'bottom' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'bottom' };
        }
      }
      
      // Entry 2: KREDIT - Kode Akun Accrual (negative amount)
      const row2 = worksheet.getRow(4);
      row2.height = 15;
      
      row2.getCell(1).value = ''; // xblnr - kosong
      row2.getCell(2).value = companyCode; // bukrs
      row2.getCell(3).value = 'SA'; // blart
      row2.getCell(4).value = docDate; // bldat
      row2.getCell(5).value = docDate; // budat
      row2.getCell(6).value = 'IDR'; // waers
      row2.getCell(7).value = ''; // kursf
      row2.getCell(8).value = item.headerText || ''; // bktxt
      row2.getCell(9).value = ''; // zuonr
      row2.getCell(10).value = item.kdAkr; // hkont (accrual account)
      row2.getCell(11).value = -Math.round(absTotalAccrual); // wrbtr (negative)
      row2.getCell(11).numFmt = '0';
      row2.getCell(12).value = item.headerText || ''; // sgtxt
      row2.getCell(13).value = ''; // prctr
      row2.getCell(14).value = ''; // kostl - kosongkan untuk akun accrual
      row2.getCell(15).value = ''; // empty
      row2.getCell(16).value = ''; // nplnr
      row2.getCell(17).value = ''; // aufnr
      row2.getCell(18).value = ''; // valut
      row2.getCell(19).value = 'G'; // flag
      
      // Apply font and alignment to all cells (NO BORDERS)
      for (let col = 1; col <= 19; col++) {
        const cell = row2.getCell(col);
        cell.font = { name: 'Aptos Narrow', size: 12 };
        if (col === 11) {
          cell.alignment = { horizontal: 'right', vertical: 'bottom' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'bottom' };
        }
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Jurnal_SAP_${companyCode}_${item.noPo || item.id}_${year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    } catch (error) {
      console.error('Error generating Jurnal SAP:', error);
      alert('Gagal membuat jurnal SAP. Silakan coba lagi.');
    }
  };

  const handleDownloadJurnalSAPTxt = (item: Accrual) => {
    // Use company code from item
    const companyCode = item.companyCode || '2000';
    
    if (!item.companyCode) {
      alert('Company code tidak ditemukan untuk item ini');
      return;
    }
    
    // Build TXT content (tab-separated)
    const rows: string[][] = [];
    
    // Calculate total accrual for this specific item
    const totalAccrual = item.periodes?.reduce((sum, p) => {
      if (item.pembagianType === 'manual') {
        return sum + p.amountAccrual;
      }
      
      // Untuk otomatis, cek tanggal periode saja
      // Parse bulan periode (format: "Jan 2026")
      const [bulanName, tahunStr] = p.bulan.split(' ');
      const bulanMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
        'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11
      };
      const periodeBulan = bulanMap[bulanName];
      const periodeTahun = parseInt(tahunStr);
      
      // Tanggal 1 bulan periode tersebut
      const today = new Date();
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const periodeDateOnly = new Date(periodeTahun, periodeBulan, 1);
      
      // Akui accrual jika sudah jatuh tempo ATAU jika sudah ada realisasi
      const totalRealisasi = p.totalRealisasi ?? 0;
      const hasRealisasi = totalRealisasi > 0;
      if (todayDate >= periodeDateOnly || hasRealisasi) {
        return sum + p.amountAccrual;
      }
      return sum;
    }, 0) || 0;
    
    const absTotalAccrual = Math.abs(totalAccrual);
    if (absTotalAccrual > 0) {
      const startDate = new Date(item.startDate);
      const docDate = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`;
      const year = startDate.getFullYear();
      
      // Entry 1: DEBIT - Kode Akun Biaya (positive amount)
      rows.push([
        '',
        companyCode,
        'SA',
        docDate,
        docDate,
        'IDR',
        '',
        item.headerText || '',
        '',
        item.kdAkunBiaya,
        Math.round(absTotalAccrual).toString(),
        item.headerText || '',
        '',
        item.costCenter || '',
        '',
        '',
        '',
        '',
        'G'
      ]);
      
      // Entry 2: KREDIT - Kode Akun Accrual (negative amount)
      rows.push([
        '',
        companyCode,
        'SA',
        docDate,
        docDate,
        'IDR',
        '',
        item.headerText || '',
        '',
        item.kdAkr,
        (-Math.round(absTotalAccrual)).toString(),
        item.headerText || '',
        '',
        '', // Cost center kosong untuk akun accrual
        '',
        '',
        '',
        '',
        'G'
      ]);
      
      // Convert to TXT string (tab-separated)
      const txtContent = rows.map(row => row.join('\t')).join('\n');
      
      // Create blob and download
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Jurnal_SAP_${companyCode}_${item.noPo || item.id}_${year}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Jurnal SAP untuk Realisasi: template sama, kode akun biaya di bawah kode akun accrual (row1 = accrual, row2 = biaya)
  const handleDownloadJurnalSAPRealisasiPerItem = async (item: Accrual) => {
    try {
      const { ExcelJS: ExcelJSLib } = await loadExcelLibraries();
      const companyCode = item.companyCode || '2000';
      if (!item.companyCode) {
        alert('Company code tidak ditemukan untuk item ini');
        return;
      }
      const totalRealisasi = calculateItemRealisasi(item);
      if (totalRealisasi <= 0) {
        alert('Tidak ada realisasi untuk item ini.');
        return;
      }
      const workbook = new ExcelJSLib.Workbook();
      const worksheet = workbook.addWorksheet('Jurnal SAP Realisasi');
      worksheet.getRow(1).height = 15;
      const headers1 = [
        'xblnr', 'bukrs', 'blart', 'bldat', 'budat', 'waers', 'kursf', 'bktxt',
        'zuonr', 'hkont', 'wrbtr', 'sgtxt', 'prctr', 'kostl', '', 'nplnr', 'aufnr', 'valut', 'flag'
      ];
      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFE699' } };
      worksheet.getRow(1).values = headers1;
      worksheet.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill;
        cell.font = { name: 'Calibri', size: 11, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'bottom' };
      });
      worksheet.getRow(2).height = 15;
      const headers2 = [
        'Reference', 'company', 'doc type', 'doc date', 'posting date', 'currency', 'kurs',
        'header text', 'Vendor/cu:', 'account', 'amount', 'line text', 'profit center',
        'cost center', '', 'Network', 'order numi', 'value date', ''
      ];
      worksheet.getRow(2).values = headers2;
      worksheet.getRow(2).eachCell((cell: any) => {
        cell.fill = headerFill;
        cell.font = { name: 'Calibri', size: 11, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'bottom' };
      });
      worksheet.columns = [
        { width: 12 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 12 }, { width: 10 }, { width: 8 },
        { width: 30 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 30 }, { width: 12 }, { width: 12 },
        { width: 3 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 5 }
      ];
      const startDate = new Date(item.startDate);
      const docDate = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`;
      const year = startDate.getFullYear();
      const amountRounded = Math.round(totalRealisasi);

      // Entry 1: KREDIT - Kode Akun Accrual (di atas), amount negatif
      const row1 = worksheet.getRow(3);
      row1.height = 15;
      row1.getCell(1).value = '';
      row1.getCell(2).value = companyCode;
      row1.getCell(3).value = 'SA';
      row1.getCell(4).value = docDate;
      row1.getCell(5).value = docDate;
      row1.getCell(6).value = 'IDR';
      row1.getCell(7).value = '';
      row1.getCell(8).value = item.headerText || '';
      row1.getCell(9).value = '';
      row1.getCell(10).value = item.kdAkr; // hkont = kode akun accrual
      row1.getCell(11).value = -amountRounded;
      row1.getCell(11).numFmt = '0';
      row1.getCell(12).value = item.headerText || '';
      row1.getCell(13).value = '';
      row1.getCell(14).value = ''; // kostl kosong untuk akun accrual
      row1.getCell(15).value = '';
      row1.getCell(16).value = '';
      row1.getCell(17).value = '';
      row1.getCell(18).value = '';
      row1.getCell(19).value = 'G';
      for (let col = 1; col <= 19; col++) {
        const cell = row1.getCell(col);
        cell.font = { name: 'Aptos Narrow', size: 12 };
        cell.alignment = { horizontal: col === 11 ? 'right' : 'left', vertical: 'bottom' };
      }

      // Entry 2: DEBIT - Kode Akun Biaya (di bawah), amount positif
      const row2 = worksheet.getRow(4);
      row2.height = 15;
      row2.getCell(1).value = '';
      row2.getCell(2).value = companyCode;
      row2.getCell(3).value = 'SA';
      row2.getCell(4).value = docDate;
      row2.getCell(5).value = docDate;
      row2.getCell(6).value = 'IDR';
      row2.getCell(7).value = '';
      row2.getCell(8).value = item.headerText || '';
      row2.getCell(9).value = '';
      row2.getCell(10).value = item.kdAkunBiaya; // hkont = kode akun biaya
      row2.getCell(11).value = amountRounded;
      row2.getCell(11).numFmt = '0';
      row2.getCell(12).value = item.headerText || '';
      row2.getCell(13).value = '';
      row2.getCell(14).value = item.costCenter || '';
      row2.getCell(15).value = '';
      row2.getCell(16).value = '';
      row2.getCell(17).value = '';
      row2.getCell(18).value = '';
      row2.getCell(19).value = 'G';
      for (let col = 1; col <= 19; col++) {
        const cell = row2.getCell(col);
        cell.font = { name: 'Aptos Narrow', size: 12 };
        cell.alignment = { horizontal: col === 11 ? 'right' : 'left', vertical: 'bottom' };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Jurnal_SAP_Realisasi_${companyCode}_${item.noPo || item.id}_${year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating Jurnal SAP Realisasi:', error);
      alert('Gagal membuat jurnal SAP realisasi. Silakan coba lagi.');
    }
  };

  const handleDownloadJurnalSAPRealisasiTxt = (item: Accrual) => {
    const companyCode = item.companyCode || '2000';
    if (!item.companyCode) {
      alert('Company code tidak ditemukan untuk item ini');
      return;
    }
    const totalRealisasi = calculateItemRealisasi(item);
    if (totalRealisasi <= 0) {
      alert('Tidak ada realisasi untuk item ini.');
      return;
    }
    const startDate = new Date(item.startDate);
    const docDate = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`;
    const year = startDate.getFullYear();
    const amountRounded = Math.round(totalRealisasi).toString();
    // Entry 1: KREDIT - Kode Akun Accrual
    const row1 = ['', companyCode, 'SA', docDate, docDate, 'IDR', '', item.headerText || '', '', item.kdAkr, (-Math.round(totalRealisasi)).toString(), item.headerText || '', '', '', '', '', '', '', 'G'];
    // Entry 2: DEBIT - Kode Akun Biaya
    const row2 = ['', companyCode, 'SA', docDate, docDate, 'IDR', '', item.headerText || '', '', item.kdAkunBiaya, amountRounded, item.headerText || '', '', item.costCenter || '', '', '', '', 'G'];
    const txtContent = [row1, row2].map(row => row.join('\t')).join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Jurnal_SAP_Realisasi_${companyCode}_${item.noPo || item.id}_${year}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // If kode akun changes, reset klasifikasi
    if (name === 'kdAkr') {
      setFormData(prev => ({ ...prev, [name]: value, klasifikasi: '' }));
    } else if (name === 'jumlahPeriode') {
      // Saat ubah jumlah periode: pertahankan nilai yang sudah ada, hanya tambah/kurangi slot
      const newCount = parseInt(value) || 0;
      setFormData(prev => {
        const prevAmounts = prev.periodeAmounts || [];
        let newPeriodeAmounts: string[];
        if (newCount > prevAmounts.length) {
          newPeriodeAmounts = [...prevAmounts, ...Array(newCount - prevAmounts.length).fill('')];
        } else if (newCount < prevAmounts.length) {
          newPeriodeAmounts = prevAmounts.slice(0, newCount);
        } else {
          newPeriodeAmounts = prevAmounts.length ? [...prevAmounts] : Array(newCount).fill('');
        }
        return { ...prev, [name]: value, periodeAmounts: newPeriodeAmounts };
      });
    } else if (name === 'pembagianType') {
      // Initialize periodeAmounts for manual mode
      if (value === 'manual') {
        const count = parseInt(formData.jumlahPeriode) || 12;
        const newPeriodeAmounts = Array(count).fill('');
        setFormData(prev => ({ ...prev, [name]: value, periodeAmounts: newPeriodeAmounts }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value, periodeAmounts: [] }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }, [formData.jumlahPeriode]);

  const handlePeriodeAmountChange = (index: number, value: string) => {
    setFormData(prev => {
      const newAmounts = [...prev.periodeAmounts];
      newAmounts[index] = value;
      return { ...prev, periodeAmounts: newAmounts };
    });
  };

  const handleEdit = useCallback((item: Accrual) => {
    setEditingId(item.id);
    
    // Get periodeAmounts if manual type
    const periodeAmounts = item.pembagianType === 'manual' && item.periodes 
      ? item.periodes.map(p => p.amountAccrual.toString())
      : [];
    
    setFormData({
      companyCode: item.companyCode || '',
      noPo: item.noPo || '',
      assignment: item.alokasi || '',
      kdAkr: item.kdAkr,
      kdAkunBiaya: item.kdAkunBiaya,
      vendor: item.vendor,
      deskripsi: item.deskripsi,
      headerText: item.headerText || '',
      klasifikasi: item.klasifikasi || '',
      totalAmount: item.totalAmount.toString(),
      costCenter: item.costCenter || '',
      startDate: item.startDate.split('T')[0],
      jumlahPeriode: item.jumlahPeriode.toString(),
      pembagianType: item.pembagianType,
      periodeAmounts: periodeAmounts,
    });
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return;

    try {
      const response = await fetch(`/api/accrual?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete accrual');

      fetchAccrualData();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      alert('Data berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting accrual:', error);
      alert('Gagal menghapus data');
    }
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Yakin hapus ${selectedIds.size} data accrual terpilih?`)) return;

    setDeletingSelected(true);
    try {
      const ids = Array.from(selectedIds).join(',');
      const response = await fetch(`/api/accrual?ids=${ids}`, { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal menghapus');
      }
      const data = await response.json();
      setSelectedIds(new Set());
      fetchAccrualData();
      alert(data.count != null ? `${data.count} data berhasil dihapus.` : 'Data berhasil dihapus.');
    } catch (error) {
      console.error('Error bulk delete:', error);
      alert('Gagal menghapus data terpilih');
    } finally {
      setDeletingSelected(false);
    }
  }, [selectedIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const isEditing = editingId !== null;
      const url = isEditing ? `/api/accrual?id=${editingId}` : '/api/accrual';
      const method = isEditing ? 'PUT' : 'POST';
      // Manual: total amount = jumlah semua nilai periode (termasuk periode baru)
      const totalAmountToSend = formData.pembagianType === 'manual' && formData.periodeAmounts?.length
        ? formData.periodeAmounts.reduce((sum, a) => sum + (parseFloat(a) || 0), 0)
        : parseFloat(formData.totalAmount);
      
      const response = await fetch(url, {
        method,
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
          headerText: formData.headerText || null,
          klasifikasi: formData.klasifikasi,
          totalAmount: totalAmountToSend,
          costCenter: formData.costCenter || null,
          startDate: formData.startDate,
          jumlahPeriode: parseInt(formData.jumlahPeriode),
          pembagianType: formData.pembagianType,
          periodeAmounts: formData.pembagianType === 'manual' ? formData.periodeAmounts : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || (isEditing ? 'Failed to update accrual' : 'Failed to create accrual'));
      }

      // Refresh data first
      await fetchAccrualData();
      
      // Reset form and close modal
      setFormData({
        companyCode: '',
        noPo: '',
        assignment: '',
        kdAkr: '',
        kdAkunBiaya: '',
        vendor: '',
        deskripsi: '',
        headerText: '',
        klasifikasi: '',
        totalAmount: '',
        costCenter: '',
        startDate: '',
        jumlahPeriode: '12',
        pembagianType: 'otomatis',
        periodeAmounts: [],
      });
      setEditingId(null);
      setShowModal(false);
      
      alert(isEditing ? 'Data accrual berhasil diupdate!' : 'Data accrual berhasil ditambahkan!');
    } catch (error) {
      console.error('Error creating accrual:', error);
      alert('Gagal menambahkan data accrual. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRealisasiModal = async (periode: AccrualPeriode, viewOnly = false) => {
    setSelectedPeriode(periode);
    setRealisasiViewOnly(viewOnly);
    setShowRealisasiModal(true);
    
    // Fetch existing realisasi
    try {
      const response = await fetch(`/api/accrual/realisasi?periodeId=${periode.id}`);
      if (response.ok) {
        const data = await response.json();
        setRealisasiData(data);
      }
    } catch (error) {
      console.error('Error fetching realisasi:', error);
    }
  };

  const handleRealisasiInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRealisasiForm(prev => ({ ...prev, [name]: value }));
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPeriode) return;

    setUploadingExcel(true);
    try {
      // Load XLSX on demand
      const { XLSX: XLSXLib } = await loadExcelLibraries();
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSXLib.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[][] = XLSXLib.utils.sheet_to_json(worksheet, { header: 1 });

          // Skip header row (index 0) and process data rows
          const successCount = [];
          const errorCount = [];

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            // Kolom J adalah index 9 (A=0, B=1, ..., J=9)
            const realisasiAmount = row[9];
            
            if (realisasiAmount && !isNaN(Number(realisasiAmount)) && Number(realisasiAmount) > 0) {
              try {
                const response = await fetch('/api/accrual/realisasi', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    accrualPeriodeId: selectedPeriode.id,
                    tanggalRealisasi: new Date().toISOString().split('T')[0],
                    amount: Number(realisasiAmount),
                    keterangan: `Import dari Excel - Baris ${i + 1}`,
                  }),
                });

                if (response.ok) {
                  successCount.push(i + 1);
                } else {
                  errorCount.push(i + 1);
                }
              } catch (error) {
                errorCount.push(i + 1);
              }
            }
          }

          // Refresh realisasi list
          const realisasiResponse = await fetch(`/api/accrual/realisasi?periodeId=${selectedPeriode.id}`);
          if (realisasiResponse.ok) {
            const data = await realisasiResponse.json();
            setRealisasiData(data);
          }

          // Refresh main accrual data
          await fetchAccrualData();

          // Update selected periode with new totals
          const updatedAccrual = accrualData.find(a => 
            a.periodes?.some(p => p.id === selectedPeriode.id)
          );
          if (updatedAccrual) {
            const updatedPeriode = updatedAccrual.periodes?.find(p => p.id === selectedPeriode.id);
            if (updatedPeriode) {
              setSelectedPeriode(updatedPeriode);
            }
          }

          alert(`Import berhasil!\nBerhasil: ${successCount.length} data\nGagal: ${errorCount.length} data`);
        } catch (error) {
          console.error('Error processing Excel:', error);
          alert('Gagal memproses file Excel. Pastikan format file benar.');
        } finally {
          setUploadingExcel(false);
          // Reset file input
          e.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      alert('Gagal membaca file Excel.');
      setUploadingExcel(false);
    }
  };

  const handleRealisasiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriode) return;
    
    setSubmittingRealisasi(true);
    try {
      const isEditing = editingRealisasiId !== null;
      const url = isEditing ? `/api/accrual/realisasi?id=${editingRealisasiId}` : '/api/accrual/realisasi';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accrualPeriodeId: selectedPeriode.id,
          tanggalRealisasi: realisasiForm.tanggalRealisasi,
          amount: parseFloat(realisasiForm.amount),
          keterangan: realisasiForm.keterangan || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save realisasi');

      // Reset form and editing state
      setRealisasiForm({
        tanggalRealisasi: new Date().toISOString().split('T')[0],
        amount: '',
        keterangan: '',
      });
      setEditingRealisasiId(null);

      // Refresh realisasi list for the modal
      const realisasiResponse = await fetch(`/api/accrual/realisasi?periodeId=${selectedPeriode.id}`);
      if (realisasiResponse.ok) {
        const data = await realisasiResponse.json();
        setRealisasiData(data);
      }

      // Refresh main data and get updated periode in one go
      const accrualResponse = await fetch('/api/accrual');
      if (accrualResponse.ok) {
        const accruals = await accrualResponse.json();
        setAccrualData(accruals);
        
        // Update selectedPeriode with fresh data
        const updatedAccrual = accruals.find((acc: Accrual) => 
          acc.periodes?.some(p => p.id === selectedPeriode.id)
        );
        if (updatedAccrual) {
          const updatedPeriode = updatedAccrual.periodes?.find((p: AccrualPeriode) => p.id === selectedPeriode.id);
          if (updatedPeriode) {
            setSelectedPeriode(updatedPeriode);
          }
        }
      }
      
      alert(isEditing ? 'Realisasi berhasil diupdate!' : 'Realisasi berhasil ditambahkan!');
    } catch (error) {
      console.error('Error saving realisasi:', error);
      alert('Gagal menyimpan realisasi');
    } finally {
      setSubmittingRealisasi(false);
    }
  };

  const handleDeleteRealisasi = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus realisasi ini?')) return;

    try {
      const response = await fetch(`/api/accrual/realisasi?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete realisasi');

      // Refresh realisasi list
      if (selectedPeriode) {
        const realisasiResponse = await fetch(`/api/accrual/realisasi?periodeId=${selectedPeriode.id}`);
        if (realisasiResponse.ok) {
          const data = await realisasiResponse.json();
          setRealisasiData(data);
        }
      }

      // Refresh main data and get updated periode in one go
      const accrualResponse = await fetch('/api/accrual');
      if (accrualResponse.ok) {
        const accruals = await accrualResponse.json();
        setAccrualData(accruals);
        
        // Update selectedPeriode with fresh data
        if (selectedPeriode) {
          const updatedAccrual = accruals.find((acc: Accrual) => 
            acc.periodes?.some(p => p.id === selectedPeriode.id)
          );
          if (updatedAccrual) {
            const updatedPeriode = updatedAccrual.periodes?.find((p: AccrualPeriode) => p.id === selectedPeriode.id);
            if (updatedPeriode) {
              setSelectedPeriode(updatedPeriode);
            }
          }
        }
      }
      
      alert('Realisasi berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting realisasi:', error);
      alert('Gagal menghapus realisasi');
    }
  };

  const handleGlobalExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingGlobalExcel(true);
    try {
      const isXml = file.name.toLowerCase().endsWith('.xml');
      let jsonData: any[][] = [];

      if (isXml) {
        // Parse SAP Excel XML (SpreadsheetML) menjadi array baris
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const rowEls = Array.from(xmlDoc.getElementsByTagNameNS('*', 'Row'));

        for (const rowEl of rowEls) {
          const cellEls = Array.from(rowEl.getElementsByTagNameNS('*', 'Cell'));
          if (cellEls.length === 0) continue;

          const row: any[] = [];
          let currentIndex = 0;

          for (const cellEl of cellEls) {
            const indexAttr = cellEl.getAttribute('ss:Index') || cellEl.getAttribute('Index');
            if (indexAttr) {
              const targetIndex = parseInt(indexAttr, 10) - 1;
              while (currentIndex < targetIndex) {
                row.push('');
                currentIndex++;
              }
            }

            const dataEl = cellEl.getElementsByTagNameNS('*', 'Data')[0];
            const value = dataEl?.textContent ?? '';
            row.push(value);
            currentIndex++;
          }

          jsonData.push(row);
        }
      } else {
        // Load XLSX on demand dan baca seperti sebelumnya
        const { XLSX: XLSXLib } = await loadExcelLibraries();
        const reader = new FileReader();
        const data: string | ArrayBuffer = await new Promise((resolve, reject) => {
          reader.onload = (event) => {
            if (event.target?.result == null) {
              reject(new Error('Gagal membaca file'));
            } else {
              resolve(event.target.result);
            }
          };
          reader.onerror = () => reject(new Error('Gagal membaca file'));
          reader.readAsBinaryString(file);
        });

        const workbook = XLSXLib.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSXLib.utils.sheet_to_json(worksheet, { header: 1 });
      }

      if (!jsonData || jsonData.length <= 1) {
        alert('File tidak berisi data realisasi yang valid.');
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const processedPos: Set<string> = new Set();

      // Skip header row dan proses data baris demi baris
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];

        // Kolom C = PO/PR, kolom J = Amount (index 2 dan 9)
        const noPo = row[2]?.toString().trim();
        const realisasiAmount = row[9];

        if (!noPo || !realisasiAmount || isNaN(Number(realisasiAmount)) || Number(realisasiAmount) === 0) {
          continue;
        }

        const matchingAccrual = accrualData.find(acc => acc.noPo?.trim() === noPo);

        if (!matchingAccrual) {
          if (!processedPos.has(noPo)) {
            errors.push(`Baris ${i + 1}: PO ${noPo} tidak ditemukan`);
            processedPos.add(noPo);
          }
          errorCount++;
          continue;
        }

        const today = new Date();
        const currentPeriode = matchingAccrual.periodes?.find(p => {
          const [bulanName, tahunStr] = p.bulan.split(' ');
          const bulanMap: Record<string, number> = {
            Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
            Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11,
          };
          const periodeBulan = bulanMap[bulanName];
          const periodeTahun = parseInt(tahunStr);
          const periodeDate = new Date(periodeTahun, periodeBulan, 1);
          return today >= periodeDate && today.getMonth() === periodeBulan && today.getFullYear() === periodeTahun;
        });

        const targetPeriode = currentPeriode || matchingAccrual.periodes?.find(p => {
          const saldo = p.amountAccrual + (p.totalRealisasi || 0); // accrual negatif, realisasi positif
          return saldo < 0; // masih ada sisa accrual yang belum direalisasi
        });

        if (!targetPeriode) {
          errors.push(`Baris ${i + 1}: PO ${noPo} tidak ada periode aktif`);
          errorCount++;
          continue;
        }

        try {
          const response = await fetch('/api/accrual/realisasi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accrualPeriodeId: targetPeriode.id,
              tanggalRealisasi: new Date().toISOString().split('T')[0],
              amount: Number(realisasiAmount),
              keterangan: `Import Global - PO: ${noPo}`,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errors.push(`Baris ${i + 1}: Gagal menyimpan realisasi PO ${noPo}`);
            errorCount++;
          }
        } catch (error) {
          errors.push(`Baris ${i + 1}: Error pada PO ${noPo}`);
          errorCount++;
        }
      }

      await fetchAccrualData();

      let message = `Import selesai!\nBerhasil: ${successCount} data\nGagal: ${errorCount} data`;
      if (errors.length > 0) {
        message += '\n\nDetail Error:\n' + errors.slice(0, 10).join('\n');
        if (errors.length > 10) {
          message += `\n... dan ${errors.length - 10} error lainnya`;
        }
      }
      alert(message);

      setShowImportGlobalModal(false);
    } catch (error) {
      console.error('Error processing global realisasi file:', error);
      alert('Gagal memproses file realisasi global. Pastikan format file benar.');
    } finally {
      setUploadingGlobalExcel(false);
      e.target.value = '';
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImportExcel(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/accrual/import', {
        method: 'POST',
        body: formData,
      });

      let errorData: any = null;
      let errorText = '';

      if (!response.ok) {
        // Coba parse sebagai JSON, jika gagal ambil sebagai text
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch (jsonError) {
            errorText = await response.text();
          }
        } else {
          errorText = await response.text();
        }

        const warningText =
          errorData?.warnings && Array.isArray(errorData.warnings) && errorData.warnings.length > 0
            ? `\n\nDetail:\n${errorData.warnings.slice(0, 10).join('\n')}${errorData.warnings.length > 10 ? `\n... dan ${errorData.warnings.length - 10} info lainnya` : ''}`
            : '';
        throw new Error((errorData?.error || errorText || 'Failed to import Excel file') + warningText);
      }

      const result = await response.json();
      
      // Refresh data
      await fetchAccrualData();

      let message = `Import Excel selesai!\n\nBerhasil memproses ${result.results.length} accruals`;
      
      if (result.errors && result.errors.length > 0) {
        message += `\n\nError (${result.errors.length}):\n${result.errors.slice(0, 5).map((e: any) => `${e.kdAkr || 'N/A'}: ${e.error}`).join('\n')}`;
        if (result.errors.length > 5) {
          message += `\n... dan ${result.errors.length - 5} error lainnya`;
        }
      }

      if (result.warnings && result.warnings.length > 0) {
        message += `\n\nWarnings:\n${result.warnings.slice(0, 3).join('\n')}`;
      }

      alert(message);
      setShowImportExcelModal(false);
    } catch (error) {
      console.error('Error importing Excel file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Jika error message terlalu panjang atau mengandung HTML, potong
      const displayError = errorMessage.length > 200 
        ? errorMessage.substring(0, 200) + '...' 
        : errorMessage.replace(/<[^>]*>/g, ''); // Remove HTML tags
      alert(`Gagal mengimport file Excel: ${displayError}`);
    } finally {
      setUploadingImportExcel(false);
      e.target.value = '';
    }
  };

  const handleUpdatePeriodeAmount = async (periodeId: number, newAmount: string) => {
    try {
      const response = await fetch(`/api/accrual/periode?id=${periodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountAccrual: -Math.abs(parseFloat(newAmount)), // accrual disimpan negatif
        }),
      });

      if (!response.ok) throw new Error('Failed to update periode amount');

      // Refresh data
      await fetchAccrualData();
      setEditingPeriodeId(null);
      setEditPeriodeAmount('');
      alert('Amount periode berhasil diupdate!');
    } catch (error) {
      console.error('Error updating periode amount:', error);
      alert('Gagal mengupdate amount periode');
    }
  };

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
  }, []);

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
      {/* Portal: dropdown Jurnal SAP di body agar tidak tertutup header tabel */}
      {typeof document !== 'undefined' && openJurnalItem && openJurnalRect && createPortal(
        <div
          className="jurnal-dropdown-menu fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
          style={{
            bottom: window.innerHeight - openJurnalRect.top + 8,
            left: openJurnalRect.right - 192,
          }}
        >
          <div className="px-3 py-1 text-[10px] text-gray-500 font-semibold">
            Company: {openJurnalItem.companyCode || 'N/A'}
          </div>
          <button
            type="button"
            onClick={() => { handleDownloadJurnalSAPPerItem(openJurnalItem!); closeJurnalDropdown(); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 transition-colors"
          >
            Download Excel
          </button>
          <button
            type="button"
            onClick={() => { handleDownloadJurnalSAPTxt(openJurnalItem!); closeJurnalDropdown(); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-green-50 transition-colors"
          >
            Download TXT
          </button>
          <div className="border-t border-gray-100 my-1" />
          <div className="px-3 py-1 text-[10px] text-gray-500 font-semibold">
            Jurnal Realisasi
          </div>
          <button
            type="button"
            onClick={() => { handleDownloadJurnalSAPRealisasiPerItem(openJurnalItem!); closeJurnalDropdown(); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 transition-colors"
          >
            Download Excel (Realisasi)
          </button>
          <button
            type="button"
            onClick={() => { handleDownloadJurnalSAPRealisasiTxt(openJurnalItem!); closeJurnalDropdown(); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 transition-colors"
          >
            Download TXT (Realisasi)
          </button>
        </div>,
        document.body
      )}
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - Always rendered, controlled by transform */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <Sidebar onClose={() => setIsMobileSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 lg:ml-64 overflow-x-hidden">
        {/* Content area - no z-index needed as overlay is conditionally rendered */}
        
        {/* Header */}
        <Header
          title="Monitoring Accrual"
          subtitle="Monitoring dan input data accrual dengan export laporan SAP"
          onMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Content Area */}
        <div className="p-4 sm:p-6 md:p-8 bg-gray-50">
          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <>
              {/* Filter Bar */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  {/* Search */}
                  <div className="relative w-full sm:flex-1 sm:min-w-[250px]">
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
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
                    <button 
                      onClick={() => setShowImportExcelModal(true)}
                      className="flex items-center gap-1 sm:gap-2 bg-red-600 hover:bg-red-700 !text-white px-2 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium flex-1 sm:flex-initial justify-center"
                    >
                      <Upload size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="hidden sm:inline">Import Excel Accrual</span>
                      <span className="sm:hidden">Excel</span>
                    </button>
                    <button 
                      onClick={() => setShowImportGlobalModal(true)}
                      className="flex items-center gap-1 sm:gap-2 bg-red-600 hover:bg-red-700 !text-white px-2 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium flex-1 sm:flex-initial justify-center"
                    >
                      <Upload size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="hidden sm:inline">Import Realisasi Global</span>
                      <span className="sm:hidden">Import</span>
                    </button>
                    <button 
                      onClick={handleDownloadAllItemsReport}
                      className="flex items-center gap-1 sm:gap-2 bg-red-600 hover:bg-red-700 !text-white px-2 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium flex-1 sm:flex-initial justify-center"
                    >
                      <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="hidden sm:inline">Export Per Item (All)</span>
                      <span className="sm:hidden">Per Item</span>
                    </button>
                    <button 
                      onClick={handleDownloadGlobalReport}
                      className="flex items-center gap-1 sm:gap-2 bg-red-600 hover:bg-red-700 !text-white px-2 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium flex-1 sm:flex-initial justify-center"
                    >
                      <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="hidden sm:inline">Export Global</span>
                      <span className="sm:hidden">Global</span>
                    </button>
                    {canEdit && selectedIds.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        disabled={deletingSelected}
                        className="flex items-center gap-1 sm:gap-2 bg-red-700 hover:bg-red-800 !text-white px-2 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium flex-1 sm:flex-initial justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                        {deletingSelected ? (
                          <span>Menghapus...</span>
                        ) : (
                          <>
                            <span className="hidden sm:inline">Hapus terpilih ({selectedIds.size})</span>
                            <span className="sm:hidden">Hapus ({selectedIds.size})</span>
                          </>
                        )}
                      </button>
                    )}
                    {canEdit && (
                      <button 
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-1 sm:gap-2 bg-red-600 hover:bg-red-700 !text-white px-2 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium w-full sm:w-auto justify-center"
                      >
                        <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                        <span className="hidden sm:inline">Tambah Data Accrual</span>
                        <span className="sm:hidden">Tambah Data</span>
                      </button>
                    )}
                  </div>
                </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Total Accrual</p>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                {formatCurrency(totalAccrual)}
              </h3>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Jumlah Accrual</p>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{accrualData.length}</h3>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Total Periode</p>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{totalPeriodes}</h3>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ maxWidth: '100%' }}>
            <style jsx>{`
              .custom-scrollbar::-webkit-scrollbar {
                height: 10px;
                width: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 5px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 5px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
              }
              .table-container {
                min-height: calc(100vh - 400px);
                max-height: calc(100vh - 350px);
                overflow: auto;
              }
            `}</style>
            <div
              className="table-container custom-scrollbar"
              onScroll={() => { if (openJurnalRect) closeJurnalDropdown(); }}
            >
              <table className="w-full text-xs sm:text-sm" style={{ minWidth: '1800px' }}>
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-[5] shadow-sm">
                  <tr>
                    {canEdit && (
                      <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap w-10 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={filteredData.length > 0 && filteredData.every((item) => selectedIds.has(item.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(filteredData.map((item) => item.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          title="Pilih semua"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap w-12 bg-gray-50">
                      ▼
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Company Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      No PO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Assignment/Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Kode Akun Accrual
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Kode Akun Biaya
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Deskripsi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Header Text
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Klasifikasi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Cost Center
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Periode
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Total Accrual
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Total Realisasi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Saldo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(groupedByKodeAkun).map(([kodeAkun, vendorGroups]) => {
                    const isKodeAkunExpanded = expandedKodeAkun.has(kodeAkun);
                    const allItems = Object.values(vendorGroups).flat();
                    
                    // Calculate totals using cache untuk performa lebih baik
                    const totalAmountKodeAkun = allItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
                    const totalAccrualKodeAkun = allItems.reduce((sum, item) => {
                      const cached = itemTotalsCache.get(item.id);
                      return sum + (cached?.accrual || 0);
                    }, 0);
                    const totalRealisasiKodeAkun = allItems.reduce((sum, item) => {
                      const cached = itemTotalsCache.get(item.id);
                      return sum + (cached?.realisasi || 0);
                    }, 0);
                    const totalSaldoKodeAkun = totalAccrualKodeAkun + totalRealisasiKodeAkun; // accrual negatif, realisasi positif

                    return (
                      <React.Fragment key={kodeAkun}>
                        {/* Kode Akun Group Header */}
                        <tr className="bg-blue-50 font-semibold">
                          {canEdit && <td className="px-2 py-3 bg-blue-50" />}
                          <td className="px-4 py-3 text-center bg-blue-50">
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedKodeAkun);
                                if (isKodeAkunExpanded) {
                                  newExpanded.delete(kodeAkun);
                                } else {
                                  newExpanded.add(kodeAkun);
                                }
                                setExpandedKodeAkun(newExpanded);
                              }}
                              className="text-blue-700 hover:text-blue-900 transition-colors"
                            >
                              {isKodeAkunExpanded ? '▼' : '▶'}
                            </button>
                          </td>
                          <td colSpan={9} className="px-4 py-3 text-left text-blue-900 bg-blue-50">
                            Kode Akun: {kodeAkun}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-900 bg-blue-50">
                            {formatCurrency(totalAmountKodeAkun)}
                          </td>
                          <td className="px-4 py-3 bg-blue-50"></td>
                          <td className="px-4 py-3 bg-blue-50"></td>
                          <td className="px-4 py-3 bg-blue-50"></td>
                          <td className="px-4 py-3 text-right font-bold text-blue-900 bg-blue-50">
                            {formatCurrency(totalAccrualKodeAkun)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-900 bg-blue-50">
                            {formatCurrency(totalRealisasiKodeAkun)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-900 bg-blue-50">
                            {formatCurrency(totalSaldoKodeAkun)}
                          </td>
                          <td className="px-4 py-3 bg-blue-50"></td>
                          <td className="px-4 py-3 bg-blue-50"></td>
                        </tr>

                        {/* Vendor Groups */}
                        {isKodeAkunExpanded && Object.entries(vendorGroups).map(([vendor, items]) => {
                          const vendorKey = `${kodeAkun}-${vendor}`;
                          const isVendorExpanded = expandedVendor.has(vendorKey);
                          
                          // Calculate totals using cache untuk performa
                          const totalAmountVendor = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
                          const totalAccrualVendor = items.reduce((sum, item) => {
                            const cached = itemTotalsCache.get(item.id);
                            return sum + (cached?.accrual || 0);
                          }, 0);
                          const totalRealisasiVendor = items.reduce((sum, item) => {
                            const cached = itemTotalsCache.get(item.id);
                            return sum + (cached?.realisasi || 0);
                          }, 0);
                          const totalSaldoVendor = totalAccrualVendor + totalRealisasiVendor; // accrual negatif, realisasi positif

                          return (
                            <React.Fragment key={vendorKey}>
                              {/* Vendor Group Header */}
                              <tr className="bg-green-50 font-semibold">
                                {canEdit && <td className="px-2 py-3 bg-green-50" />}
                                <td className="px-4 py-3 text-center bg-green-50">
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedVendor);
                                      if (isVendorExpanded) {
                                        newExpanded.delete(vendorKey);
                                      } else {
                                        newExpanded.add(vendorKey);
                                      }
                                      setExpandedVendor(newExpanded);
                                    }}
                                    className="text-green-700 hover:text-green-900 transition-colors ml-4"
                                  >
                                    {isVendorExpanded ? '▼' : '▶'}
                                  </button>
                                </td>
                                <td colSpan={9} className="px-4 py-3 text-left text-green-900 bg-green-50">
                                  Vendor: {vendor}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-green-900 bg-green-50">
                                  {formatCurrency(totalAmountVendor)}
                                </td>
                                <td className="px-4 py-3 bg-green-50"></td>
                                <td className="px-4 py-3 bg-green-50"></td>
                                <td className="px-4 py-3 bg-green-50"></td>
                                <td className="px-4 py-3 text-right font-bold text-green-900 bg-green-50">
                                  {formatCurrency(totalAccrualVendor)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-green-900 bg-green-50">
                                  {formatCurrency(totalRealisasiVendor)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-green-900 bg-green-50">
                                  {formatCurrency(totalSaldoVendor)}
                                </td>
                                <td className="px-4 py-3 bg-green-50"></td>
                                <td className="px-4 py-3 bg-green-50"></td>
                              </tr>

                              {/* Klasifikasi Items */}
                              {isVendorExpanded && items.map((item) => {
                          const isExpanded = expandedRows.has(item.id);
                          return (
                            <React.Fragment key={item.id}>
                              <tr className="bg-white hover:bg-gray-50 transition-colors">
                                {canEdit && (
                                  <td className="px-2 py-4 text-center bg-white">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(item.id)}
                                      onChange={() => {
                                        setSelectedIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(item.id)) next.delete(item.id);
                                          else next.add(item.id);
                                          return next;
                                        });
                                      }}
                                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                )}
                                <td className="px-4 py-4 text-center bg-white">
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedRows);
                                      if (isExpanded) {
                                        newExpanded.delete(item.id);
                                      } else {
                                        newExpanded.add(item.id);
                                      }
                                      setExpandedRows(newExpanded);
                                    }}
                                    className="text-gray-600 hover:text-red-600 transition-colors ml-6"
                                  >
                                    {isExpanded ? '▼' : '▶'}
                                  </button>
                                </td>
                          <td className="px-4 py-4 text-gray-800 whitespace-nowrap bg-white">{item.companyCode || '-'}</td>
                          <td className="px-4 py-4 text-gray-800 whitespace-nowrap bg-white">{item.noPo || '-'}</td>
                          <td className="px-4 py-4 text-gray-800 whitespace-nowrap bg-white">{item.alokasi || '-'}</td>
                          <td className="px-4 py-4 text-gray-800 whitespace-nowrap font-medium bg-white">{item.kdAkr}</td>
                          <td className="px-4 py-4 text-gray-800 bg-white">{item.kdAkunBiaya}</td>
                          <td className="px-4 py-4 text-gray-600 bg-white">{item.vendor}</td>
                          <td className="px-4 py-4 text-gray-600 max-w-xs truncate bg-white" title={item.deskripsi}>{item.deskripsi}</td>
                          <td className="px-4 py-4 text-gray-600 max-w-xs truncate bg-white" title={item.headerText || '-'}>{item.headerText || '-'}</td>
                          <td className="px-4 py-4 text-center bg-white">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {item.klasifikasi || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-gray-800 whitespace-nowrap bg-white">
                            {formatCurrency(item.totalAmount)}
                          </td>
                          <td className="px-4 py-4 text-gray-800 whitespace-nowrap bg-white">{item.costCenter || '-'}</td>
                          <td className="px-4 py-4 text-center text-gray-600 text-xs whitespace-nowrap bg-white">
                            {formatDate(item.startDate)}
                          </td>
                          <td className="px-4 py-4 text-center text-gray-800 whitespace-nowrap bg-white">
                            {item.jumlahPeriode} bulan
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-gray-800 whitespace-nowrap bg-white">
                            {formatCurrency(calculateItemAccrual(item))}
                          </td>
                          <td className="px-4 py-4 text-right text-blue-700 whitespace-nowrap bg-white">
                            {formatCurrency(calculateItemRealisasi(item))}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-white">
                            {(() => {
                              const totalAccrual = calculateItemAccrual(item);
                              const totalRealisasi = calculateItemRealisasi(item);
                              const saldo = totalAccrual + totalRealisasi; // accrual negatif, realisasi positif
                              return formatCurrency(saldo);
                            })()}
                          </td>
                          <td className="px-4 py-4 text-center bg-white">
                            <div className="flex items-center justify-center gap-1">
                              {/* Jurnal SAP Dropdown - trigger only; menu di-render via portal */}
                              <div className="relative jurnal-dropdown-container">
                                <button
                                  onClick={(e) => {
                                    if (expandedRows.has(`jurnal-${item.id}`)) {
                                      closeJurnalDropdown();
                                    } else {
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                      setOpenJurnalRect({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left });
                                      setOpenJurnalItem(item);
                                      setExpandedRows(prev => {
                                        const next = new Set(prev);
                                        next.forEach(id => { if (typeof id === 'string' && id.startsWith('jurnal-')) next.delete(id); });
                                        next.add(`jurnal-${item.id}`);
                                        return next;
                                      });
                                    }
                                  }}
                                  className="text-green-600 hover:text-green-800 transition-colors p-1 hover:bg-green-50 rounded"
                                  title="Download Jurnal SAP"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => handleEdit(item)}
                                    className="text-blue-600 hover:text-blue-800 transition-colors p-1 hover:bg-blue-50 rounded"
                                    title="Edit"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    className="text-red-600 hover:text-red-800 transition-colors p-1 hover:bg-red-50 rounded"
                                    title="Hapus"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Row - Periode Details */}
                        {isExpanded && item.periodes && item.periodes.length > 0 && (
                          <tr className="bg-gray-50">
                            <td colSpan={canEdit ? 19 : 18} className="px-4 py-4 bg-gray-50">
                              <div className="ml-8">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Detail Periode</h4>
                                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                                  <thead className="bg-white">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-700 bg-white">Periode</th>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-700 bg-white">Bulan</th>
                                      <th className="px-3 py-2 text-right font-semibold text-gray-700 bg-white">Accrual</th>
                                      <th className="px-3 py-2 text-right font-semibold text-blue-700 bg-white">Total Realisasi</th>
                                      <th className="px-3 py-2 text-right font-semibold text-gray-700 bg-white">Saldo</th>
                                      <th className="px-3 py-2 text-center font-semibold text-gray-700 bg-white">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {calculatePeriodeAllocations(item.periodes).map((periode) => (
                                      <tr key={periode.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-700 bg-white">Periode {periode.periodeKe}</td>
                                        <td className="px-3 py-2 text-gray-700 bg-white">{periode.bulan}</td>
                                        <td className="px-3 py-2 text-right text-gray-800 font-medium bg-white">
                                          {editingPeriodeId === periode.id ? (
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                value={editPeriodeAmount}
                                                onChange={(e) => setEditPeriodeAmount(e.target.value)}
                                                step="0.01"
                                                className="w-28 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                autoFocus
                                                placeholder="Nilai negatif"
                                              />
                                              <button
                                                onClick={() => handleUpdatePeriodeAmount(periode.id, editPeriodeAmount)}
                                                className="text-green-600 hover:text-green-800 p-1"
                                                title="Simpan"
                                              >
                                                ✓
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingPeriodeId(null);
                                                  setEditPeriodeAmount('');
                                                }}
                                                className="text-red-600 hover:text-red-800 p-1"
                                                title="Batal"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-end gap-2">
                                              {formatCurrency(periode.amountAccrual)}
                                              {canEdit && (
                                                <button
                                                  onClick={() => {
                                                    setEditingPeriodeId(periode.id);
                                                    setEditPeriodeAmount(periode.amountAccrual.toString());
                                                  }}
                                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                                  title="Edit Amount"
                                                >
                                                  <Edit2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-blue-700 bg-white">
                                          {formatCurrency(periode.totalRealisasi || 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-800 font-semibold bg-white">
                                          {formatCurrency(periode.saldo || 0)}
                                        </td>
                                        <td className="px-3 py-2 text-center bg-white">
                                          <div className="flex items-center justify-center gap-1">
                                            {(periode.saldo ?? 0) < 0 ? (
                                                <button
                                                onClick={() => handleOpenRealisasiModal(periode, false)}
                                                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
                                                title="Input realisasi baru"
                                              >
                                                Input Realisasi
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => handleOpenRealisasiModal(periode, true)}
                                                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                                                title="Accrual sudah terpenuhi"
                                              >
                                                ✓ Lihat History
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {Object.keys(groupedByKodeAkun).length === 0 && (
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Data Accrual' : 'Tambah Data Accrual'}</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  setFormData({
                    companyCode: '',
                    noPo: '',
                    assignment: '',
                    kdAkr: '',
                    kdAkunBiaya: '',
                    vendor: '',
                    deskripsi: '',
                    headerText: '',
                    klasifikasi: '',
                    totalAmount: '',
                    costCenter: '',
                    startDate: '',
                    jumlahPeriode: '12',
                    pembagianType: 'otomatis',
                    periodeAmounts: [],
                  });
                }}
                className="text-white hover:text-red-100 transition-colors rounded-full hover:bg-white/10 p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(95vh - 120px)' }}>
              <form onSubmit={handleSubmit} className="p-3 sm:p-6 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
                {/* Company Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Company Code <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="companyCode"
                    value={formData.companyCode}
                    onChange={handleInputChange}
                    required
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
                    No PO <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="noPo"
                    value={formData.noPo}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan nomor PO"
                  />
                </div>

                {/* Assignment/Order */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Assignment/Order <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="assignment"
                    value={formData.assignment}
                    onChange={handleInputChange}
                    required
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
                  <input
                    type="text"
                    name="klasifikasi"
                    value={formData.klasifikasi}
                    onChange={handleInputChange}
                    list="klasifikasi-list"
                    required
                    disabled={!formData.kdAkr}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder={!formData.kdAkr ? 'Pilih Kode Akun terlebih dahulu' : 'Pilih atau ketik klasifikasi baru'}
                  />
                  <datalist id="klasifikasi-list">
                    {availableKlasifikasi.map((klasifikasi) => (
                      <option key={klasifikasi} value={klasifikasi} />
                    ))}
                  </datalist>
                  {formData.kdAkr && availableKlasifikasi.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Pilih dari daftar atau ketik klasifikasi baru
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount <span className="text-red-600">*</span>
                    {formData.pembagianType === 'manual' && formData.periodeAmounts?.length > 0 && (
                      <span className="text-gray-500 font-normal ml-1">(otomatis = jumlah tiap periode)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={formData.pembagianType === 'manual' && formData.periodeAmounts?.length
                      ? formData.periodeAmounts.reduce((s, a) => s + (parseFloat(a) || 0), 0).toString()
                      : formData.totalAmount}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    readOnly={formData.pembagianType === 'manual'}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all disabled:bg-gray-100 disabled:text-gray-700"
                    placeholder="Contoh: 50000000 (total)"
                  />
                </div>

                {/* Jumlah Periode */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah Periode <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    name="jumlahPeriode"
                    value={formData.jumlahPeriode}
                    onChange={handleInputChange}
                    required
                    min="1"
                    max="36"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Contoh: 12 (bulan)"
                  />
                </div>

                {/* Cost Center */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost Center <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="costCenter"
                    value={formData.costCenter}
                    onChange={handleInputChange}
                    required
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

                {/* Pembagian Type - Full Width */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipe Pembagian Periode <span className="text-red-600">*</span>
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="pembagianType"
                        value="otomatis"
                        checked={formData.pembagianType === 'otomatis'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        <strong>Otomatis</strong> - Dibagi rata per periode
                      </span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="pembagianType"
                        value="manual"
                        checked={formData.pembagianType === 'manual'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        <strong>Manual</strong> - Tidak dibagi otomatis (isi 0 per periode, update manual nanti)
                      </span>
                    </label>
                  </div>
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

                {/* Header Text - Full Width */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Header Text
                  </label>
                  <input
                    type="text"
                    name="headerText"
                    value={formData.headerText}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    placeholder="Masukkan header text untuk jurnal SAP (opsional)"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 bg-white px-6 py-4 -mx-6 -mb-6 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setFormData({
                      companyCode: '',
                      noPo: '',
                      assignment: '',
                      kdAkr: '',
                      kdAkunBiaya: '',
                      vendor: '',
                      deskripsi: '',
                      headerText: '',
                      klasifikasi: '',
                      totalAmount: '',
                      costCenter: '',
                      startDate: '',
                      jumlahPeriode: '12',
                      pembagianType: 'otomatis',
                      periodeAmounts: [],
                    });
                  }}
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
                  {submitting ? 'Menyimpan...' : editingId ? 'Update Data' : 'Simpan Data'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Realisasi */}
      {showRealisasiModal && selectedPeriode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {realisasiViewOnly ? '✓ History Realisasi' : 'Input Realisasi'}
                </h2>
                <p className="text-sm text-red-100 mt-1">
                  {selectedPeriode.bulan} - Periode {selectedPeriode.periodeKe}
                  {realisasiViewOnly && ' (Sudah Terpenuhi)'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRealisasiModal(false);
                  setSelectedPeriode(null);
                  setRealisasiViewOnly(false);
                  setRealisasiData([]);
                  setRealisasiForm({
                    tanggalRealisasi: new Date().toISOString().split('T')[0],
                    amount: '',
                    keterangan: '',
                  });
                }}
                className="text-white hover:text-red-100 transition-colors rounded-full hover:bg-white/10 p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 bg-gray-50" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              {/* Info Periode */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Accrual</p>
                    <p className="text-lg font-bold text-gray-800">{formatCurrency(selectedPeriode.amountAccrual)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Realisasi</p>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedPeriode.totalRealisasi || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Saldo</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency((selectedPeriode as any).saldo || selectedPeriode.saldo || selectedPeriode.amountAccrual)}</p>
                  </div>
                </div>
              </div>

              {/* Notif jika view only */}
              {realisasiViewOnly && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <span className="text-2xl">✓</span>
                    <div>
                      <p className="font-semibold">Accrual Sudah Terpenuhi</p>
                      <p className="text-sm">Periode ini sudah direalisasi sepenuhnya. Anda hanya dapat melihat history realisasi.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Excel */}
              {!realisasiViewOnly && (
              <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Import dari Excel</h3>
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all">
                      <Upload size={18} />
                      <span className="text-sm font-medium">
                        {uploadingExcel ? 'Mengupload...' : 'Upload File Excel'}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      disabled={uploadingExcel}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  * Nilai realisasi akan diambil dari kolom J pada file Excel
                </p>
              </div>
              )}

              {/* Form Input Realisasi */}
              {!realisasiViewOnly && (
              <form onSubmit={handleRealisasiSubmit} className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Tambah Realisasi Manual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tanggal Realisasi <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      name="tanggalRealisasi"
                      value={realisasiForm.tanggalRealisasi}
                      onChange={handleRealisasiInputChange}
                      required
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Amount <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      name="amount"
                      value={realisasiForm.amount}
                      onChange={handleRealisasiInputChange}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                      placeholder="Masukkan amount realisasi"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Keterangan
                    </label>
                    <textarea
                      name="keterangan"
                      value={realisasiForm.keterangan}
                      onChange={handleRealisasiInputChange}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all resize-none"
                      placeholder="Keterangan opsional"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  {editingRealisasiId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRealisasiId(null);
                        setRealisasiForm({
                          tanggalRealisasi: new Date().toISOString().split('T')[0],
                          amount: '',
                          keterangan: '',
                        });
                      }}
                      className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submittingRealisasi}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30"
                  >
                    {submittingRealisasi ? 'Menyimpan...' : editingRealisasiId ? 'Update Realisasi' : 'Simpan Realisasi'}
                  </button>
                </div>
              </form>
              )}

              {/* List Realisasi */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">History Realisasi</h3>
                </div>
                {realisasiData.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Belum ada realisasi untuk periode ini
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Tanggal</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Keterangan</th>
                          {!realisasiViewOnly && (
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {realisasiData.map((realisasi) => (
                          <tr key={realisasi.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700">{formatDate(realisasi.tanggalRealisasi)}</td>
                            <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatCurrency(realisasi.amount)}</td>
                            <td className="px-4 py-3 text-gray-600">{realisasi.keterangan || '-'}</td>
                            {!realisasiViewOnly && (
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingRealisasiId(realisasi.id);
                                      setRealisasiForm({
                                        tanggalRealisasi: realisasi.tanggalRealisasi.split('T')[0],
                                        amount: realisasi.amount.toString(),
                                        keterangan: realisasi.keterangan || '',
                                      });
                                    }}
                                    className="text-blue-600 hover:text-blue-800 transition-colors p-1 hover:bg-blue-50 rounded"
                                    title="Edit"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRealisasi(realisasi.id)}
                                    className="text-red-600 hover:text-red-800 transition-colors p-1 hover:bg-red-50 rounded"
                                    title="Hapus"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowRealisasiModal(false);
                  setSelectedPeriode(null);
                  setRealisasiViewOnly(false);
                  setRealisasiData([]);
                  setEditingRealisasiId(null);
                  setRealisasiForm({
                    tanggalRealisasi: new Date().toISOString().split('T')[0],
                    amount: '',
                    keterangan: '',
                  });
                }}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Realisasi Global */}
      {showImportGlobalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Import Realisasi Global</h2>
              <button
                onClick={() => setShowImportGlobalModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Instruksi Import</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
                  <ul className="list-disc list-inside space-y-2">
                    <li>File Excel harus memiliki format yang sesuai</li>
                    <li><strong>Kolom C (index 2):</strong> Nomor PO/PR</li>
                    <li><strong>Kolom J (index 9):</strong> Amount Realisasi</li>
                    <li>Sistem akan mencocokkan data berdasarkan <strong>Nomor PO</strong></li>
                    <li>Realisasi akan ditambahkan ke periode yang aktif atau periode dengan saldo tersisa</li>
                    <li>Baris dengan PO yang tidak ditemukan akan dilewati dan dilaporkan</li>
                  </ul>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload File Excel</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto mb-3 text-gray-400" size={48} />
                  <p className="text-sm text-gray-600 mb-4">
                    Pilih file Excel untuk import realisasi
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.xml"
                    onChange={handleGlobalExcelUpload}
                    disabled={uploadingGlobalExcel}
                    className="hidden"
                    id="global-excel-upload"
                  />
                  <label
                    htmlFor="global-excel-upload"
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      uploadingGlobalExcel
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    <Upload size={18} />
                    {uploadingGlobalExcel ? 'Mengupload...' : 'Pilih File Excel'}
                  </label>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-gray-700">
                <p className="font-semibold mb-2">⚠️ Perhatian:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Pastikan nomor PO di file Excel sama persis dengan data accrual</li>
                  <li>Import akan memproses semua baris yang memiliki PO dan amount valid</li>
                  <li>Proses import mungkin memakan waktu untuk file besar</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowImportGlobalModal(false)}
                disabled={uploadingGlobalExcel}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay untuk proses export/import */}
      {(uploadingExcel || uploadingGlobalExcel || uploadingImportExcel || submitting) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-2xl flex flex-col items-center space-y-4 max-w-sm mx-4">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-red-600 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-semibold text-gray-800">
                {uploadingImportExcel 
                  ? 'Mengimport file Excel...' 
                  : uploadingExcel || uploadingGlobalExcel 
                    ? 'Memproses file...' 
                    : 'Menyimpan data...'}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {uploadingImportExcel 
                  ? 'Mohon tunggu, proses mungkin memakan waktu untuk file besar...' 
                  : 'Mohon tunggu sebentar'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Excel Accrual */}
      {showImportExcelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Import Data Accrual dari Excel</h2>
              <button
                onClick={() => setShowImportExcelModal(false)}
                disabled={uploadingImportExcel}
                className={`text-white/80 hover:text-white transition-colors ${uploadingImportExcel ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload File Excel</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto mb-3 text-gray-400" size={48} />
                  <p className="text-sm text-gray-600 mb-4">
                    Pilih file Excel yang berisi data accrual
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    disabled={uploadingImportExcel}
                    className="hidden"
                    id="excel-import-upload"
                  />
                  <label
                    htmlFor="excel-import-upload"
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      uploadingImportExcel
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    <Upload size={18} />
                    {uploadingImportExcel ? 'Mengimport...' : 'Pilih File Excel'}
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
                <p className="font-semibold mb-2">📋 Format File Excel:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>File berisi beberapa sheet. Sistem memproses <strong>semua sheet yang namanya kode akun accrual</strong> (mis. 21600010, 21600012, 21600018).</li>
                  <li>Di sheet kode akun: kolom PEKERJAAN/KLASIFIKASI, VENDOR, PO/PR, ORDER, KETERANGAN, NILAI PO, <strong>OUTSTANDING/OUSTANDING/SALDO</strong>. <strong>Semua baris</strong> diproses (vendor sama, no PO beda = baris terpisah).</li>
                  <li>Sheet <strong>REKAP</strong>: hanya digunakan untuk kode akun yang <strong>tidak punya sheet sendiri</strong>. Kolom AKUN, KETERANGAN, SALDO AKHIR. Keterangan &quot;BIAYA YMH ...&quot; disesuaikan otomatis ke <strong>klasifikasi</strong> per kode akun.</li>
                  <li>Proses import mungkin memakan waktu untuk file besar dengan banyak baris.</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-gray-700">
                <p className="font-semibold mb-2">⚠️ Perhatian:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Kode akun <strong>tanpa detail</strong> (mis. 21600002–21600007): satu baris di REKAP = satu baris di tabel. Kode akun <strong>dengan detail</strong> (mis. 21600001, 21600008): satu baris di REKAP dipecah jadi beberapa baris sesuai detail (contoh 21600001 → Gaji dan Cuti Tahunan).</li>
                  <li>Accrual yang sudah ada (match kode akun + no PO + vendor, atau kode akun + klasifikasi) akan diupdate; lainnya dibuat baru.</li>
                  <li>Pastikan kolom saldo (OUTSTANDING/OUSTANDING/SALDO) ada di sheet kode akun agar data dapat diproses.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowImportExcelModal(false)}
                disabled={uploadingImportExcel}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
