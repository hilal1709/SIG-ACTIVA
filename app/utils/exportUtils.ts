import ExcelJS from 'exceljs';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export async function exportToExcel(data: any[], filename: string) {
  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Material Data');
  
  // Set column widths
  worksheet.columns = [
    { width: 40 }, // Row Labels (Material/Location)
    { width: 12 }, { width: 12 }, { width: 12 }, // Stok Awal
    { width: 12 }, { width: 12 }, { width: 12 }, // Produksi
    { width: 12 }, { width: 12 }, { width: 12 }, // Rilis
    { width: 12 }, { width: 12 }, { width: 12 }, // Stok Akhir
  ];
  
  // Add main header row
  worksheet.mergeCells('A1:A2');
  worksheet.getCell('A1').value = 'Row Labels';
  
  worksheet.mergeCells('B1:D1');
  worksheet.getCell('B1').value = '1 - Stok Awal';
  
  worksheet.mergeCells('E1:G1');
  worksheet.getCell('E1').value = '2 - Produksi';
  
  worksheet.mergeCells('H1:J1');
  worksheet.getCell('H1').value = '3 - Rilis';
  
  worksheet.mergeCells('K1:M1');
  worksheet.getCell('K1').value = '4 - Stok Akhir';
  
  // Add sub-header row
  worksheet.getCell('B2').value = 'OPR';
  worksheet.getCell('C2').value = 'SAP';
  worksheet.getCell('D2').value = 'Selisih';
  worksheet.getCell('E2').value = 'OPR';
  worksheet.getCell('F2').value = 'SAP';
  worksheet.getCell('G2').value = 'Selisih';
  worksheet.getCell('H2').value = 'OPR';
  worksheet.getCell('I2').value = 'SAP';
  worksheet.getCell('J2').value = 'Selisih';
  worksheet.getCell('K2').value = 'OPR';
  worksheet.getCell('L2').value = 'SAP';
  worksheet.getCell('M2').value = 'Selisih';
  
  // Style header rows
  const headerStyle = {
    font: { bold: true, size: 10 },
    alignment: { vertical: 'middle' as const, horizontal: 'center' as const },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF3F4F6' }
    },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  };
  
  // Apply style to header cells
  for (let col = 1; col <= 13; col++) {
    worksheet.getCell(1, col).style = headerStyle;
    worksheet.getCell(2, col).style = headerStyle;
  }
  
  // Group data by material
  const groupedData: { [key: string]: any[] } = {};
  data.forEach(item => {
    const materialKey = item['Material ID'];
    if (!groupedData[materialKey]) {
      groupedData[materialKey] = [];
    }
    groupedData[materialKey].push(item);
  });
  
  let currentRow = 3;
  
  // Add data rows grouped by material
  Object.entries(groupedData).forEach(([materialId, items]) => {
    // Add material header row (merged, bold, with background)
    const materialName = items[0]['Material Name'];
    worksheet.mergeCells(currentRow, 1, currentRow, 13);
    const materialCell = worksheet.getCell(currentRow, 1);
    materialCell.value = `${materialId} | ${materialName}`;
    materialCell.style = {
      font: { bold: true, size: 10 },
      alignment: { vertical: 'middle', horizontal: 'left' },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' } // Orange-ish background like web
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
    currentRow++;
    
    // Add location rows for this material
    items.forEach(item => {
      const row = worksheet.getRow(currentRow);
      
      // Helper function to check if selisih should be displayed (5% threshold for Stok Awal/Akhir)
      const shouldShowSelisih = (selisih: number, sap: number, applyThreshold: boolean) => {
        if (!applyThreshold) return selisih; // Always show for Produksi and Rilis
        
        // For Stok Awal and Stok Akhir: only show if > 5% of SAP value
        const sapValue = Number(sap);
        const selisihValue = Number(selisih);
        
        if (sapValue === 0 || isNaN(sapValue) || isNaN(selisihValue)) return selisihValue;
        
        const percentage = Math.abs(selisihValue / sapValue);
        return percentage > 0.05 ? selisihValue : 0; // Return 0 instead of null
      };
      
      row.getCell(1).value = item['Location'];
      row.getCell(2).value = item['Stok Awal - OPR'];
      row.getCell(3).value = item['Stok Awal - SAP'];
      row.getCell(4).value = shouldShowSelisih(item['Stok Awal - Selisih'], item['Stok Awal - SAP'], true);
      row.getCell(5).value = item['Produksi - OPR'];
      row.getCell(6).value = item['Produksi - SAP'];
      row.getCell(7).value = shouldShowSelisih(item['Produksi - Selisih'], item['Produksi - SAP'], false);
      row.getCell(8).value = item['Rilis - OPR'];
      row.getCell(9).value = item['Rilis - SAP'];
      row.getCell(10).value = shouldShowSelisih(item['Rilis - Selisih'], item['Rilis - SAP'], false);
      row.getCell(11).value = item['Stok Akhir - OPR'];
      row.getCell(12).value = item['Stok Akhir - SAP'];
      row.getCell(13).value = shouldShowSelisih(item['Stok Akhir - Selisih'], item['Stok Akhir - SAP'], true);
      
      // Apply border and alignment to data cells
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        if (colNumber === 1) {
          // Location column - left aligned with indent
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
          cell.font = { size: 10 };
        } else {
          // Number columns - right aligned with default black font
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          
          // Format numbers properly - show decimals if they exist
          const cellValue = Number(cell.value);
          if (!isNaN(cellValue)) {
            if (cellValue === 0) {
              cell.value = 0; // Plain zero without formatting
            } else {
              cell.numFmt = '#,##0.###'; // Thousand separator with optional decimals
            }
          }
          
          cell.font = { size: 10 }; // Default black font for all number cells
          
          // Highlight selisih columns (D, G, J, M) in red ONLY if non-zero
          if (colNumber === 4 || colNumber === 7 || colNumber === 10 || colNumber === 13) {
            const value = Number(cell.value);
            // Only apply red color if value is not zero
            if (!isNaN(value) && Math.abs(value) > 0.001) {
              cell.font = { size: 10, color: { argb: 'FFDC2626' }, bold: true };
            }
          }
        }
      });
      
      currentRow++;
    });
  });
  
  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export function exportToCSV(data: any[], filename: string, headers: string[]) {
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle null/undefined values
        if (value === null || value === undefined) {
          return '0';
        }
        // Handle strings with commas by wrapping in quotes
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    ) 
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
