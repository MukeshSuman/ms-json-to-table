import * as XLSX from 'xlsx';

const EXT_FORMAT = {
  '.json': 'json',
  '.tsv': 'tsv',
  '.tab': 'tsv',
  '.csv': 'csv',
};

export function getFileFormat(fileName = '') {
  const lower = String(fileName).toLowerCase();
  const match = Object.keys(EXT_FORMAT).find((ext) => lower.endsWith(ext));
  return match ? EXT_FORMAT[match] : null;
}

function validateRows(rows, label) {
  if (!Array.isArray(rows)) {
    throw new Error(`${label} must contain an array of objects`);
  }
  if (rows.length === 0) {
    throw new Error(`${label} cannot be empty`);
  }
  const columnKeys = Object.keys(rows[0] || {});
  if (columnKeys.length === 0) {
    throw new Error('Data must have at least one column');
  }
  return columnKeys;
}

export function parseFileContent(text, fileName) {
  const format = getFileFormat(fileName);
  if (!format) {
    throw new Error('Unsupported file type. Use .json, .tsv, or .csv');
  }

  if (format === 'json') {
    const jsonData = JSON.parse(text);
    const columnKeys = validateRows(jsonData, 'JSON file');
    return { data: jsonData, columns: columnKeys, format };
  }

  const readOpts = format === 'tsv' ? { type: 'string', FS: '\t' } : { type: 'string' };
  const workbook = XLSX.read(text, readOpts);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`${format.toUpperCase()} file has no sheets`);
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const columnKeys = validateRows(rows, `${format.toUpperCase()} file`);
  return { data: rows, columns: columnKeys, format };
}

export function serializeFileContent(data, format) {
  if (format === 'json') {
    return {
      text: JSON.stringify(data, null, 2),
      mimeType: 'application/json',
    };
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  if (format === 'tsv') {
    return {
      text: XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' }),
      mimeType: 'text/tab-separated-values',
    };
  }

  return {
    text: XLSX.utils.sheet_to_csv(worksheet),
    mimeType: 'text/csv',
  };
}

export function getAcceptTypesForFormat(format) {
  if (format === 'tsv') {
    return {
      description: 'TSV Files',
      accept: {
        'text/tab-separated-values': ['.tsv', '.tab'],
        'text/plain': ['.tsv', '.tab'],
      },
    };
  }
  if (format === 'csv') {
    return {
      description: 'CSV Files',
      accept: {
        'text/csv': ['.csv'],
        'text/plain': ['.csv'],
      },
    };
  }
  return {
    description: 'JSON Files',
    accept: { 'application/json': ['.json'] },
  };
}

export function ensureFileNameExtension(fileName, format) {
  const base = fileName || 'data';
  if (format === 'tsv') {
    return base.match(/\.(tsv|tab)$/i) ? base : `${base}.tsv`;
  }
  if (format === 'csv') {
    return base.toLowerCase().endsWith('.csv') ? base : `${base}.csv`;
  }
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
}
