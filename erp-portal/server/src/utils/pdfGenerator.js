import PDFDocument from 'pdfkit';
import { BRAND, getBrandLogoBuffer } from '../config/branding.js';

function formatCurrency(n) {
  return 'Rs. ' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

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
 * Generates a clean, modern, branded PDF for Quotation or Invoice.
 * Uses centralized branding configuration and real TheWoodWise logo asset.
 *
 * @param {Object} docData - The quotation or invoice data.
 * @param {'quotation'|'invoice'} docType - Document type ('quotation' | 'invoice').
 * @param {Object} tenant - Tenant details (signature_data, business_name).
 * @returns {Promise<Buffer>}
 */
export function generateDocumentPdf(docData, docType = 'quotation', tenant = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const isQuotation = docType === 'quotation';
      const docTitle = isQuotation ? 'QUOTATION / ESTIMATE' : 'TAX INVOICE';
      const docNumber = isQuotation ? docData.quotationNumber : docData.invoiceNumber;
      const docDate = isQuotation ? docData.quotationDate : docData.invoiceDate;
      const expiryOrDueDate = isQuotation ? docData.validUntil : docData.dueDate;
      const expiryLabel = isQuotation ? 'Valid Until:' : 'Due Date:';
      const dateOfGeneration = formatDate(new Date().toISOString());

      // Business name always pulls from BRAND, with tenant fallback if specified
      const businessName = BRAND.name;
      const tagline = BRAND.tagline;
      const colors = BRAND.colors;

      // ── Top Header Brand Accent Bar ─────────────────────────────────────────
      doc.rect(40, 36, 515, 3).fill(colors.primaryNavy);

      // ── Brand Logo & Header Typography ──────────────────────────────────────
      const logoBuffer = getBrandLogoBuffer();
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, 48, { width: 44, height: 44 });
        } catch {
          // Fallback circular badge if image rendering encounters an error
          doc.circle(62, 70, 20).fill(colors.primaryNavy);
          doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold').text('W', 42, 64, { width: 40, align: 'center' });
        }
      } else {
        doc.circle(62, 70, 20).fill(colors.primaryNavy);
        doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold').text('W', 42, 64, { width: 40, align: 'center' });
      }

      // Company Name & Subtitle
      doc.fillColor(colors.primaryNavy)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(businessName, 92, 48);

      if (tagline) {
        doc.fillColor(colors.secondaryTeal)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(tagline, 92, 70);
      }

      // Top Right Document Type, Number & Generation Date
      doc.fillColor(colors.primaryNavy)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text(docTitle, 315, 46, { align: 'right', width: 240 });

      doc.fillColor(colors.darkSlate)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(docNumber, 315, 62, { align: 'right', width: 240 });

      doc.fillColor(colors.mutedText)
        .fontSize(7.5)
        .font('Helvetica')
        .text(`Date of Generation: ${dateOfGeneration}`, 315, 75, { align: 'right', width: 240 })
        .text(`Doc Date: ${formatDate(docDate)}  |  ${expiryLabel} ${formatDate(expiryOrDueDate)}`, 315, 87, { align: 'right', width: 240 });

      // Subtle Divider
      doc.moveTo(40, 102).lineTo(555, 102).strokeColor(colors.border).lineWidth(0.75).stroke();

      // ── Client Details & Site Location Section ──────────────────────────────
      doc.roundedRect(40, 110, 515, 58, 4).fillAndStroke(colors.lightBg, colors.border);

      // Left: Client Details
      doc.fillColor(colors.mutedText)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('CLIENT DETAILS', 52, 118);

      doc.fillColor(colors.darkSlate)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(docData.clientName || 'Valued Client', 52, 129);

      if (docData.clientAddress) {
        doc.fillColor(colors.bodyText)
          .fontSize(7.5)
          .font('Helvetica')
          .text(docData.clientAddress, 52, 142, { width: 240, height: 20 });
      }

      // Right: Site / Project Location
      doc.fillColor(colors.mutedText)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('SITE / PROJECT LOCATION', 320, 118);

      doc.fillColor(colors.secondaryTeal)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(docData.siteName || docData.projectName || 'Main Workshop / Direct Site', 320, 129, { width: 225 });

      if (docData.projectName && docData.siteName) {
        doc.fillColor(colors.mutedText)
          .fontSize(7.5)
          .font('Helvetica')
          .text(`Project: ${docData.projectName}`, 320, 142, { width: 225 });
      }

      // ── 7-Column Line Items Table ───────────────────────────────────────────
      let y = 178;

      // Table Header: Sr. | Description | Size(s) | Unit | Quantity | Rate | Amount
      doc.roundedRect(40, y, 515, 20, 3).fill(colors.primaryNavy);
      doc.fillColor(colors.white)
        .fontSize(7.5)
        .font('Helvetica-Bold');

      doc.text('Sr.', 42, y + 6, { width: 24, align: 'center' });
      doc.text('Description', 68, y + 6, { width: 175 });
      doc.text('Size(s)', 245, y + 6, { width: 105 });
      doc.text('Unit', 352, y + 6, { width: 32, align: 'center' });
      doc.text('Qty', 386, y + 6, { width: 44, align: 'right' });
      doc.text('Rate (Rs)', 432, y + 6, { width: 56, align: 'right' });
      doc.text('Amount (Rs)', 490, y + 6, { width: 60, align: 'right' });

      y += 22;

      const lineItems = docData.lineItems || [];

      lineItems.forEach((li, index) => {
        if (y > 680) {
          doc.addPage();
          y = 50;
        }

        const isEven = index % 2 === 0;
        const itemY = y;

        // Size representation
        let sizeDisplay = '-';
        if (Array.isArray(li.sizes) && li.sizes.length > 0) {
          sizeDisplay = li.sizes.map((s) => (typeof s === 'string' ? s : `${s.label ? s.label + ': ' : ''}${s.length}x${s.width}`)).join(', ');
        } else if (li.size) {
          sizeDisplay = String(li.size);
        }

        const desc = li.description || 'Woodworking & Joinery';
        const unit = (li.unit || 'sft').toLowerCase();
        const qtyVal = Number(li.qty || 0);
        const rateVal = Number(li.unitPrice || 0);
        const amountVal = Math.round(qtyVal * rateVal * 100) / 100;

        const rowHeight = Math.max(18, 11 + Math.ceil(sizeDisplay.length / 24) * 8);

        if (isEven) {
          doc.rect(40, itemY, 515, rowHeight).fill(colors.lightBg);
        }

        // 1. Sr. No.
        doc.fillColor(colors.mutedText)
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .text(String(index + 1), 42, itemY + 4, { width: 24, align: 'center' });

        // 2. Description
        doc.fillColor(colors.darkSlate)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(desc, 68, itemY + 4, { width: 175 });

        // 3. Size
        doc.fillColor(colors.primaryNavy)
          .fontSize(7.5)
          .font('Helvetica')
          .text(sizeDisplay, 245, itemY + 4, { width: 105 });

        // 4. Unit
        doc.fillColor(colors.bodyText)
          .fontSize(7.5)
          .font('Helvetica')
          .text(unit, 352, itemY + 4, { width: 32, align: 'center' });

        // 5. Quantity
        doc.fillColor(colors.darkSlate)
          .fontSize(8)
          .font('Helvetica')
          .text(qtyVal.toLocaleString('en-IN', { maximumFractionDigits: 2 }), 386, itemY + 4, { width: 44, align: 'right' });

        // 6. Rate
        doc.fillColor(colors.bodyText)
          .fontSize(8)
          .font('Helvetica')
          .text(rateVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 432, itemY + 4, { width: 56, align: 'right' });

        // 7. Amount
        doc.fillColor(colors.darkSlate)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 490, itemY + 4, { width: 60, align: 'right' });

        doc.moveTo(40, itemY + rowHeight).lineTo(555, itemY + rowHeight).strokeColor(colors.border).lineWidth(0.5).stroke();

        y += rowHeight;
      });

      // ── Calculation Summary ─────────────────────────────────────────────────
      y += 12;
      if (y > 660) {
        doc.addPage();
        y = 50;
      }

      const summaryY = y;
      const subtotal = Number(docData.subtotal || 0);
      const totalAmount = subtotal; // 0% GST: Total strictly equals Subtotal

      // Left Box: Notes & Terms
      doc.roundedRect(40, summaryY, 280, 72, 4).fillAndStroke(colors.lightBg, colors.border);
      doc.fillColor(colors.primaryNavy)
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .text('TERMS, NOTES & PAYMENT INSTRUCTIONS:', 48, summaryY + 7);

      doc.fillColor(colors.bodyText)
        .fontSize(7)
        .font('Helvetica')
        .text(
          docData.notes || '1. Estimates are valid for 30 days.\n2. 50% advance required to commence production.\n3. Goods once fabricated cannot be returned.',
          48,
          summaryY + 18,
          { width: 264, lineGap: 2 }
        );

      // Right Box: Totals Breakdown (0% GST)
      doc.fillColor(colors.mutedText)
        .fontSize(8)
        .font('Helvetica')
        .text('Subtotal:', 340, summaryY + 5)
        .text(formatCurrency(subtotal), 430, summaryY + 5, { width: 120, align: 'right' });

      doc.text('GST (0%):', 340, summaryY + 18)
        .text('Rs. 0.00', 430, summaryY + 18, { width: 120, align: 'right' });

      doc.roundedRect(335, summaryY + 34, 220, 26, 4).fill(colors.primaryNavy);
      doc.fillColor(colors.white)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(isQuotation ? 'Estimated Total:' : 'Total Amount:', 345, summaryY + 41)
        .text(formatCurrency(totalAmount), 430, summaryY + 41, { width: 120, align: 'right' });

      // ── Digital Signature Section (Toggled On / Off) ────────────────────────
      const includeSignature = Boolean(docData.includeSignature);

      if (includeSignature) {
        let sigY = summaryY + 86;
        if (sigY > 730) {
          doc.addPage();
          sigY = 60;
        }

        // Render digital signature if available
        if (tenant?.signature_data && typeof tenant.signature_data === 'string' && tenant.signature_data.startsWith('data:image')) {
          try {
            const base64Data = tenant.signature_data.split(',')[1];
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, 410, sigY, { width: 120, height: 35, fit: [120, 35] });
          } catch {
            doc.fillColor(colors.primaryNavy)
              .fontSize(13)
              .font('Helvetica-Bold')
              .text(businessName, 410, sigY + 8, { align: 'right', width: 140 });
          }
        } else {
          doc.fillColor(colors.primaryNavy)
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Digitally Verified', 410, sigY + 8, { align: 'right', width: 140 });
        }

        doc.moveTo(410, sigY + 40).lineTo(555, sigY + 40).strokeColor('#94A3B8').lineWidth(0.75).stroke();

        doc.fillColor(colors.darkSlate)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(BRAND.signatoryTitle, 410, sigY + 44, { align: 'right', width: 140 });

        doc.fillColor(colors.mutedText)
          .fontSize(7)
          .font('Helvetica')
          .text(businessName, 410, sigY + 54, { align: 'right', width: 140 });
      }

      // ── Footer ──────────────────────────────────────────────────────────────
      const footerY = 760;
      doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(colors.border).lineWidth(0.5).stroke();

      doc.fillColor(colors.mutedText)
        .fontSize(7)
        .font('Helvetica')
        .text(BRAND.footerDisclaimer, 40, footerY + 6);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a clean, modern, branded PDF Payslip for an employee.
 * Shows detailed breakdown of advances (date given, notes, amount, total advances deducted),
 * gross pay, deductions, bonuses, and final net salary.
 *
 * @param {Object} payslipData - Payslip data containing tenant, run, employee, lineItem, adjustments.
 * @returns {Promise<Buffer>}
 */
export function generatePayslipPdf(payslipData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const tenant = payslipData.tenant || {};
      const run = payslipData.run || { periodMonth: new Date().getMonth() + 1, periodYear: new Date().getFullYear() };
      const employee = payslipData.employee || { name: payslipData.lineItem?.employeeName || 'Staff Member' };
      const lineItem = payslipData.lineItem || {};
      const adjustments = Array.isArray(payslipData.adjustments) ? payslipData.adjustments : [];

      const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const pStart = lineItem.periodStartDate || run.periodStartDate;
      const pEnd = lineItem.periodEndDate || run.periodEndDate;
      let periodLabel = monthLabel;
      if (pStart && pEnd) {
        periodLabel = `${formatDate(pStart)} – ${formatDate(pEnd)}`;
      }

      const businessName = BRAND.name;
      const tagline = BRAND.tagline;
      const colors = BRAND.colors;

      // ── Top Header Brand Accent Bar ─────────────────────────────────────────
      doc.rect(40, 36, 515, 3).fill(colors.primaryNavy);

      // ── Brand Logo & Header Typography ──────────────────────────────────────
      const logoBuffer = getBrandLogoBuffer();
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, 48, { width: 44, height: 44 });
        } catch {
          doc.circle(62, 70, 20).fill(colors.primaryNavy);
          doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold').text('W', 42, 64, { width: 40, align: 'center' });
        }
      } else {
        doc.circle(62, 70, 20).fill(colors.primaryNavy);
        doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold').text('W', 42, 64, { width: 40, align: 'center' });
      }

      // Company Name & Subtitle
      doc.fillColor(colors.primaryNavy)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(businessName, 92, 48);

      if (tagline) {
        doc.fillColor(colors.secondaryTeal)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(tagline, 92, 70);
      }

      // Top Right Document Type & Period
      doc.fillColor(colors.primaryNavy)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('WAGE PAYSLIP', 315, 46, { align: 'right', width: 240 });

      doc.fillColor(colors.darkSlate)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(periodLabel, 315, 62, { align: 'right', width: 240 });

      doc.fillColor(colors.mutedText)
        .fontSize(7.5)
        .font('Helvetica')
        .text(`Generated: ${formatDate(new Date().toISOString())}`, 315, 75, { align: 'right', width: 240 });

      doc.moveTo(40, 100).lineTo(555, 100).strokeColor(colors.border).lineWidth(1).stroke();

      // ── Employee & Wage Details Box ────────────────────────────────────────
      doc.roundedRect(40, 110, 515, 60, 6).fill(colors.lightBg);

      doc.fillColor(colors.mutedText).fontSize(7).font('Helvetica-Bold').text('EMPLOYEE NAME', 55, 118);
      doc.fillColor(colors.darkSlate).fontSize(11).font('Helvetica-Bold').text(employee.name || lineItem.employeeName || '-', 55, 128);
      if (employee.phone) {
        doc.fillColor(colors.mutedText).fontSize(8).font('Helvetica').text(`Phone: ${employee.phone}`, 55, 144);
      }

      doc.fillColor(colors.mutedText).fontSize(7).font('Helvetica-Bold').text('WAGE STRUCTURE', 320, 118);
      doc.fillColor(colors.darkSlate).fontSize(9.5).font('Helvetica-Bold').text(`DAILY RATE @ ${formatCurrency(employee.wageRate || lineItem.wageRate)}/day`, 320, 128);
      const isPaid = (lineItem.paymentStatus || 'pending').toLowerCase() === 'paid';
      doc.fillColor(isPaid ? '#059669' : '#D97706').fontSize(8.5).font('Helvetica-Bold').text(`Status: ${(lineItem.paymentStatus || 'pending').toUpperCase()}`, 320, 144);

      // ── Attendance Summary Table ────────────────────────────────────────────
      doc.fillColor(colors.primaryNavy).fontSize(9).font('Helvetica-Bold').text('ATTENDANCE & WORK UNITS', 40, 185);

      const tableY = 200;
      doc.rect(40, tableY, 515, 20).fill('#F1F5F9');
      doc.fillColor(colors.darkSlate).fontSize(8).font('Helvetica-Bold');
      doc.text('Present (1.0x)', 45, tableY + 6, { width: 100, align: 'center' });
      doc.text('Half Day (0.5x)', 145, tableY + 6, { width: 100, align: 'center' });
      doc.text('Overtime (1.5x)', 245, tableY + 6, { width: 100, align: 'center' });
      doc.text('Absent (0.0x)', 345, tableY + 6, { width: 100, align: 'center' });
      doc.text('Day Equivalents', 445, tableY + 6, { width: 100, align: 'center' });

      const rowY = tableY + 20;
      doc.rect(40, rowY, 515, 22).strokeColor(colors.border).stroke();
      doc.fillColor(colors.darkSlate).fontSize(9).font('Helvetica');
      doc.text(String(lineItem.presentDays ?? 0), 45, rowY + 6, { width: 100, align: 'center' });
      doc.text(String(lineItem.halfDays ?? 0), 145, rowY + 6, { width: 100, align: 'center' });
      doc.text(String(lineItem.overtimeDays ?? 0), 245, rowY + 6, { width: 100, align: 'center' });
      doc.text(String(lineItem.absentDays ?? 0), 345, rowY + 6, { width: 100, align: 'center' });
      doc.font('Helvetica-Bold').text(String(lineItem.totalDayEquivalents ?? lineItem.dayEquivalents ?? 0), 445, rowY + 6, { width: 100, align: 'center' });

      // ── Earnings & Deductions Breakdown (Including Advances Itemization) ───
      let breakdownY = 260;

      // Earnings Column Left (width 245)
      doc.fillColor('#065F46').fontSize(9.5).font('Helvetica-Bold').text('EARNINGS', 40, breakdownY);
      doc.moveTo(40, breakdownY + 12).lineTo(285, breakdownY + 12).strokeColor('#A7F3D0').lineWidth(1).stroke();

      let eY = breakdownY + 18;
      doc.fillColor(colors.darkSlate).fontSize(8.5).font('Helvetica').text('Base Gross Wages', 40, eY);
      doc.font('Helvetica-Bold').text(formatCurrency(lineItem.grossAmount), 185, eY, { width: 100, align: 'right' });
      eY += 16;

      const bonuses = adjustments.filter((a) => a && a.type === 'bonus');
      for (const b of bonuses) {
        doc.fillColor('#065F46').fontSize(8.5).font('Helvetica').text(b.label || 'Bonus', 40, eY);
        doc.font('Helvetica-Bold').text(`+${formatCurrency(b.amount)}`, 185, eY, { width: 100, align: 'right' });
        eY += 16;
      }

      // Deductions Column Right (width 255)
      doc.fillColor('#991B1B').fontSize(9.5).font('Helvetica-Bold').text('DEDUCTIONS & ADVANCES', 300, breakdownY);
      doc.moveTo(300, breakdownY + 12).lineTo(555, breakdownY + 12).strokeColor('#FECACA').lineWidth(1).stroke();

      let dY = breakdownY + 18;
      const deductions = adjustments.filter((a) => a && a.type === 'deduction');

      // Separate advances vs other deductions
      const advancesList = deductions.filter((d) => d.advanceId || (d.label && d.label.toLowerCase().includes('advance')));
      const otherDeductions = deductions.filter((d) => !advancesList.includes(d));

      let totalAdvancesDeducted = 0;

      if (advancesList.length > 0) {
        doc.fillColor('#991B1B').fontSize(8.5).font('Helvetica-Bold').text('Employee Advances Taken:', 300, dY);
        dY += 14;

        for (const adv of advancesList) {
          totalAdvancesDeducted += Number(adv.amount || 0);
          const advLabel = adv.label || `Advance (${formatDate(adv.advance_date)})`;
          doc.fillColor(colors.darkSlate).fontSize(8).font('Helvetica').text(`• ${advLabel}`, 310, dY, { width: 160 });
          doc.fillColor('#991B1B').fontSize(8).font('Helvetica-Bold').text(`-${formatCurrency(adv.amount)}`, 470, dY, { width: 85, align: 'right' });
          dY += 14;
        }

        doc.fillColor(colors.darkSlate).fontSize(8).font('Helvetica-Bold').text('Total Advances Deducted:', 310, dY);
        doc.fillColor('#991B1B').fontSize(8.5).font('Helvetica-Bold').text(`-${formatCurrency(totalAdvancesDeducted)}`, 470, dY, { width: 85, align: 'right' });
        dY += 18;
      }

      for (const od of otherDeductions) {
        doc.fillColor(colors.darkSlate).fontSize(8.5).font('Helvetica').text(od.label || 'Other Deduction', 300, dY, { width: 170 });
        doc.fillColor('#991B1B').fontSize(8.5).font('Helvetica-Bold').text(`-${formatCurrency(od.amount)}`, 470, dY, { width: 85, align: 'right' });
        dY += 16;
      }

      if (deductions.length === 0) {
        doc.fillColor(colors.mutedText).fontSize(8.5).font('Helvetica-Oblique').text('No deductions or advances recorded.', 300, dY);
        dY += 16;
      }

      let maxY = Math.max(eY, dY) + 20;
      if (maxY + 50 > 740) {
        doc.addPage();
        maxY = 40;
      }

      // ── Net Salary Total Box ────────────────────────────────────────────────
      doc.roundedRect(40, maxY, 515, 48, 6).fill(colors.primaryNavy);

      doc.fillColor(colors.white).fontSize(8).font('Helvetica').text('NET DISBURSED WAGES', 55, maxY + 10);
      doc.fillColor(colors.white).fontSize(16).font('Helvetica-Bold').text(formatCurrency(lineItem.netAmount), 55, maxY + 22);

      doc.fillColor(colors.white).fontSize(7.5).font('Helvetica')
        .text('Issued by TheWoodWise Payroll Engine', 340, maxY + 14, { align: 'right', width: 200 })
        .text(`Date of Issue: ${formatDate(new Date().toISOString())}`, 340, maxY + 26, { align: 'right', width: 200 });

      // ── Footer Disclaimer ───────────────────────────────────────────────────
      const footerY = 760;
      doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(colors.border).lineWidth(0.5).stroke();
      doc.fillColor(colors.mutedText).fontSize(7).font('Helvetica').text(BRAND.footerDisclaimer, 40, footerY + 6);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a clean, modern, branded PDF for Monthly Attendance Records.
 *
 * @param {Object} attendanceData - { period: 'YYYY-MM', rows: [...], employee: object (optional) }
 * @returns {Promise<Buffer>}
 */
export function generateAttendancePdf(attendanceData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const period = attendanceData.period || new Date().toISOString().slice(0, 7);
      const rows = Array.isArray(attendanceData.rows) ? attendanceData.rows : [];
      const singleEmp = attendanceData.employee || null;

      const businessName = BRAND.name;
      const tagline = BRAND.tagline;
      const colors = BRAND.colors;

      // Top Accent Bar (Width 762 for landscape A4)
      doc.rect(40, 30, 762, 3).fill(colors.primaryNavy);

      // Logo & Brand Header
      const logoBuffer = getBrandLogoBuffer();
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, 40, { width: 40, height: 40 });
        } catch {
          doc.circle(60, 60, 18).fill(colors.primaryNavy);
          doc.fillColor(colors.white).fontSize(12).font('Helvetica-Bold').text('W', 42, 54, { width: 36, align: 'center' });
        }
      } else {
        doc.circle(60, 60, 18).fill(colors.primaryNavy);
        doc.fillColor(colors.white).fontSize(12).font('Helvetica-Bold').text('W', 42, 54, { width: 36, align: 'center' });
      }

      doc.fillColor(colors.primaryNavy).fontSize(16).font('Helvetica-Bold').text(businessName, 88, 40);
      if (tagline) {
        doc.fillColor(colors.secondaryTeal).fontSize(8).font('Helvetica-Bold').text(tagline, 88, 60);
      }

      doc.fillColor(colors.primaryNavy).fontSize(14).font('Helvetica-Bold').text('ATTENDANCE REPORT', 500, 40, { align: 'right', width: 300 });
      doc.fillColor(colors.darkSlate).fontSize(9.5).font('Helvetica-Bold').text(`Period: ${period}${singleEmp ? ` | Employee: ${singleEmp.name}` : ''}`, 500, 58, { align: 'right', width: 300 });

      doc.moveTo(40, 85).lineTo(802, 85).strokeColor(colors.border).lineWidth(1).stroke();

      // Attendance Table Header
      let y = 95;
      doc.rect(40, y, 762, 22).fill(colors.primaryNavy);
      doc.fillColor(colors.white).fontSize(8).font('Helvetica-Bold');
      doc.text('Employee Name', 45, y + 6, { width: 140 });
      doc.text('Wage Type', 190, y + 6, { width: 70 });
      doc.text('Present (1.0x)', 265, y + 6, { width: 75, align: 'center' });
      doc.text('Half Day (0.5x)', 345, y + 6, { width: 75, align: 'center' });
      doc.text('Overtime (1.5x)', 425, y + 6, { width: 75, align: 'center' });
      doc.text('Absent (0.0x)', 505, y + 6, { width: 70, align: 'center' });
      doc.text('Leave', 580, y + 6, { width: 60, align: 'center' });
      doc.text('Total Days', 645, y + 6, { width: 70, align: 'center' });
      doc.text('Gross Payable', 720, y + 6, { width: 77, align: 'right' });

      y += 22;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (y > 510) {
          doc.addPage({ layout: 'landscape' });
          y = 40;
        }

        const bg = i % 2 === 0 ? colors.white : colors.lightBg;
        doc.rect(40, y, 762, 20).fill(bg);
        doc.fillColor(colors.darkSlate).fontSize(8).font('Helvetica');

        doc.text(r.employeeName || r.name || '-', 45, y + 5, { width: 140 });
        doc.text((r.wageType || 'daily').toUpperCase(), 190, y + 5, { width: 70 });
        doc.text(String(r.presentDays ?? 0), 265, y + 5, { width: 75, align: 'center' });
        doc.text(String(r.halfDays ?? 0), 345, y + 5, { width: 75, align: 'center' });
        doc.text(String(r.overtimeDays ?? 0), 425, y + 5, { width: 75, align: 'center' });
        doc.text(String(r.absentDays ?? 0), 505, y + 5, { width: 70, align: 'center' });
        doc.text(String(r.leaveDays ?? 0), 580, y + 5, { width: 60, align: 'center' });
        doc.font('Helvetica-Bold').text(String(r.totalDayEquivalents ?? 0), 645, y + 5, { width: 70, align: 'center' });
        doc.text(formatCurrency(r.grossPayable || 0), 720, y + 5, { width: 77, align: 'right' });

        y += 20;
      }

      // Footer
      const footerY = 550;
      doc.moveTo(40, footerY).lineTo(802, footerY).strokeColor(colors.border).lineWidth(0.5).stroke();
      doc.fillColor(colors.mutedText).fontSize(7).font('Helvetica').text(BRAND.footerDisclaimer, 40, footerY + 6);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a clean, branded PDF report of financial transaction history.
 */
export function generateTransactionHistoryPdf(txData = {}, tenant = {}, query = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const items = Array.isArray(txData.items) ? txData.items : [];
      const summary = txData.summary || { totalIn: 0, totalOut: 0, netBalance: 0 };

      const businessName = BRAND.name;
      const tagline = BRAND.tagline;
      const colors = BRAND.colors;

      // ── Top Header Brand Accent Bar ─────────────────────────────────────────
      doc.rect(40, 36, 515, 3).fill(colors.primaryNavy);

      // Logo
      const logoBuffer = getBrandLogoBuffer();
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, 48, { width: 44, height: 44 });
        } catch {
          doc.circle(62, 70, 20).fill(colors.primaryNavy);
          doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold').text('W', 42, 64, { width: 40, align: 'center' });
        }
      } else {
        doc.circle(62, 70, 20).fill(colors.primaryNavy);
        doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold').text('W', 42, 64, { width: 40, align: 'center' });
      }

      // Title
      doc.fillColor(colors.primaryNavy).fontSize(18).font('Helvetica-Bold').text(businessName, 92, 48);
      if (tagline) {
        doc.fillColor(colors.secondaryTeal).fontSize(8).font('Helvetica-Bold').text(tagline, 92, 70);
      }

      doc.fillColor(colors.primaryNavy).fontSize(13).font('Helvetica-Bold').text('TRANSACTION STATEMENT', 315, 46, { align: 'right', width: 240 });
      doc.fillColor(colors.darkSlate).fontSize(9).font('Helvetica-Bold').text(`Total Transactions: ${items.length}`, 315, 62, { align: 'right', width: 240 });
      doc.fillColor(colors.mutedText).fontSize(7.5).font('Helvetica').text(`Generated: ${formatDate(new Date().toISOString())}`, 315, 75, { align: 'right', width: 240 });

      doc.moveTo(40, 100).lineTo(555, 100).strokeColor(colors.border).lineWidth(1).stroke();

      // ── Summary KPI Cards ───────────────────────────────────────────────────
      doc.rect(40, 110, 165, 45).fill('#ECFDF5');
      doc.fillColor('#065F46').fontSize(7).font('Helvetica-Bold').text('TOTAL RECEIPTS (IN)', 48, 118);
      doc.fillColor('#047857').fontSize(11).font('Helvetica-Bold').text(formatCurrency(summary.totalIn), 48, 130);

      doc.rect(215, 110, 165, 45).fill('#FEF2F2');
      doc.fillColor('#991B1B').fontSize(7).font('Helvetica-Bold').text('TOTAL DISBURSEMENTS (OUT)', 223, 118);
      doc.fillColor('#B91C1C').fontSize(11).font('Helvetica-Bold').text(formatCurrency(summary.totalOut), 223, 130);

      doc.rect(390, 110, 165, 45).fill('#EFF6FF');
      doc.fillColor('#1E40AF').fontSize(7).font('Helvetica-Bold').text('NET CASH FLOW', 398, 118);
      doc.fillColor('#1D4ED8').fontSize(11).font('Helvetica-Bold').text(formatCurrency(summary.netBalance), 398, 130);

      // ── Table Header ────────────────────────────────────────────────────────
      let y = 170;
      doc.rect(40, y, 515, 20).fill(colors.primaryNavy);
      doc.fillColor(colors.white).fontSize(8).font('Helvetica-Bold');
      doc.text('Date', 45, y + 6, { width: 70 });
      doc.text('Type', 120, y + 6, { width: 75 });
      doc.text('Party / Details', 200, y + 6, { width: 155 });
      doc.text('Reference / Note', 360, y + 6, { width: 110 });
      doc.text('Amount', 475, y + 6, { width: 75, align: 'right' });

      y += 20;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (y > 750) {
          doc.addPage();
          y = 40;
          doc.rect(40, y, 515, 20).fill(colors.primaryNavy);
          doc.fillColor(colors.white).fontSize(8).font('Helvetica-Bold');
          doc.text('Date', 45, y + 6, { width: 70 });
          doc.text('Type', 120, y + 6, { width: 75 });
          doc.text('Party / Details', 200, y + 6, { width: 155 });
          doc.text('Reference / Note', 360, y + 6, { width: 110 });
          doc.text('Amount', 475, y + 6, { width: 75, align: 'right' });
          y += 20;
        }

        const bg = i % 2 === 0 ? colors.white : colors.lightBg;
        doc.rect(40, y, 515, 22).fill(bg);

        const typeLabel = item.type === 'client_payment' ? 'Client Payment' : item.type === 'payroll' ? 'Payroll Payout' : 'Advance';
        const typeColor = item.type === 'client_payment' ? '#047857' : item.type === 'payroll' ? '#1D4ED8' : '#D97706';

        doc.fillColor(colors.darkSlate).fontSize(7.5).font('Helvetica');
        doc.text(formatDate(item.transactionDate), 45, y + 6, { width: 70 });

        doc.fillColor(typeColor).fontSize(7.5).font('Helvetica-Bold');
        doc.text(typeLabel, 120, y + 6, { width: 75 });

        doc.fillColor(colors.darkSlate).fontSize(7.5).font('Helvetica');
        doc.text(item.partyName || '-', 200, y + 6, { width: 155, ellipsis: true });

        const refText = item.invoiceNumber ? `Inv #${item.invoiceNumber}` : (item.description || '-');
        doc.fillColor(colors.mutedText).fontSize(7).font('Helvetica');
        doc.text(refText, 360, y + 6, { width: 110, ellipsis: true });

        const isIncome = item.flow === 'in';
        doc.fillColor(isIncome ? '#047857' : '#B91C1C').fontSize(8).font('Helvetica-Bold');
        doc.text(`${isIncome ? '+' : '-'}${formatCurrency(item.amount)}`, 475, y + 6, { width: 75, align: 'right' });

        y += 22;
      }

      // Footer
      const footerY = 790;
      doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(colors.border).lineWidth(0.5).stroke();
      doc.fillColor(colors.mutedText).fontSize(7).font('Helvetica').text(BRAND.footerDisclaimer, 40, footerY + 6);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


