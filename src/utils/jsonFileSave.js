import {
  getFileFormat,
  serializeFileContent,
  ensureFileNameExtension,
} from './tabularFile';

/**
 * Save data back to the file the user opened (File System Access API),
 * or trigger a download with the original filename as fallback.
 * Preserves JSON / TSV / CSV based on the source file extension.
 */
export async function saveJsonToFile(data, fileHandle, fileName) {
  const format = getFileFormat(fileName) || 'json';
  const { text, mimeType } = serializeFileContent(data, format);
  const blob = new Blob([text], { type: mimeType });
  const resolvedName = ensureFileNameExtension(fileName || 'data', format);

  if (fileHandle && typeof fileHandle.createWritable === 'function') {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { method: 'file', fileName: resolvedName };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resolvedName;
  link.click();
  URL.revokeObjectURL(url);
  return { method: 'download', fileName: link.download };
}

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}
