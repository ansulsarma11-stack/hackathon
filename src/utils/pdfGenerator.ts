import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceRecord } from '../types.ts';

interface PdfReportOptions {
  records: AttendanceRecord[];
  className?: string;
  dateFilter?: string;
  monthName?: string;
  generatedBy?: string;
}

export function generateAttendancePdf({
  records,
  className = 'All Classes',
  dateFilter,
  monthName,
  generatedBy = 'Prof. Eleanor Vance',
}: PdfReportOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate statistics
  const total = records.length;
  const present = records.filter((r) => r.status === 'Present').length;
  const late = records.filter((r) => r.status === 'Late').length;
  const absent = records.filter((r) => r.status === 'Absent').length;
  const excused = records.filter((r) => r.status === 'Excused').length;
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('VISIONATTEND • BIOMETRIC ATTENDANCE REPORT', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Facial Recognition Attendance System • SQLite Audit Trail Log', 14, 21);

  // Metadata on right side of header
  doc.setFontSize(8);
  doc.text(`Generated: ${dateFormatted} at ${timeFormatted}`, pageWidth - 14, 13, { align: 'right' });
  doc.text(`Auditor: ${generatedBy}`, pageWidth - 14, 19, { align: 'right' });

  // Summary Metrics Cards Section
  const cardY = 35;
  const cardWidth = (pageWidth - 28 - 20) / 5;
  const cardHeight = 16;

  const metrics = [
    { label: 'TOTAL LOGS', val: `${total}`, color: [30, 41, 59] },
    { label: 'PRESENT', val: `${present} (${total > 0 ? Math.round((present / total) * 100) : 0}%)`, color: [16, 185, 129] },
    { label: 'LATE', val: `${late} (${total > 0 ? Math.round((late / total) * 100) : 0}%)`, color: [245, 158, 11] },
    { label: 'ABSENT', val: `${absent} (${total > 0 ? Math.round((absent / total) * 100) : 0}%)`, color: [239, 68, 68] },
    { label: 'ATTENDANCE RATE', val: `${rate}%`, color: [13, 148, 136] },
  ];

  metrics.forEach((m, idx) => {
    const x = 14 + idx * (cardWidth + 5);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    // Label
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text(m.label, x + 3, cardY + 5);

    // Value
    doc.setFontSize(11);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, x + 3, cardY + 12);
  });

  // Scope Subheader
  let scopeText = `Scope: ${className}`;
  if (monthName) scopeText += ` • Month: ${monthName}`;
  if (dateFilter) scopeText += ` • Date: ${dateFilter}`;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(scopeText, 14, 58);

  // Table Data
  const tableData = records.map((r) => [
    `#${r.id}`,
    r.student_id,
    r.student_name,
    r.class_name,
    r.session_name || `Session #${r.session_id}`,
    `${r.attendance_date} ${r.attendance_time}`,
    r.status,
    `${Math.round(r.confidence * 100)}%`,
    r.audit_note || 'Automated biometric match',
  ]);

  autoTable(doc, {
    startY: 62,
    head: [
      ['ID', 'Student ID', 'Student Name', 'Class', 'Session', 'Date & Time', 'Status', 'Confidence', 'Audit Note'],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 24, fontStyle: 'bold' },
      2: { cellWidth: 38 },
      3: { cellWidth: 18 },
      4: { cellWidth: 50 },
      5: { cellWidth: 32 },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      // Color-code the Status cell
      if (data.section === 'body' && data.column.index === 6) {
        const val = data.cell.raw as string;
        if (val === 'Present') {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Late') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Absent') {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Excused') {
          data.cell.styles.textColor = [2, 132, 199];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = (doc.internal as any).getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `VisionAttend Biometric Attendance System • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
      doc.text('CONFIDENTIAL • ACADEMIC RECORD', pageWidth - 14, pageHeight - 6, { align: 'right' });
    },
  });

  return doc;
}

export function downloadAttendancePdf(options: PdfReportOptions, filename?: string) {
  const doc = generateAttendancePdf(options);
  const dateStr = new Date().toISOString().split('T')[0];
  const name = filename || `VisionAttend_Attendance_Report_${options.className?.replace(/\s+/g, '_') || 'All'}_${dateStr}.pdf`;
  doc.save(name);
}

export interface YearlyPdfOptions {
  yearlyData: import('../types.ts').YearlyCalendarResponse;
  scopeLabel?: string;
  generatedBy?: string;
}

export function generateYearlyAttendancePdf({
  yearlyData,
  scopeLabel = 'All Classes',
  generatedBy = 'Prof. Eleanor Vance',
}: YearlyPdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`VISIONATTEND • ANNUAL ATTENDANCE REPORT (${yearlyData.year})`, 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('12-Month Academic Attendance Audit & Percentage Overview', 14, 21);

  // Metadata on right side
  doc.setFontSize(8);
  doc.text(`Generated: ${dateFormatted} at ${timeFormatted}`, pageWidth - 14, 13, { align: 'right' });
  doc.text(`Scope: ${scopeLabel} • Auditor: ${generatedBy}`, pageWidth - 14, 19, { align: 'right' });

  // Summary Metrics Cards Section
  const cardY = 35;
  const cardWidth = (pageWidth - 28 - 20) / 5;
  const cardHeight = 16;

  const total = yearlyData.total_records;
  const metrics = [
    { label: 'ANNUAL RATE', val: `${yearlyData.annual_attendance_rate}%`, color: [14, 165, 233] },
    { label: 'TOTAL LOGS', val: `${total}`, color: [30, 41, 59] },
    { label: 'ACTIVE DAYS', val: `${yearlyData.total_days_active} Days`, color: [99, 102, 241] },
    { label: 'TOTAL SESSIONS', val: `${yearlyData.total_sessions} Sessions`, color: [168, 85, 247] },
    { label: 'PRESENT / LATE', val: `${yearlyData.present}P / ${yearlyData.late}L`, color: [16, 185, 129] },
  ];

  metrics.forEach((m, idx) => {
    const x = 14 + idx * (cardWidth + 5);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text(m.label, x + 3, cardY + 5);

    doc.setFontSize(11);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, x + 3, cardY + 12);
  });

  // Table of 12 Months
  const tableData = yearlyData.months.map((m) => [
    `#${m.month}`,
    `${m.monthName} ${yearlyData.year}`,
    `${m.attendance_rate}%`,
    m.total_days_active.toString(),
    m.total_sessions.toString(),
    m.total_records.toString(),
    m.present.toString(),
    m.late.toString(),
    m.absent.toString(),
    m.excused.toString(),
    m.total_records === 0
      ? 'No Scheduled Sessions'
      : m.attendance_rate >= 85
      ? 'Optimal Attendance'
      : m.attendance_rate >= 70
      ? 'Standard Attendance'
      : 'Attendance Below Threshold',
  ]);

  autoTable(doc, {
    startY: 58,
    head: [
      ['No.', 'Month', 'Attendance %', 'Active Days', 'Sessions', 'Records', 'Present', 'Late', 'Absent', 'Excused', 'Academic Evaluation'],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 16, halign: 'center' },
      10: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const val = data.cell.raw as string;
        const num = parseFloat(val);
        if (num >= 85) {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (num >= 70) {
          data.cell.styles.textColor = [217, 119, 6];
        } else if (num > 0) {
          data.cell.styles.textColor = [225, 29, 72];
        } else {
          data.cell.styles.textColor = [148, 163, 184];
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = (doc.internal as any).getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `VisionAttend Annual Academic Audit • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
      doc.text('OFFICIAL ACADEMIC TRANSCRIPT', pageWidth - 14, pageHeight - 6, { align: 'right' });
    },
  });

  return doc;
}

export function downloadYearlyAttendancePdf(options: YearlyPdfOptions, filename?: string) {
  const doc = generateYearlyAttendancePdf(options);
  const dateStr = new Date().toISOString().split('T')[0];
  const name = filename || `VisionAttend_Annual_Attendance_${options.yearlyData.year}_${options.scopeLabel?.replace(/\s+/g, '_') || 'All'}_${dateStr}.pdf`;
  doc.save(name);
}

