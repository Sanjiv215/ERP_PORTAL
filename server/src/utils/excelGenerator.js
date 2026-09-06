import ExcelJS from 'exceljs';
import { BRAND, getBrandLogoBuffer } from '../config/branding.js';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

/**
 * Generates a formatted .xlsx workbook buffer for a Quotation or Invoice.
 * Uses centralized ERP Portal branding config and embeds logo image.
 *
 * @param {Object} docData - The quotation or invoice data.
 * @param {'quotation'|'invoice'} docType - Document type.
 * @param {Object} tenant - Tenant details.
 * @returns {Promise<Buffer>}
 */
export async function generateDocumentExcel(docData, docType = 'quotation', tenant = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.name;
  workbook.created = new Date();

  const isQuotation = docType === 'quotation';
  const docTitle = isQuotation ? 'Quotation / Estimate' : 'Tax Invoice';
  const docNumber = isQuotation ? docData.quotationNumber : docData.invoiceNumber;
  const docDate = isQuotation ? docData.quotationDate : docData.invoiceDate;
  const expiryOrDueDate = isQuotation ? docData.validUntil : docData.dueDate;
  const dateOfGeneration = formatDate(new Date().toISOString());

  const sheet = workbook.addWorksheet(docNumber || 'Document', {
    views: [{ showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: 'portrait' }
  });

  const businessName = BRAND.name;
  const tagline = BRAND.tagline;

  // ── Column Setup: 7 Columns ───────────────────────────────────────────────
  sheet.columns = [
    { key: 'srNo', width: 10 },
    { key: 'description', width: 34 },
    { key: 'size', width: 28 },
    { key: 'unit', width: 10 },
    { key: 'qty', width: 14 },
    { key: 'unitRate', width: 16 },
    { key: 'amount', width: 18 }
  ];

  // ── Header Rows ───────────────────────────────────────────────────────────
  // Row 1: Company Title (Brand Navy)
  const titleRow = sheet.addRow([businessName]);
  sheet.mergeCells('A1:G1');
  titleRow.height = 30;
  titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Row 2: Tagline (NO GST NUMBER)
  const subTitleRow = sheet.addRow([tagline || 'Precision Woodworking & Joinery Management']);
  sheet.mergeCells('A2:G2');
  subTitleRow.height = 18;
  subTitleRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0A8F9E' } };
  subTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Embed Logo Image if available
  const logoBuffer = getBrandLogoBuffer();
  if (logoBuffer) {
    try {
      const imageId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'png'
      });
      sheet.addImage(imageId, {
        tl: { col: 6.2, row: 0.1 },
        ext: { width: 44, height: 44 }
      });
    } catch {
      // Gracefully continue if worksheet image embedding is not supported in the current env
    }
  }

  sheet.addRow([]); // Blank spacer (Row 3)

  // Metadata Block (Rows 4-7) with Date of Generation, Client Name & Site Name
  const metaRow1 = sheet.addRow(['Document Type:', docTitle, '', 'Client Name:', docData.clientName || 'Valued Client']);
  metaRow1.getCell(1).font = { bold: true, color: { argb: 'FF0F5394' } };
  metaRow1.getCell(4).font = { bold: true, color: { argb: 'FF0F5394' } };

  const metaRow2 = sheet.addRow(['Document #:', docNumber, '', 'Site Name:', docData.siteName || docData.projectName || 'Direct Site']);
  metaRow2.getCell(1).font = { bold: true };
  metaRow2.getCell(4).font = { bold: true, color: { argb: 'FF0A8F9E' } };

  const metaRow3 = sheet.addRow(['Date of Generation:', dateOfGeneration, '', 'Client Address:', docData.clientAddress || '-']);
  metaRow3.getCell(1).font = { bold: true };
  metaRow3.getCell(4).font = { bold: true };

  const metaRow4 = sheet.addRow(['Document Date:', formatDate(docDate), '', isQuotation ? 'Valid Until:' : 'Due Date:', formatDate(expiryOrDueDate)]);
  metaRow4.getCell(1).font = { bold: true };
  metaRow4.getCell(4).font = { bold: true };

  sheet.addRow([]); // Blank spacer (Row 8)

  // ── Table Header (Row 9) ──────────────────────────────────────────────────
  const tableHeaderRow = sheet.addRow([
    'Sr. No.',
    'Description',
    'Size',
    'Unit',
    'Quantity',
    'Rate (₹)',
    'Amount (₹)'
  ]);
  tableHeaderRow.height = 24;

  for (let c = 1; c <= 7; c++) {
    const cell = tableHeaderRow.getCell(c);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: c === 1 || c === 4 ? 'center' : (c >= 5 ? 'right' : 'left'),
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F5394' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FF0F5394' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  }

  // ── Line Items Data Rows ──────────────────────────────────────────────────
  const lineItems = docData.lineItems || [];

  lineItems.forEach((li, idx) => {
    let sizeDisplay = '-';
    if (Array.isArray(li.sizes) && li.sizes.length > 0) {
      sizeDisplay = li.sizes.map((s) => (typeof s === 'string' ? s : `${s.label ? s.label + ': ' : ''}${s.length}x${s.width}`)).join(', ');
    } else if (li.size) {
      sizeDisplay = String(li.size);
    }

    const isEven = idx % 2 === 0;
    const qtyVal = Number(li.qty || 0);
    const rateVal = Number(li.unitPrice || 0);
    const amountVal = Math.round(qtyVal * rateVal * 100) / 100;

    const row = sheet.addRow([
      idx + 1,
      li.description || 'Joinery Work',
      sizeDisplay,
      (li.unit || 'sft').toLowerCase(),
      qtyVal,
      rateVal,
      amountVal
    ]);

    row.height = 22;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Arial', size: 9.5 };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === 1 || c === 4 ? 'center' : (c >= 5 ? 'right' : 'left'),
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (c === 5) cell.numFmt = '#,##0.00';
      if (c === 6 || c === 7) cell.numFmt = '₹#,##0.00';
    }
  });

  sheet.addRow([]); // Blank spacer

  // ── Calculation Summary Rows (0% GST) ─────────────────────────────────────
  const subtotal = Number(docData.subtotal || 0);
  const totalAmount = subtotal;

  // Subtotal Row
  const subtotalRow = sheet.addRow(['', '', '', '', '', 'Subtotal:', subtotal]);
  subtotalRow.getCell(6).font = { bold: true, color: { argb: 'FF475569' } };
  subtotalRow.getCell(6).alignment = { horizontal: 'right' };
  subtotalRow.getCell(7).font = { bold: true };
  subtotalRow.getCell(7).numFmt = '₹#,##0.00';

  // Tax Row (0% GST)
  const taxRow = sheet.addRow(['', '', '', '', '', 'GST (0%):', 0.00]);
  taxRow.getCell(6).font = { bold: true, color: { argb: 'FF475569' } };
  taxRow.getCell(6).alignment = { horizontal: 'right' };
  taxRow.getCell(7).font = { bold: true };
  taxRow.getCell(7).numFmt = '₹#,##0.00';

  // Total Amount Row
  const totalRow = sheet.addRow(['', '', '', '', '', isQuotation ? 'Estimated Total:' : 'Total Amount:', totalAmount]);
  totalRow.height = 24;
  totalRow.getCell(6).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };
  totalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
  totalRow.getCell(7).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };
  totalRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
  totalRow.getCell(7).numFmt = '₹#,##0.00';

  sheet.addRow([]);

  // ── Notes & Terms ─────────────────────────────────────────────────────────
  if (docData.notes) {
    const notesTitle = sheet.addRow(['Terms & Notes:']);
    notesTitle.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF0F5394' } };
    const notesContent = sheet.addRow([docData.notes]);
    sheet.mergeCells(`A${notesContent.number}:G${notesContent.number}`);
    notesContent.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF475569' } };
    notesContent.getCell(1).alignment = { wrapText: true };
  }

  // Footer Row
  const footerRow = sheet.addRow([BRAND.footerDisclaimer]);
  sheet.mergeCells(`A${footerRow.number}:G${footerRow.number}`);
  footerRow.getCell(1).font = { size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  footerRow.getCell(1).alignment = { horizontal: 'left' };

  return workbook.xlsx.writeBuffer();
}

/**
 * Generates a formatted .xlsx workbook buffer for Monthly Attendance Records.
 *
 * @param {Object} attendanceData - { period: 'YYYY-MM', rows: [...], employee: object (optional) }
 * @returns {Promise<Buffer>}
 */
export async function generateAttendanceExcel(attendanceData = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.name;
  workbook.created = new Date();

  const period = attendanceData.period || new Date().toISOString().slice(0, 7);
  const rows = Array.isArray(attendanceData.rows) ? attendanceData.rows : [];
  const singleEmp = attendanceData.employee || null;

  const sheet = workbook.addWorksheet('Attendance', {
    views: [{ showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  });

  sheet.columns = [
    { key: 'employeeName', width: 26 },
    { key: 'wageType', width: 14 },
    { key: 'presentDays', width: 16 },
    { key: 'halfDays', width: 16 },
    { key: 'overtimeDays', width: 16 },
    { key: 'absentDays', width: 16 },
    { key: 'leaveDays', width: 14 },
    { key: 'totalDayEquivalents', width: 18 },
    { key: 'grossPayable', width: 20 }
  ];

  // Header Title Row (Brand Navy)
  const titleRow = sheet.addRow([BRAND.name]);
  sheet.mergeCells('A1:I1');
  titleRow.height = 30;
  titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Subtitle Row
  const subTitleRow = sheet.addRow([`Attendance Summary Report — Period: ${period}${singleEmp ? ` | Employee: ${singleEmp.name}` : ''}`]);
  sheet.mergeCells('A2:I2');
  subTitleRow.height = 20;
  subTitleRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0A8F9E' } };
  subTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Embed Logo Image
  const logoBuffer = getBrandLogoBuffer();
  if (logoBuffer) {
    try {
      const imageId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'png'
      });
      sheet.addImage(imageId, {
        tl: { col: 8.1, row: 0.1 },
        ext: { width: 44, height: 44 }
      });
    } catch {
      // Gracefully continue if worksheet image embedding fails
    }
  }

  sheet.addRow([]); // Blank spacer

  // Table Column Headers
  const headerRow = sheet.addRow([
    'Employee Name',
    'Wage Type',
    'Present (1.0x)',
    'Half Day (0.5x)',
    'Overtime (1.5x)',
    'Absent (0.0x)',
    'Leave',
    'Total Day Units',
    'Gross Payable'
  ]);
  headerRow.height = 24;

  for (let colIndex = 1; colIndex <= 9; colIndex++) {
    const cell = headerRow.getCell(colIndex);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };
    cell.alignment = { vertical: 'middle', horizontal: colIndex >= 3 ? 'center' : 'left' };
  }

  // Data Rows
  for (const r of rows) {
    const row = sheet.addRow([
      r.employeeName || r.name || '-',
      (r.wageType || 'daily').toUpperCase(),
      Number(r.presentDays || 0),
      Number(r.halfDays || 0),
      Number(r.overtimeDays || 0),
      Number(r.absentDays || 0),
      Number(r.leaveDays || 0),
      Number(r.totalDayEquivalents || 0),
      Number(r.grossPayable || 0)
    ]);

    row.height = 20;

    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: c >= 3 ? 'center' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (c === 9) cell.numFmt = '₹#,##0.00';
    }
  }

  sheet.addRow([]);

  // Footer Disclaimer
  const footerRow = sheet.addRow([BRAND.footerDisclaimer]);
  sheet.mergeCells(`A${footerRow.number}:I${footerRow.number}`);
  footerRow.getCell(1).font = { size: 8, italic: true, color: { argb: 'FF94A3B8' } };

  return workbook.xlsx.writeBuffer();
}

/**
 * Generates a styled .xlsx workbook buffer for Transaction History.
 */
export async function generateTransactionHistoryExcel(txData = {}, tenant = {}, query = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Transactions', {
    views: [{ showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  });

  const businessName = BRAND.name;
  const items = Array.isArray(txData.items) ? txData.items : [];
  const summary = txData.summary || { totalIn: 0, totalOut: 0, netBalance: 0 };

  sheet.columns = [
    { key: 'date', width: 14 },
    { key: 'type', width: 18 },
    { key: 'party', width: 28 },
    { key: 'description', width: 36 },
    { key: 'flow', width: 12 },
    { key: 'amount', width: 18 },
    { key: 'status', width: 14 }
  ];

  // Title
  const titleRow = sheet.addRow([businessName]);
  sheet.mergeCells('A1:G1');
  titleRow.height = 28;
  titleRow.getCell(1).font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };

  // Subtitle
  const subRow = sheet.addRow(['Financial Transaction Statement — ' + formatDate(new Date().toISOString())]);
  sheet.mergeCells('A2:G2');
  subRow.height = 20;
  subRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
  subRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  sheet.addRow([]);

  // Summary Row
  const summaryRow = sheet.addRow([
    `Total In: ₹${summary.totalIn.toLocaleString('en-IN')}`,
    '',
    `Total Out: ₹${summary.totalOut.toLocaleString('en-IN')}`,
    '',
    `Net Balance: ₹${summary.netBalance.toLocaleString('en-IN')}`,
    '',
    `Count: ${items.length}`
  ]);
  summaryRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F5394' } };

  sheet.addRow([]);

  // Table Header
  const headerRow = sheet.addRow(['Date', 'Type', 'Party / Entity', 'Description / Note', 'Flow', 'Amount (₹)', 'Status']);
  headerRow.height = 24;
  for (let c = 1; c <= 7; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5394' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 6 ? 'right' : 'left' };
  }

  // Data Rows
  for (const it of items) {
    const typeLabel = it.type === 'client_payment' ? 'Client Payment' : it.type === 'payroll' ? 'Payroll' : 'Advance';
    const row = sheet.addRow([
      formatDate(it.transactionDate),
      typeLabel,
      it.partyName || '-',
      it.description || '-',
      it.flow === 'in' ? 'Money In' : 'Money Out',
      Number(it.amount || 0),
      (it.status || '').toUpperCase()
    ]);
    row.height = 20;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: c === 6 ? 'right' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (c === 6) {
        cell.numFmt = '₹#,##0.00';
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: true,
          color: { argb: it.flow === 'in' ? 'FF047857' : 'FFB91C1C' }
        };
      }
    }
  }

  sheet.addRow([]);
  const foot = sheet.addRow([BRAND.footerDisclaimer]);
  sheet.mergeCells(`A${foot.number}:G${foot.number}`);
  foot.getCell(1).font = { size: 8, italic: true, color: { argb: 'FF94A3B8' } };

  return workbook.xlsx.writeBuffer();
}


