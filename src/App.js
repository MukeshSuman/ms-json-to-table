import React, { useState, useCallback } from 'react';
import JsonUploader from './components/JsonUploader';
import DataTable from './components/DataTable';
import { Upload, FileText, Table } from 'lucide-react';

function App() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sourceFileHandle, setSourceFileHandle] = useState(null);
  const [sourceFileName, setSourceFileName] = useState('');

  const handleDataLoad = useCallback((jsonData, columnKeys, fileHandle = null, fileName = '') => {
    setData(jsonData);
    setColumns(columnKeys);
    setSourceFileHandle(fileHandle);
    setSourceFileName(fileName);
    setIsDataLoaded(true);
  }, []);

  const handleDataUpdate = useCallback((jsonData, columnKeys) => {
    setData(jsonData);
    setColumns(columnKeys);
  }, []);

  const handleClearData = useCallback(() => {
    setData([]);
    setColumns([]);
    setSourceFileHandle(null);
    setSourceFileName('');
    setIsDataLoaded(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Table className="h-8 w-8 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  JSON to List Converter
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Upload className="h-4 w-4" />
                <span>Upload File</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <span>Export Data</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upload or Paste Data
            </h2>
            <JsonUploader onDataLoad={handleDataLoad} onClearData={handleClearData} />
          </div>

          {/* Data Table Section */}
          {isDataLoaded && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Data Table ({data.length} rows)
                  </h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <DataTable
                  key={sourceFileName || 'data-table'}
                  data={data}
                  columns={columns}
                  onDataUpdate={handleDataUpdate}
                  sourceFileHandle={sourceFileHandle}
                  sourceFileName={sourceFileName}
                  onSourceFileHandle={setSourceFileHandle}
                  onClearData={handleClearData}
                />
              </div>
            </div>
          )}

          {/* Instructions */}
          {!isDataLoaded && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                How to use this tool
              </h3>
              <ul className="text-blue-800 space-y-2">
                <li>• Upload a JSON, TSV, or CSV file, or paste JSON directly</li>
                <li>• Use table controls to hide columns, sort, and filter data</li>
                <li>• Export to Excel, print the table, or save it as PDF</li>
                <li>• Print and PDF use the current visible columns and filtered rows</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
