import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Settings, X } from 'lucide-react';
import { exportToExcel } from '../utils/excelExport';
import { exportToPDF } from '../utils/pdfExport';

const ExportControls = ({ data, columns, onClearData }) => {
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    // PDF Settings
    extraColumns: {
      enabled: false,
      count: 1,
      headings: ['Extra Column 1'],
      emptyHeadings: ['']
    },
    extraRows: {
      enabled: false,
      count: 1
    },
    minRowHeight: 20,
    // Excel Settings
    includeHeaders: true,
    autoWidth: true
  });

  const handleExcelExport = () => {
    const filename = `data-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    exportToExcel(data, columns, filename, exportSettings);
  };

  const handlePDFExport = () => {
    const filename = `data-export-${new Date().toISOString().split('T')[0]}.pdf`;
    exportToPDF(data, columns, filename, exportSettings);
  };

  const updateExportSettings = (section, key, value) => {
    setExportSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const updateExtraColumnSettings = (index, key, value) => {
    setExportSettings(prev => ({
      ...prev,
      extraColumns: {
        ...prev.extraColumns,
        [key]: prev.extraColumns[key].map((item, i) => 
          i === index ? value : item
        )
      }
    }));
  };

  const addExtraColumn = () => {
    setExportSettings(prev => ({
      ...prev,
      extraColumns: {
        ...prev.extraColumns,
        count: prev.extraColumns.count + 1,
        headings: [...prev.extraColumns.headings, `Extra Column ${prev.extraColumns.count + 1}`],
        emptyHeadings: [...prev.extraColumns.emptyHeadings, '']
      }
    }));
  };

  const removeExtraColumn = (index) => {
    setExportSettings(prev => ({
      ...prev,
      extraColumns: {
        ...prev.extraColumns,
        count: Math.max(1, prev.extraColumns.count - 1),
        headings: prev.extraColumns.headings.filter((_, i) => i !== index),
        emptyHeadings: prev.extraColumns.emptyHeadings.filter((_, i) => i !== index)
      }
    }));
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Export Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleExcelExport}
          className="btn-primary flex items-center space-x-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Export Excel</span>
        </button>

        <button
          onClick={handlePDFExport}
          className="btn-primary flex items-center space-x-2"
        >
          <FileText className="h-4 w-4" />
          <span>Export PDF</span>
        </button>

        <button
          onClick={() => setShowExportSettings(!showExportSettings)}
          className="btn-secondary flex items-center space-x-2"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Export Settings Modal */}
      {showExportSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Export Settings
                </h3>
                <button
                  onClick={() => setShowExportSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* PDF Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">PDF Export Settings</h4>
                  
                  {/* Extra Columns */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="extraColumns"
                        checked={exportSettings.extraColumns.enabled}
                        onChange={(e) => updateExportSettings('extraColumns', 'enabled', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="extraColumns" className="text-sm font-medium text-gray-700">
                        Add extra columns
                      </label>
                    </div>

                    {exportSettings.extraColumns.enabled && (
                      <div className="ml-6 space-y-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={addExtraColumn}
                            className="btn-secondary text-sm py-1 px-2"
                          >
                            Add Column
                          </button>
                          <span className="text-sm text-gray-500">
                            {exportSettings.extraColumns.count} extra column(s)
                          </span>
                        </div>

                        {Array.from({ length: exportSettings.extraColumns.count }).map((_, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="text"
                              placeholder="Column heading"
                              value={exportSettings.extraColumns.headings[index] || ''}
                              onChange={(e) => updateExtraColumnSettings(index, 'headings', e.target.value)}
                              className="input-field text-sm flex-1"
                            />
                            <input
                              type="text"
                              placeholder="Empty heading"
                              value={exportSettings.extraColumns.emptyHeadings[index] || ''}
                              onChange={(e) => updateExtraColumnSettings(index, 'emptyHeadings', e.target.value)}
                              className="input-field text-sm flex-1"
                            />
                            {exportSettings.extraColumns.count > 1 && (
                              <button
                                onClick={() => removeExtraColumn(index)}
                                className="text-red-600 hover:text-red-700 p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Extra Rows */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="extraRows"
                        checked={exportSettings.extraRows.enabled}
                        onChange={(e) => updateExportSettings('extraRows', 'enabled', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="extraRows" className="text-sm font-medium text-gray-700">
                        Add extra rows
                      </label>
                    </div>

                    {exportSettings.extraRows.enabled && (
                      <div className="ml-6">
                        <label className="block text-sm text-gray-700 mb-1">
                          Number of extra rows:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={exportSettings.extraRows.count}
                          onChange={(e) => updateExportSettings('extraRows', 'count', parseInt(e.target.value) || 1)}
                          className="input-field text-sm w-20"
                        />
                      </div>
                    )}

                    {/* Min Row Height */}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Minimum row height (px):
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={exportSettings.minRowHeight}
                        onChange={(e) => setExportSettings(prev => ({
                          ...prev,
                          minRowHeight: parseInt(e.target.value) || 20
                        }))}
                        className="input-field text-sm w-20"
                      />
                    </div>
                  </div>
                </div>

                {/* Excel Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Excel Export Settings</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeHeaders"
                        checked={exportSettings.includeHeaders}
                        onChange={(e) => setExportSettings(prev => ({
                          ...prev,
                          includeHeaders: e.target.checked
                        }))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="includeHeaders" className="text-sm font-medium text-gray-700">
                        Include column headers
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoWidth"
                        checked={exportSettings.autoWidth}
                        onChange={(e) => setExportSettings(prev => ({
                          ...prev,
                          autoWidth: e.target.checked
                        }))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="autoWidth" className="text-sm font-medium text-gray-700">
                        Auto-adjust column widths
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowExportSettings(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportControls;
