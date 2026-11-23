import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  ClipboardPaste,
  Folder,
  Trash2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { isFileSystemAccessSupported } from '../utils/jsonFileSave';
import { parseFileContent } from '../utils/tabularFile';
import {
  collectJsonFromDirectory,
  collectJsonFromFileList,
  filterFilesByPostfix,
  buildFilenamePostfixGroups,
  normalizeFilenamePostfix,
  validateFolderJsonFiles,
  mergeValidatedFolderFiles,
} from '../utils/folderLoad';

const PASTED_JSON_NAME = 'pasted.json';

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

const INPUT_MODES = [
  { id: 'file', label: 'Upload File' },
  { id: 'paste', label: 'Paste JSON' },
  { id: 'folder', label: 'Folder' },
];

const JsonUploader = ({ onDataLoad, onClearData }) => {
  const [inputMode, setInputMode] = useState('file');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [folderName, setFolderName] = useState('');
  const [allFolderFiles, setAllFolderFiles] = useState([]);
  const [folderFiles, setFolderFiles] = useState([]);
  const [postfixGroups, setPostfixGroups] = useState([]);
  const [folderValidated, setFolderValidated] = useState(false);
  const [folderValidationMessage, setFolderValidationMessage] = useState('');
  const [isFolderBusy, setIsFolderBusy] = useState(false);
  const [filenamePostfix, setFilenamePostfix] = useState('');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const normalizedPostfix = normalizeFilenamePostfix(filenamePostfix);
  const patternLabel = normalizedPostfix ? `*${normalizedPostfix}` : '*.json';

  const matchedCount = useMemo(
    () => filterFilesByPostfix(allFolderFiles, normalizedPostfix).length,
    [allFolderFiles, normalizedPostfix]
  );

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

  const resetFolderState = () => {
    setFolderName('');
    setAllFolderFiles([]);
    setFolderFiles([]);
    setPostfixGroups([]);
    setFilenamePostfix('');
    setFolderValidated(false);
    setFolderValidationMessage('');
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const toPendingEntries = (entries) =>
    entries.map((entry) => ({
      ...entry,
      status: 'pending',
      error: '',
      data: null,
      columns: [],
    }));

  const applyFolderEntries = (entries, selectedFolderName) => {
    const pending = toPendingEntries(entries);
    const groups = buildFilenamePostfixGroups(
      pending.map((entry) => entry.name),
      { minCount: 3, maxGroups: 7 }
    );
    const defaultPostfix = groups[0]?.postfix || '';
    const matched = filterFilesByPostfix(pending, defaultPostfix);

    setFolderName(selectedFolderName || 'Selected folder');
    setAllFolderFiles(pending);
    setPostfixGroups(groups);
    setFilenamePostfix(defaultPostfix);
    setFolderFiles(matched);
    setFolderValidated(false);
    setFolderValidationMessage(
      pending.length
        ? `Found ${pending.length} JSON file(s). ${
            groups.length
              ? `Top ${groups.length} postfix group(s) from this folder.`
              : ''
          }`.trim()
        : 'No .json files found in this folder'
    );
    setError(pending.length ? '' : 'No .json files found in this folder');
  };

  const applyPostfixFilter = (postfix, sourceFiles = allFolderFiles) => {
    const suffix = normalizeFilenamePostfix(postfix);
    const matched = filterFilesByPostfix(sourceFiles, suffix).map((entry) => ({
      ...entry,
      status: 'pending',
      error: '',
      data: null,
      columns: [],
    }));
    setFolderFiles(matched);
    setFolderValidated(false);
    setFolderValidationMessage(
      sourceFiles.length
        ? suffix
          ? `Showing ${matched.length} of ${sourceFiles.length} file(s) ending with ${suffix}`
          : `Showing all ${sourceFiles.length} JSON file(s)`
        : ''
    );
  };

  const handleSelectFolder = async () => {
    setError('');
    setIsFolderBusy(true);

    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker();
        const entries = await collectJsonFromDirectory(dirHandle);
        applyFolderEntries(entries, dirHandle.name);
      } else {
        folderInputRef.current?.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to open folder');
      }
    } finally {
      setIsFolderBusy(false);
    }
  };

  const handleFolderInput = (e) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;

    const entries = collectJsonFromFileList(list);
    const firstPath = list[0]?.webkitRelativePath || '';
    const rootName = firstPath.split('/')[0] || 'Selected folder';
    applyFolderEntries(entries, rootName);
  };

  const handleFilenamePostfixChange = (value) => {
    setFilenamePostfix(value);
    setError('');
    if (allFolderFiles.length) {
      applyPostfixFilter(value, allFolderFiles);
    }
  };

  const handlePostfixChipClick = (postfix) => {
    setFilenamePostfix(postfix);
    setError('');
    applyPostfixFilter(postfix, allFolderFiles);
  };

  const removeFolderFile = (id) => {
    const remainingAll = allFolderFiles.filter((file) => file.id !== id);
    const remainingListed = folderFiles.filter((file) => file.id !== id);
    setAllFolderFiles(remainingAll);
    setFolderFiles(remainingListed);
    setPostfixGroups(
      buildFilenamePostfixGroups(
        remainingAll.map((file) => file.name),
        { minCount: 3, maxGroups: 7 }
      )
    );
    setFolderValidated(false);
    setFolderValidationMessage('File removed. Validate again before loading.');
  };

  const handleValidateFolder = async () => {
    setError('');
    setIsFolderBusy(true);
    try {
      const result = await validateFolderJsonFiles(
        folderFiles,
        parseFileContent,
        patternLabel
      );
      setFolderFiles(result.files);
      setFolderValidated(result.ok);
      setFolderValidationMessage(result.message);
      if (!result.ok) {
        setError(result.message);
      }
    } catch (err) {
      setFolderValidated(false);
      setError(err.message || 'Validation failed');
      setFolderValidationMessage('');
    } finally {
      setIsFolderBusy(false);
    }
  };

  const handleLoadFolder = () => {
    setError('');
    try {
      if (!folderValidated) {
        throw new Error('Validate files first before loading');
      }
      const okFiles = folderFiles.filter((file) => file.status === 'ok' && file.data);
      const { data, columns } = mergeValidatedFolderFiles(okFiles);
      const label = `${folderName} (${okFiles.length} files)`;
      onDataLoad(data, columns, null, label);
      setFileName(label);
    } catch (err) {
      setError(err.message || 'Failed to load folder files');
    }
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
    resetFolderState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClearData();
  };

  const switchInputMode = (mode) => {
    setInputMode(mode);
    setError('');
  };

  const statusColor = (status) => {
    if (status === 'ok') return 'text-green-700 bg-green-50 border-green-200';
    if (status === 'error' || status === 'mismatch') {
      return 'text-red-700 bg-red-50 border-red-200';
    }
    return 'text-gray-700 bg-white border-gray-200';
  };

  return (
    <div className="space-y-4">
      {!fileName ? (
        <>
          <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50 w-fit">
            {INPUT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => switchInputMode(mode.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  inputMode === mode.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {inputMode === 'file' && (
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
          )}

          {inputMode === 'paste' && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 text-gray-700">
                <ClipboardPaste className="h-5 w-5 text-gray-500" />
                <p className="text-sm font-medium">Paste a JSON array of objects</p>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  '[\n  { "name": "Alice", "age": 30 },\n  { "name": "Bob", "age": 25 }\n]'
                }
                rows={10}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  Must be valid JSON with an array of objects
                </p>
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

          {inputMode === 'folder' && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-gray-700">
                  <Folder className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Load matching JSON from a folder</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Select folder first — postfix groups are detected from real filenames
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={isFolderBusy}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isFolderBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Folder className="h-4 w-4" />
                  )}
                  Select Folder
                </button>
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={handleFolderInput}
                />
              </div>

              {folderName && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Folder: <span className="font-medium">{folderName}</span>
                  <span className="text-gray-500">
                    {' '}
                    · {allFolderFiles.length} JSON · {matchedCount} matched
                  </span>
                </div>
              )}

              <div>
                <label
                  htmlFor="filename-postfix"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Filename postfix
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500 font-mono">*</span>
                  <input
                    id="filename-postfix"
                    type="text"
                    value={filenamePostfix}
                    onChange={(e) => handleFilenamePostfixChange(e.target.value)}
                    placeholder={
                      allFolderFiles.length
                        ? 'Select a group below or type postfix'
                        : 'Select a folder first'
                    }
                    disabled={!allFolderFiles.length}
                    className="flex-1 min-w-[12rem] rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                {postfixGroups.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {postfixGroups.map((group) => {
                      const selected = normalizedPostfix === group.postfix;
                      return (
                        <button
                          key={group.postfix}
                          type="button"
                          onClick={() => handlePostfixChipClick(group.postfix)}
                          className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                            selected
                              ? 'border-primary-400 bg-primary-50 text-primary-800 ring-1 ring-primary-300'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                          title={`${group.count} file(s)`}
                        >
                          <span className="font-mono">{group.label}</span>
                          <span className="ml-1 text-gray-500">({group.count})</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">
                    {allFolderFiles.length
                      ? 'No postfix groups found'
                      : 'Postfix groups will appear after selecting a folder'}
                  </p>
                )}
                {normalizedPostfix && (
                  <p className="mt-1 text-xs text-gray-400">
                    Matching names ending with{' '}
                    <span className="font-mono">{normalizedPostfix}</span>
                  </p>
                )}
              </div>

              {folderFiles.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Matched files
                  </div>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {folderFiles.map((file) => (
                      <li
                        key={file.id}
                        className={`flex items-start justify-between gap-3 px-3 py-2 text-sm border-l-4 ${statusColor(
                          file.status
                        )}`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate" title={file.relativePath}>
                            {file.relativePath}
                          </p>
                          {file.error ? (
                            <p className="text-xs mt-0.5 text-red-600">{file.error}</p>
                          ) : file.status === 'ok' ? (
                            <p className="text-xs mt-0.5 text-green-700">
                              {file.data?.length || 0} rows · {file.columns?.length || 0} columns
                            </p>
                          ) : (
                            <p className="text-xs mt-0.5 text-gray-500">Pending validation</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFolderFile(file.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                          title="Remove file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {folderValidationMessage && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    folderValidated
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {folderValidated ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{folderValidationMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleValidateFolder}
                  disabled={!folderFiles.length || isFolderBusy}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Validate
                </button>
                <button
                  type="button"
                  onClick={handleLoadFolder}
                  disabled={!folderValidated || isFolderBusy}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load
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
