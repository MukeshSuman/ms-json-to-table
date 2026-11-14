import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, ClipboardPaste } from 'lucide-react';
import { isFileSystemAccessSupported } from '../utils/jsonFileSave';
import { parseFileContent } from '../utils/tabularFile';

const PASTED_JSON_NAME = 'pasted.json';

// Include text/plain for .tsv/.tab — Chrome/macOS often maps those to text/plain,
// so filtering only on text/tab-separated-values greys them out in the picker.
const OPEN_FILE_TYPES = [
  {
    description: 'Data Files',
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv', '.tab'],
      'text/plain': ['.tsv', '.tab', '.csv'],
    },
  },
];

const JsonUploader = ({ onDataLoad, onClearData }) => {
  const [inputMode, setInputMode] = useState('file');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef(null);

  const parseAndLoad = (text, name, fileHandle = null) => {
    const { data, columns } = parseFileContent(text, name);
    onDataLoad(data, columns, fileHandle, name);
  };

  const handleFile = (file, fileHandle = null) => {
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        parseAndLoad(e.target.result, file.name, fileHandle);
      } catch (err) {
        setError(err.message);
        setFileName('');
      }
    };

    reader.readAsText(file);
  };

  const handleBrowseWithPicker = async () => {
    setError('');
    if (isFileSystemAccessSupported()) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: OPEN_FILE_TYPES,
          multiple: false,
        });
        const file = await handle.getFile();
        setFileName(file.name);
        const text = await file.text();
        parseAndLoad(text, file.name, handle);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to open file');
          setFileName('');
        }
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handlePasteLoad = () => {
    setError('');
    try {
      parseAndLoad(pasteText, PASTED_JSON_NAME);
      setFileName(PASTED_JSON_NAME);
    } catch (err) {
      setError(err.message);
      setFileName('');
    }
  };

  const handleClear = () => {
    setFileName('');
    setPasteText('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClearData();
  };

  const switchInputMode = (mode) => {
    setInputMode(mode);
    setError('');
  };

  return (
    <div className="space-y-4">
      {!fileName ? (
        <>
          <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50 w-fit">
            <button
              type="button"
              onClick={() => switchInputMode('file')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                inputMode === 'file'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => switchInputMode('paste')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                inputMode === 'paste'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Paste JSON
            </button>
          </div>

          {inputMode === 'file' ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
                isDragOver
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">
                  Drop your file here
                </p>
                <p className="text-gray-500">
                  or{' '}
                  <button
                    type="button"
                    onClick={handleBrowseWithPicker}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-sm text-gray-400">
                  Supports .json, .tsv, and .csv (header row + data rows)
                  {isFileSystemAccessSupported() && (
                    <span className="block mt-1">
                      Use browse to save edits back to the same file
                    </span>
                  )}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.tsv,.tab,.csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 text-gray-700">
                <ClipboardPaste className="h-5 w-5 text-gray-500" />
                <p className="text-sm font-medium">Paste a JSON array of objects</p>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'[\n  { "name": "Alice", "age": 30 },\n  { "name": "Bob", "age": 25 }\n]'}
                rows={10}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">Must be valid JSON with an array of objects</p>
                <button
                  type="button"
                  onClick={handlePasteLoad}
                  disabled={!pasteText.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load JSON
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">
                  {fileName === PASTED_JSON_NAME ? 'Pasted JSON' : fileName}
                </p>
                <p className="text-sm text-green-700">Data loaded successfully</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-green-600 hover:text-green-700 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Error loading file</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JsonUploader;
