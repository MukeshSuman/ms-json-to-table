import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { buildExportTableData, TABLE_UI_COLORS } from './tableExportView';

function getPageConfig(columnCount) {
  if (columnCount > 16) {
    return { format: 'a3', orientation: 'l', fontSize: 6, cellPadding: 2 };
  }
  if (columnCount > 10) {
    return { format: 'a3', orientation: 'l', fontSize: 7, cellPadding: 2.5 };
  }
  if (columnCount > 7) {
    return { format: 'a4', orientation: 'l', fontSize: 8, cellPadding: 3 };
  }
  return { format: 'a4', orientation: 'l', fontSize: 9, cellPadding: 3.5 };
}

function buildColumnStyles(columnCount, availableWidth) {
  const cellWidth = availableWidth / columnCount;
  const styles = {};
  for (let i = 0; i < columnCount; i++) {
    styles[i] = { cellWidth };
  }
  return styles;
}

const BORDER_WIDTH = 0.25;

function drawHorizontalCellBorder(data) {
  const { doc, cell } = data;
  if (!cell) return;

  doc.setDrawColor(...TABLE_UI_COLORS.border);
  doc.setLineWidth(BORDER_WIDTH);
  doc.line(
    cell.x,
    cell.y + cell.height,
    cell.x + cell.width,
    cell.y + cell.height
  );
}

export const exportToPDF = (
  data,
  columns,
  filename,
  settings,
  headerLabels = {},
  valueMappings = {}
) => {
  try {
    const { headers, rows } = buildExportTableData(
      data,
      columns,
      headerLabels,
      valueMappings,
      settings
    );

    const pageConfig = getPageConfig(headers.length);
    const doc = new jsPDF(pageConfig.orientation, 'mm', pageConfig.format);
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const availableWidth = pageWidth - margin * 2;
    const columnStyles = buildColumnStyles(headers.length, availableWidth);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 10,
      tableWidth: availableWidth,
      columnStyles,
      theme: 'plain',
      styles: {
        fontSize: pageConfig.fontSize,
        cellPadding: pageConfig.cellPadding,
        minCellHeight: 8,
        overflow: 'linebreak',
        valign: 'top',
        halign: 'left',
        fillColor: TABLE_UI_COLORS.bodyBg,
        textColor: TABLE_UI_COLORS.bodyText,
        lineWidth: 0,
      },
      headStyles: {
        fillColor: TABLE_UI_COLORS.headerBg,
        textColor: TABLE_UI_COLORS.headerText,
        fontStyle: 'bold',
        fontSize: pageConfig.fontSize,
        overflow: 'linebreak',
        minCellHeight: 9,
        halign: 'left',
        lineWidth: 0,
      },
      bodyStyles: {
        fillColor: TABLE_UI_COLORS.bodyBg,
        textColor: TABLE_UI_COLORS.bodyText,
        lineWidth: 0,
      },
      margin: { top: 10, right: margin, bottom: 12, left: margin },
      showHead: 'everyPage',
      rowPageBreak: 'auto',
      didDrawCell: drawHorizontalCellBorder,
    });

    doc.save(filename);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Error exporting to PDF. Please try again.');
  }
};
