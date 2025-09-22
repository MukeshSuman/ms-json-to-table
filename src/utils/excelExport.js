import * as XLSX from 'xlsx';

export const exportToExcel = (data, columns, filename, settings) => {
  try {
    // Prepare data for export
    let exportData = [...data];

    // Add headers if enabled
    if (settings.includeHeaders) {
      const headers = columns.map(col => col);
      exportData = [headers, ...exportData.map(row => 
        columns.map(col => row[col] || '')
      )];
    } else {
      exportData = exportData.map(row => 
        columns.map(col => row[col] || '')
      );
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Auto-adjust column widths if enabled
    if (settings.autoWidth) {
      const colWidths = columns.map((col, index) => {
        const maxLength = Math.max(
          col.length, // Header length
          ...data.map(row => String(row[col] || '').length)
        );
        return { wch: Math.min(maxLength + 2, 50) }; // Cap at 50 characters
      });
      ws['!cols'] = colWidths;
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Generate and download file
    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Error exporting to Excel. Please try again.');
  }
};
