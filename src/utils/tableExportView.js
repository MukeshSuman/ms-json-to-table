export const TABLE_UI_COLORS = {
  headerBg: [249, 250, 251],
  headerText: [55, 65, 81],
  bodyText: [17, 24, 39],
  border: [229, 231, 235],
  bodyBg: [255, 255, 255],
};

export const TABLE_EXPORT_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #111827;
    background: #ffffff;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  thead th {
    background: #f9fafb;
    color: #374151;
    font-weight: 600;
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
  }
  tbody td {
    padding: 12px 16px;
    text-align: left;
    color: #111827;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
    word-break: break-word;
  }
  @media print {
    body { margin: 0; }
    @page { margin: 12mm; }
  }
`;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDisplayValue(column, value, valueMappings) {
  if (valueMappings[column] && valueMappings[column][value] !== undefined) {
    return valueMappings[column][value];
  }
  return value;
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

export function buildExportTableData(
  data,
  columns,
  headerLabels = {},
  valueMappings = {},
  settings = {}
) {
  let headers = columns.map((col) => formatCellValue(headerLabels[col] || col));
  let rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) {
        return '-';
      }
      return formatCellValue(getDisplayValue(col, String(value), valueMappings));
    })
  );

  if (settings.extraColumns?.enabled) {
    const extraColumnCount = settings.extraColumns.count;
    for (let i = 0; i < extraColumnCount; i++) {
      headers.push(settings.extraColumns.headings[i] || `Extra ${i + 1}`);
    }
    rows = rows.map((row) => [...row, ...Array(extraColumnCount).fill('')]);
  }

  if (settings.extraRows?.enabled) {
    const extraRowCount = settings.extraRows.count;
    for (let i = 0; i < extraRowCount; i++) {
      rows.push(Array(headers.length).fill(''));
    }
  }

  return { headers, rows };
}

export function buildExportTableHtml(headers, rows) {
  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Data Table</title>
    <style>${TABLE_EXPORT_CSS}</style>
  </head>
  <body>
    <table>
      <thead>
        <tr>${headerHtml}</tr>
      </thead>
      <tbody>
        ${bodyHtml}
      </tbody>
    </table>
  </body>
</html>`;
}

export function buildExportTableDocument(
  data,
  columns,
  headerLabels = {},
  valueMappings = {},
  settings = {}
) {
  const { headers, rows } = buildExportTableData(
    data,
    columns,
    headerLabels,
    valueMappings,
    settings
  );
  return buildExportTableHtml(headers, rows);
}
