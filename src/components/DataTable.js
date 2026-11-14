import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Search, 
  Filter,
  Settings,
  ArrowUp,
  ArrowDown,
  GripVertical,
  MapPin,
  X,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  Pencil
} from 'lucide-react';
import ExportControls from './ExportControls';
import { saveJsonToFile, isFileSystemAccessSupported } from '../utils/jsonFileSave';
import { compareValues } from '../utils/sortCompare';
import { getFileFormat, getAcceptTypesForFormat, ensureFileNameExtension } from '../utils/tabularFile';

const PAGE_SIZE_OPTIONS = [100, 200, 500, 1000, 5000, 'ALL'];
const DEFAULT_PAGE_SIZE = 1000;

const DataTable = ({
  data,
  columns,
  onDataUpdate,
  sourceFileHandle,
  sourceFileName,
  onSourceFileHandle,
  onClearData,
}) => {
  const [visibleColumns, setVisibleColumns] = useState(
    columns.reduce((acc, col) => ({ ...acc, [col]: true }), {})
  );
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnOrder, setShowColumnOrder] = useState(false);
  const [columnOrder, setColumnOrder] = useState([...columns]);
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [showHeaderLabels, setShowHeaderLabels] = useState(false);
  const [headerLabels, setHeaderLabels] = useState(
    columns.reduce((acc, col) => ({ ...acc, [col]: col }), {})
  );
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [showValueMapping, setShowValueMapping] = useState(false);
  const [selectedColumnForMapping, setSelectedColumnForMapping] = useState(null);
  const [valueMappings, setValueMappings] = useState({});
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSettingsPreview, setShowSettingsPreview] = useState(false);
  const [settingsTextarea, setSettingsTextarea] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const settingsMenuRef = useRef(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [addedFieldName, setAddedFieldName] = useState(null);
  const [draftFieldName, setDraftFieldName] = useState('');
  const [editRowValues, setEditRowValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Click outside handler for settings menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    // Shallow copy so in-place sort never mutates parent state and so pagination
    // useMemo sees a new reference when sort changes (same ref would skip updates).
    let filteredData = [...data];

    // Apply search filter
    if (searchTerm) {
      filteredData = filteredData.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filteredData = filteredData.filter(row =>
          String(row[key]).toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // Apply sorting (numeric-aware for columns like admissionNumber)
    if (sortConfig.key) {
      filteredData.sort((a, b) =>
        compareValues(a[sortConfig.key], b[sortConfig.key], sortConfig.direction)
      );
    }

    return filteredData;
  }, [data, searchTerm, filters, sortConfig]);

  // Pagination
  const totalFiltered = filteredAndSortedData.length;
  const effectivePageSize = pageSize === 'ALL' ? totalFiltered : pageSize;
  const totalPages = Math.max(1, effectivePageSize === 0 ? 1 : Math.ceil(totalFiltered / effectivePageSize));

  const paginatedData = useMemo(() => {
    if (pageSize === 'ALL' || totalFiltered === 0) return filteredAndSortedData;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, pageSize, currentPage, totalFiltered]);

  useEffect(() => {
    setCurrentPage(p => Math.min(p, totalPages));
  }, [totalPages, totalFiltered, pageSize]);

  const handlePageSizeChange = (e) => {
    const value = e.target.value;
    setPageSize(value === 'ALL' ? 'ALL' : parseInt(value, 10));
    setCurrentPage(1);
  };

  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  const paginationStart = totalFiltered === 0 ? 0 : (currentPage - 1) * (pageSize === 'ALL' ? totalFiltered : pageSize) + 1;
  const paginationEnd = pageSize === 'ALL' ? totalFiltered : Math.min(currentPage * pageSize, totalFiltered);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleColumnVisibility = (column) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const setAllColumnsVisible = (visible) => {
    setVisibleColumns(prev => {
      const next = { ...prev };
      columnOrder.forEach((col) => {
        next[col] = visible;
      });
      return next;
    });
  };

  const handleFilterChange = (column, value) => {
    setFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const moveColumn = (fromIndex, toIndex) => {
    const newOrder = [...columnOrder];
    const [movedColumn] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedColumn);
    setColumnOrder(newOrder);
  };

  const moveColumnUp = (index) => {
    if (index > 0) {
      moveColumn(index, index - 1);
    }
  };

  const moveColumnDown = (index) => {
    if (index < columnOrder.length - 1) {
      moveColumn(index, index + 1);
    }
  };

  const resetColumnOrder = () => {
    setColumnOrder([...columns]);
  };

  const handleHeaderLabelChange = (column, newLabel) => {
    setHeaderLabels(prev => ({
      ...prev,
      [column]: newLabel
    }));
  };

  const resetHeaderLabels = () => {
    setHeaderLabels(columns.reduce((acc, col) => ({ ...acc, [col]: col }), {}));
  };

  const openValueMapping = (column) => {
    setSelectedColumnForMapping(column);
    setShowValueMapping(true);
  };

  const closeValueMapping = () => {
    setShowValueMapping(false);
    setSelectedColumnForMapping(null);
  };

  const addValueMapping = (column, originalValue, mappedValue) => {
    setValueMappings(prev => ({
      ...prev,
      [column]: {
        ...prev[column],
        [originalValue]: mappedValue
      }
    }));
  };

  const removeValueMapping = (column, originalValue) => {
    setValueMappings(prev => {
      const newMappings = { ...prev };
      if (newMappings[column]) {
        delete newMappings[column][originalValue];
        if (Object.keys(newMappings[column]).length === 0) {
          delete newMappings[column];
        }
      }
      return newMappings;
    });
  };

  const resetValueMappings = (column) => {
    setValueMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[column];
      return newMappings;
    });
  };

  const getDisplayValue = (column, value) => {
    if (valueMappings[column] && valueMappings[column][value] !== undefined) {
      return valueMappings[column][value];
    }
    return value;
  };

  const getUniqueValues = (column) => {
    const values = [...new Set(data.map(row => String(row[column])))];
    return values.sort();
  };

  // Settings persistence functions
  const saveCurrentSettings = () => {
    const settings = {
      visibleColumns,
      columnOrder,
      headerLabels,
      valueMappings,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('tableSettings', JSON.stringify(settings));
    alert('Settings saved successfully!');
  };

  const loadSavedSettings = () => {
    const savedSettings = localStorage.getItem('tableSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        
        // Apply settings that match current columns
        const newVisibleColumns = {};
        const newColumnOrder = [];
        const newHeaderLabels = {};
        const newValueMappings = {};
        
        // Apply visible columns and column order
        columns.forEach(col => {
          if (settings.visibleColumns && settings.visibleColumns[col] !== undefined) {
            newVisibleColumns[col] = settings.visibleColumns[col];
          } else {
            newVisibleColumns[col] = true; // Default to visible
          }
        });
        
        // Apply column order (only for columns that exist)
        if (settings.columnOrder) {
          settings.columnOrder.forEach(col => {
            if (columns.includes(col)) {
              newColumnOrder.push(col);
            }
          });
        }
        
        // Add any new columns that weren't in saved settings
        columns.forEach(col => {
          if (!newColumnOrder.includes(col)) {
            newColumnOrder.push(col);
          }
        });
        
        // Apply header labels
        columns.forEach(col => {
          if (settings.headerLabels && settings.headerLabels[col]) {
            newHeaderLabels[col] = settings.headerLabels[col];
          } else {
            newHeaderLabels[col] = col;
          }
        });
        
        // Apply value mappings
        columns.forEach(col => {
          if (settings.valueMappings && settings.valueMappings[col]) {
            newValueMappings[col] = settings.valueMappings[col];
          }
        });
        
        setVisibleColumns(newVisibleColumns);
        setColumnOrder(newColumnOrder);
        setHeaderLabels(newHeaderLabels);
        setValueMappings(newValueMappings);
        
        alert('Settings loaded successfully!');
      } catch (error) {
        console.error('Error loading settings:', error);
        alert('Error loading settings. Please try again.');
      }
    } else {
      alert('No saved settings found.');
    }
  };

  const clearSavedSettings = () => {
    if (confirm('Are you sure you want to clear all saved settings?')) {
      localStorage.removeItem('tableSettings');
      alert('Settings cleared successfully!');
    }
  };

  const exportSettings = () => {
    const settings = {
      visibleColumns,
      columnOrder,
      headerLabels,
      valueMappings,
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `table-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          applySettings(settings);
          alert('Settings imported successfully!');
        } catch (error) {
          console.error('Error importing settings:', error);
          alert('Error importing settings. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const applySettings = (settings) => {
    // Apply settings similar to loadSavedSettings
    const newVisibleColumns = {};
    const newColumnOrder = [];
    const newHeaderLabels = {};
    const newValueMappings = {};
    
    columns.forEach(col => {
      if (settings.visibleColumns && settings.visibleColumns[col] !== undefined) {
        newVisibleColumns[col] = settings.visibleColumns[col];
      } else {
        newVisibleColumns[col] = true;
      }
    });
    
    if (settings.columnOrder) {
      settings.columnOrder.forEach(col => {
        if (columns.includes(col)) {
          newColumnOrder.push(col);
        }
      });
    }
    
    columns.forEach(col => {
      if (!newColumnOrder.includes(col)) {
        newColumnOrder.push(col);
      }
    });
    
    columns.forEach(col => {
      if (settings.headerLabels && settings.headerLabels[col]) {
        newHeaderLabels[col] = settings.headerLabels[col];
      } else {
        newHeaderLabels[col] = col;
      }
    });
    
    columns.forEach(col => {
      if (settings.valueMappings && settings.valueMappings[col]) {
        newValueMappings[col] = settings.valueMappings[col];
      }
    });
    
    setVisibleColumns(newVisibleColumns);
    setColumnOrder(newColumnOrder);
    setHeaderLabels(newHeaderLabels);
    setValueMappings(newValueMappings);
  };

  const showSettingsPreviewModal = () => {
    const settings = {
      visibleColumns,
      columnOrder,
      headerLabels,
      valueMappings,
      timestamp: new Date().toISOString()
    };
    setSettingsTextarea(JSON.stringify(settings, null, 2));
    setShowSettingsPreview(true);
  };

  const applySettingsFromTextarea = () => {
    try {
      const settings = JSON.parse(settingsTextarea);
      applySettings(settings);
      setShowSettingsPreview(false);
      alert('Settings applied successfully!');
    } catch (error) {
      console.error('Error parsing settings:', error);
      alert('Error parsing settings. Please check the JSON format.');
    }
  };

  const copySettingsToClipboard = () => {
    navigator.clipboard.writeText(settingsTextarea).then(() => {
      alert('Settings copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard. Please try again.');
    });
  };

  const handleDragStart = (e, column) => {
    setDraggedItem(column);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, column) => {
    e.preventDefault();
    setDragOverItem(column);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverItem(null);
  };

  const handleDrop = (e, targetColumn) => {
    e.preventDefault();
    
    if (draggedItem && draggedItem !== targetColumn) {
      const draggedIndex = columnOrder.indexOf(draggedItem);
      const targetIndex = columnOrder.indexOf(targetColumn);
      
      const newOrder = [...columnOrder];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      
      setColumnOrder(newOrder);
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const visibleColumnsList = columnOrder.filter(col => visibleColumns[col]);

  const activeCustomField = addedFieldName || draftFieldName.trim();

  const getDataRowIndex = (row) => data.findIndex((r) => r === row);

  const handleStartEdit = () => {
    const field = addedFieldName || '';
    const values = {};
    data.forEach((row, i) => {
      values[i] =
        field && row[field] !== null && row[field] !== undefined
          ? String(row[field])
          : '';
    });
    setEditRowValues(values);
    setDraftFieldName(field);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setDraftFieldName(addedFieldName || '');
    setEditRowValues({});
  };

  const handleEditValueChange = (rowIndex, value) => {
    setEditRowValues((prev) => ({ ...prev, [rowIndex]: value }));
  };

  const handleSaveEdits = async () => {
    const fieldName = (addedFieldName || draftFieldName).trim();
    if (!fieldName) {
      alert('Please enter a field name for the new column.');
      return;
    }
    if (columns.includes(fieldName) && fieldName !== addedFieldName) {
      alert('This field name already exists. You can only add one new field.');
      return;
    }
    if (addedFieldName && fieldName !== addedFieldName) {
      alert('Only one custom field is allowed. You cannot change the field name.');
      return;
    }

    const newData = data.map((row, i) => ({
      ...row,
      [fieldName]: editRowValues[i] ?? '',
    }));

    const newColumns = columns.includes(fieldName) ? columns : [...columns, fieldName];
    const newColumnOrder = columnOrder.includes(fieldName)
      ? columnOrder
      : [...columnOrder, fieldName];

    setIsSaving(true);
    try {
      let fileHandle = sourceFileHandle;
      const saveFormat = getFileFormat(sourceFileName) || 'json';
      if (!fileHandle && isFileSystemAccessSupported()) {
        try {
          const [handle] = await window.showSaveFilePicker({
            suggestedName: ensureFileNameExtension(sourceFileName || 'data', saveFormat),
            types: [getAcceptTypesForFormat(saveFormat)],
          });
          fileHandle = handle;
          onSourceFileHandle?.(handle);
        } catch (err) {
          if (err.name === 'AbortError') {
            setIsSaving(false);
            return;
          }
        }
      }

      const result = await saveJsonToFile(newData, fileHandle, sourceFileName);
      onDataUpdate(newData, newColumns);
      setAddedFieldName(fieldName);
      setColumnOrder(newColumnOrder);
      setVisibleColumns((prev) => ({ ...prev, [fieldName]: true }));
      setHeaderLabels((prev) => ({ ...prev, [fieldName]: fieldName }));
      setIsEditMode(false);
      setDraftFieldName(fieldName);

      if (result.method === 'file') {
        alert(`Saved to ${result.fileName}`);
      } else {
        alert(
          `Downloaded ${result.fileName}. Use "browse files" when opening a file to save directly to the same file next time.`
        );
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save file.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayColumnsList =
    isEditMode && activeCustomField && !visibleColumnsList.includes(activeCustomField)
      ? [...visibleColumnsList, activeCustomField]
      : visibleColumnsList;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Column Settings */}
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Columns</span>
          </button>

          {/* Toggle Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center space-x-2"
          >
            {showFilters ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
          </button>

          {/* Column Order */}
          <button
            onClick={() => setShowColumnOrder(!showColumnOrder)}
            className="btn-secondary flex items-center space-x-2"
          >
            <GripVertical className="h-4 w-4" />
            <span>Column Order</span>
          </button>


          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="btn-secondary flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>Clear Filters</span>
          </button>

          {/* Edit / Save */}
          {!isEditMode ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="btn-secondary flex items-center space-x-2"
            >
              <Pencil className="h-4 w-4" />
              <span>Edit</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-secondary flex items-center space-x-2"
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                className="btn-primary flex items-center space-x-2"
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}

          {/* Export Controls */}
          <ExportControls 
            data={filteredAndSortedData} 
            columns={visibleColumnsList}
            headerLabels={headerLabels}
            valueMappings={valueMappings}
            onClearData={onClearData}
          />

          {/* Settings Menu */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>Table Settings</span>
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Table Settings</h3>
                  
                  <div className="space-y-3">
                    {/* Save Settings */}
                    <button
                      onClick={() => {
                        saveCurrentSettings();
                        setShowSettingsMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Current Settings</span>
                    </button>

                    {/* Load Settings */}
                    <button
                      onClick={() => {
                        loadSavedSettings();
                        setShowSettingsMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Load Saved Settings</span>
                    </button>

                    {/* Export Settings */}
                    <button
                      onClick={() => {
                        exportSettings();
                        setShowSettingsMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Settings File</span>
                    </button>

                    {/* Preview Settings */}
                    <button
                      onClick={() => {
                        showSettingsPreviewModal();
                        setShowSettingsMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Preview Settings</span>
                    </button>

                    {/* Import Settings */}
                    <label className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                      <Upload className="h-4 w-4" />
                      <span>Import Settings File</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          importSettings(e);
                          setShowSettingsMenu(false);
                        }}
                        className="hidden"
                      />
                    </label>

                    <div className="border-t border-gray-200 pt-3">
                      <button
                        onClick={() => {
                          clearSavedSettings();
                          setShowSettingsMenu(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="h-4 w-4" />
                        <span>Clear Saved Settings</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column Settings Panel */}
        {showColumnSettings && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-medium text-gray-900">Show/Hide Columns</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllColumnsVisible(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-300" aria-hidden>|</span>
                <button
                  type="button"
                  onClick={() => setAllColumnsVisible(false)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Unselect All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {columnOrder.map(column => (
                <label key={column} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column]}
                    onChange={() => toggleColumnVisibility(column)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{column}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Column Order Panel */}
        {showColumnOrder && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Column Order & Position</h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowOnlyVisible(!showOnlyVisible)}
                  className={`text-sm font-medium px-3 py-1 rounded-md transition-colors duration-200 ${
                    showOnlyVisible
                      ? 'bg-primary-100 text-primary-700 border border-primary-200'
                      : 'text-gray-600 hover:text-gray-700 border border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {showOnlyVisible ? 'Show All' : 'Show Visible Only'}
                </button>
                <button
                  onClick={resetColumnOrder}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Reset Order
                </button>
                <button
                  onClick={resetHeaderLabels}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Reset Labels
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {columnOrder
                .filter(column => showOnlyVisible ? visibleColumns[column] : true)
                .map((column, index) => {
                  const originalIndex = columnOrder.indexOf(column);
                  return (
                <div
                  key={column}
                  draggable
                  onDragStart={(e) => handleDragStart(e, column)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, column)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column)}
                  className={`p-3 rounded-lg border cursor-move transition-all duration-200 ${
                    visibleColumns[column] 
                      ? 'bg-gray-50 border-gray-200' 
                      : 'bg-red-50 border-red-200'
                  } ${
                    draggedItem === column 
                      ? 'opacity-50 scale-95' 
                      : ''
                  } ${
                    dragOverItem === column && draggedItem !== column
                      ? 'border-primary-300 bg-primary-50 shadow-md' 
                      : ''
                  } hover:shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">
                        {showOnlyVisible ? `${index + 1}.` : `${originalIndex + 1}.`} {column}
                      </span>
                      <span className="text-xs text-gray-500">
                        {visibleColumns[column] ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => moveColumnUp(originalIndex)}
                        disabled={originalIndex === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveColumnDown(originalIndex)}
                        disabled={originalIndex === columnOrder.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleColumnVisibility(column)}
                        className={`p-1 hover:text-gray-600 transition-colors duration-200 ${
                          visibleColumns[column] 
                            ? 'text-gray-600' 
                            : 'text-gray-400'
                        }`}
                        title={visibleColumns[column] ? 'Hide column' : 'Show column'}
                      >
                        {visibleColumns[column] ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Header Label Input */}
                  <div className="ml-7">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Header Label:
                    </label>
                    <input
                      type="text"
                      value={headerLabels[column] || column}
                      onChange={(e) => handleHeaderLabelChange(column, e.target.value)}
                      placeholder={`Enter label for ${column}...`}
                      className="input-field text-sm w-full"
                    />
                  </div>

                  {/* Value Mapping Button */}
                  <div className="ml-7 mt-2">
                    <button
                      onClick={() => openValueMapping(column)}
                      className="flex items-center space-x-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      <MapPin className="h-3 w-3" />
                      <span>Map Values</span>
                      {valueMappings[column] && Object.keys(valueMappings[column]).length > 0 && (
                        <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full text-xs">
                          {Object.keys(valueMappings[column]).length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                  );
                })}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Drag and drop columns to reorder them, or use the arrow buttons. 
                Customize header labels and manage visibility. The table will update automatically.
              </p>
            </div>
          </div>
        )}


        {/* Custom field edit panel */}
        {isEditMode && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-medium text-amber-900 mb-2">Add / edit one custom field</h3>
            <p className="text-sm text-amber-800 mb-3">
              Enter one field name, then fill values in the table column. Save writes back to your JSON file.
            </p>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field name
              </label>
              <input
                type="text"
                value={addedFieldName || draftFieldName}
                onChange={(e) => setDraftFieldName(e.target.value)}
                disabled={Boolean(addedFieldName)}
                placeholder="e.g. remarks"
                className="input-field text-sm w-full disabled:bg-gray-100 disabled:text-gray-600"
              />
              {addedFieldName && (
                <p className="text-xs text-gray-500 mt-1">
                  Field name is locked after first save. You can still edit values.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Column Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">Column Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleColumnsList.map(column => (
                <div key={column}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter {column}
                  </label>
                  <input
                    type="text"
                    placeholder={`Filter by ${column}...`}
                    value={filters[column] || ''}
                    onChange={(e) => handleFilterChange(column, e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {displayColumnsList.map(column => (
                <th
                  key={column}
                  className={`table-header relative group ${
                    isEditMode && column === activeCustomField
                      ? 'bg-amber-100'
                      : 'cursor-pointer hover:bg-gray-200 transition-colors duration-200'
                  }`}
                  onClick={() => {
                    if (!(isEditMode && column === activeCustomField)) {
                      handleSort(column);
                    }
                  }}
                  onMouseEnter={() => setHoveredColumn(column)}
                  onMouseLeave={() => setHoveredColumn(null)}
                >
                  <div className="flex items-center justify-between">
                    <span>{headerLabels[column] || column}</span>
                    <div className="flex items-center space-x-2">
                      {/* Hide/Show Icon - appears on hover */}
                      {hoveredColumn === column && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleColumnVisibility(column);
                          }}
                          className={`p-1 rounded hover:bg-gray-300 transition-colors duration-200 ${
                            visibleColumns[column] 
                              ? 'text-gray-600 hover:text-gray-800' 
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                          title={visibleColumns[column] ? 'Hide column' : 'Show column'}
                        >
                          {visibleColumns[column] ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      
                      {/* Sort Icons */}
                      <div className="flex flex-col">
                        <ChevronUp 
                          className={`h-3 w-3 ${
                            sortConfig.key === column && sortConfig.direction === 'asc' 
                              ? 'text-primary-600' 
                              : 'text-gray-400'
                          }`} 
                        />
                        <ChevronDown 
                          className={`h-3 w-3 -mt-1 ${
                            sortConfig.key === column && sortConfig.direction === 'desc' 
                              ? 'text-primary-600' 
                              : 'text-gray-400'
                          }`} 
                        />
                      </div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => {
              const dataRowIndex = getDataRowIndex(row);
              return (
              <tr key={`${dataRowIndex}-${index}`} className="hover:bg-gray-50">
                {displayColumnsList.map(column => (
                  <td
                    key={column}
                    className={`table-cell ${
                      isEditMode && column === activeCustomField ? 'bg-amber-50' : ''
                    }`}
                  >
                    {isEditMode && column === activeCustomField ? (
                      <input
                        type="text"
                        value={editRowValues[dataRowIndex] ?? ''}
                        onChange={(e) =>
                          handleEditValueChange(dataRowIndex, e.target.value)
                        }
                        placeholder="Enter value..."
                        className="input-field text-sm w-full min-w-[8rem]"
                      />
                    ) : (
                      <div className="max-w-xs truncate" title={String(row[column])}>
                        {row[column] !== null && row[column] !== undefined
                          ? getDisplayValue(column, String(row[column]))
                          : '-'}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {/* Results Summary & Pagination */}
      <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 flex flex-wrap items-center justify-between gap-3">
        <div>
          Showing {totalFiltered === 0 ? 0 : paginationStart}–{paginationEnd} of {totalFiltered} rows
          {totalFiltered !== data.length && (
            <span className="ml-2 text-primary-600">
              ({data.length} total{Object.values(filters).some(f => f) || searchTerm ? ', filtered' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-gray-600 whitespace-nowrap">Rows per page</label>
            <select
              id="page-size"
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {PAGE_SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === 'ALL' ? 'ALL' : opt}</option>
              ))}
            </select>
          </div>
          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Value Mapping Modal */}
      {showValueMapping && selectedColumnForMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Value Mapping for "{selectedColumnForMapping}"
                </h3>
                <button
                  onClick={closeValueMapping}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Current Mappings */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Current Mappings</h4>
                  {valueMappings[selectedColumnForMapping] && Object.keys(valueMappings[selectedColumnForMapping]).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(valueMappings[selectedColumnForMapping]).map(([original, mapped]) => (
                        <div key={original} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="font-medium text-gray-700">{original}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-primary-600">{mapped}</span>
                          </div>
                          <button
                            onClick={() => removeValueMapping(selectedColumnForMapping, original)}
                            className="text-red-600 hover:text-red-700 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No mappings defined yet.</p>
                  )}
                </div>

                {/* Add New Mapping */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Add New Mapping</h4>
                  <ValueMappingForm 
                    column={selectedColumnForMapping}
                    uniqueValues={getUniqueValues(selectedColumnForMapping)}
                    onAddMapping={addValueMapping}
                    existingMappings={valueMappings[selectedColumnForMapping] || {}}
                  />
                </div>

                {/* Available Values */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Available Values in Data</h4>
                  <div className="flex flex-wrap gap-2">
                    {getUniqueValues(selectedColumnForMapping).map(value => (
                      <span 
                        key={value}
                        className={`px-2 py-1 rounded text-xs ${
                          valueMappings[selectedColumnForMapping] && valueMappings[selectedColumnForMapping][value]
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t border-gray-200">
                  <button
                    onClick={() => resetValueMappings(selectedColumnForMapping)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear All Mappings
                  </button>
                  <button
                    onClick={closeValueMapping}
                    className="btn-primary"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Preview Modal */}
      {showSettingsPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Settings Preview & Copy/Paste
                </h3>
                <button
                  onClick={() => setShowSettingsPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Settings JSON Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Settings JSON (Editable)
                  </label>
                  <textarea
                    value={settingsTextarea}
                    onChange={(e) => setSettingsTextarea(e.target.value)}
                    className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Settings JSON will appear here..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="flex space-x-3">
                    <button
                      onClick={copySettingsToClipboard}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Copy to Clipboard</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        const settings = {
                          visibleColumns,
                          columnOrder,
                          headerLabels,
                          valueMappings,
                          timestamp: new Date().toISOString()
                        };
                        setSettingsTextarea(JSON.stringify(settings, null, 2));
                      }}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowSettingsPreview(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applySettingsFromTextarea}
                      className="btn-primary"
                    >
                      Apply Settings
                    </button>
                  </div>
                </div>

                {/* Help Text */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">How to use:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Edit the JSON above to modify settings</li>
                    <li>• Click "Apply Settings" to use the modified settings</li>
                    <li>• Click "Copy to Clipboard" to share settings</li>
                    <li>• Paste settings from others into the textarea and apply</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Value Mapping Form Component
const ValueMappingForm = ({ column, uniqueValues, onAddMapping, existingMappings }) => {
  const [originalValue, setOriginalValue] = useState('');
  const [mappedValue, setMappedValue] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalOriginalValue = isCustom ? customValue : originalValue;
    if (finalOriginalValue && mappedValue && !existingMappings[finalOriginalValue]) {
      onAddMapping(column, finalOriginalValue, mappedValue);
      setOriginalValue('');
      setMappedValue('');
      setCustomValue('');
      setIsCustom(false);
    }
  };

  const handleOriginalValueChange = (e) => {
    const value = e.target.value;
    if (value === 'custom') {
      setIsCustom(true);
      setOriginalValue('');
    } else {
      setIsCustom(false);
      setOriginalValue(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end space-x-3">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Original Value
        </label>
        {isCustom ? (
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Enter custom value..."
            className="input-field text-sm"
            required
          />
        ) : (
          <select
            value={originalValue}
            onChange={handleOriginalValueChange}
            className="input-field text-sm"
            required
          >
            <option value="">Select a value...</option>
            {uniqueValues
              .filter(value => !existingMappings[value])
              .map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            <option value="custom">Custom Value...</option>
          </select>
        )}
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mapped Value
        </label>
        <input
          type="text"
          value={mappedValue}
          onChange={(e) => setMappedValue(e.target.value)}
          placeholder="Enter display value..."
          className="input-field text-sm"
          required
        />
      </div>
      <button
        type="submit"
        className="btn-primary flex items-center space-x-1"
        disabled={!mappedValue || (isCustom ? !customValue : !originalValue) || existingMappings[isCustom ? customValue : originalValue]}
      >
        <Plus className="h-4 w-4" />
        <span>Add</span>
      </button>
    </form>
  );
};

export default DataTable;
