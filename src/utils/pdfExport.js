import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToPDF = (data, columns, filename, settings) => {
  try {
    // Create new PDF document
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation for better table display
    
    // Prepare table data
    let tableData = data.map(row => 
      columns.map(col => row[col] !== null && row[col] !== undefined ? String(row[col]) : '-')
    );

    // Add extra columns if enabled
    if (settings.extraColumns.enabled) {
      const extraColumnCount = settings.extraColumns.count;
      const extraHeadings = settings.extraColumns.headings;
      const emptyHeadings = settings.extraColumns.emptyHeadings;
      
      // Add extra columns to headers
      const extraHeaders = [];
      for (let i = 0; i < extraColumnCount; i++) {
        extraHeaders.push(extraHeadings[i] || `Extra ${i + 1}`);
      }
      
      // Add extra columns to data
      tableData = tableData.map(row => [
        ...row,
        ...Array(extraColumnCount).fill('')
      ]);
      
      // Update columns array for headers
      const allColumns = [...columns, ...extraHeaders];
      
      // Add extra rows if enabled
      if (settings.extraRows.enabled) {
        const extraRowCount = settings.extraRows.count;
        for (let i = 0; i < extraRowCount; i++) {
          tableData.push(Array(allColumns.length).fill(''));
        }
      }
      
      // Generate table
      doc.autoTable({
        head: [allColumns],
        body: tableData,
        startY: 20,
        styles: {
          fontSize: 10,
          cellPadding: 3,
          minCellHeight: settings.minRowHeight,
        },
        headStyles: {
          fillColor: [66, 139, 202], // Blue header
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245], // Light gray for alternate rows
        },
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        didDrawPage: (data) => {
          // Add page numbers
          const pageCount = doc.internal.getNumberOfPages();
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height || pageSize.getHeight();
          
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(
              `Page ${i} of ${pageCount}`,
              pageSize.width - 30,
              pageHeight - 10
            );
          }
        }
      });
    } else {
      // No extra columns, just regular table
      let allColumns = [...columns];
      
      // Add extra rows if enabled
      if (settings.extraRows.enabled) {
        const extraRowCount = settings.extraRows.count;
        for (let i = 0; i < extraRowCount; i++) {
          tableData.push(Array(allColumns.length).fill(''));
        }
      }
      
      // Generate table
      doc.autoTable({
        head: [allColumns],
        body: tableData,
        startY: 20,
        styles: {
          fontSize: 10,
          cellPadding: 3,
          minCellHeight: settings.minRowHeight,
        },
        headStyles: {
          fillColor: [66, 139, 202], // Blue header
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245], // Light gray for alternate rows
        },
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        didDrawPage: (data) => {
          // Add page numbers
          const pageCount = doc.internal.getNumberOfPages();
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height || pageSize.getHeight();
          
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(
              `Page ${i} of ${pageCount}`,
              pageSize.width - 30,
              pageHeight - 10
            );
          }
        }
      });
    }

    // Save the PDF
    doc.save(filename);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Error exporting to PDF. Please try again.');
  }
};
