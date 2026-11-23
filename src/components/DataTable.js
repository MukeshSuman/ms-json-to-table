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
  Pencil,
  ListFilter,
  Check,
  ChevronRight,
  CornerDownRight,
  FolderOpen
} from 'lucide-react';
import ExportControls from './ExportControls';
import { saveJsonToFile, isFileSystemAccessSupported } from '../utils/jsonFileSave';
import { compareValues } from '../utils/sortCompare';
import { getFileFormat, getAcceptTypesForFormat, ensureFileNameExtension } from '../utils/tabularFile';
import {
  detectColumnValueType,
  findSampleValue,
  getKeysAtPath,
  resolveByPath,
  formatResolvedValue,
  pathToLabel,
  canGoDeeper,
  MAX_NEST_DEPTH,
} from '../utils/nestedValue';
import {
  listSettingPresets,
  saveSettingPreset,
  deleteSettingPreset,
  clearAllSettingPresets,
  renameSettingPreset,
  formatPresetDate,
  sanitizeSettingsFileName,
  downloadSettingsJson,
} from '../utils/tableSettingsStore';

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
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSettingsPreview, setShowSettingsPreview] = useState(false);
  const [settingsTextarea, setSettingsTextarea] = useState('');
  const [settingPresets, setSettingPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [activePresetId, setActivePresetId] = useState(null);
  const [renamingPresetId, setRenamingPresetId] = useState(null);
  const [renamePresetValue, setRenamePresetValue] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const settingsMenuRef = useRef(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [addedFieldName, setAddedFieldName] = useState(null);
  const [draftFieldName, setDraftFieldName] = useState('');
  const [editRowValues, setEditRowValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(null);
  const [columnMenuPosition, setColumnMenuPosition] = useState({ top: 0, left: 0 });
  const [columnDropdownEnabled, setColumnDropdownEnabled] = useState({});
  const [columnDropdownValues, setColumnDropdownValues] = useState({});
  const [dropdownValueSearch, setDropdownValueSearch] = useState('');
  const [columnValuePaths, setColumnValuePaths] = useState({});
  const [nestedBrowsePath, setNestedBrowsePath] = useState([]);
  const columnMenuRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) {
        setColumnMenuOpen(null);
        setDropdownValueSearch('');
        setNestedBrowsePath([]);
      }
    };

    if (columnMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [columnMenuOpen]);

  const getResolvedRawValue = (row, column) => {
    const path = columnValuePaths[column] || [];
    if (!path.length) {
      return row?.[column];
    }
    return resolveByPath(row?.[column], path);
  };

  const getCellText = (row, column) => {
    const resolved = getResolvedRawValue(row, column);
    const formatted = formatResolvedValue(resolved);
    if (formatted === '-') {
      return '-';
    }
    if (valueMappings[column] && valueMappings[column][formatted] !== undefined) {
      return valueMappings[column][formatted];
    }
    if (
      valueMappings[column] &&
      valueMappings[column][String(resolved)] !== undefined
    ) {
      return valueMappings[column][String(resolved)];
    }
    return formatted;
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    // Shallow copy so in-place sort never mutates parent state and so pagination
    // useMemo sees a new reference when sort changes (same ref would skip updates).
    let filteredData = [...data];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredData = filteredData.filter((row) =>
        columns.some((column) =>
          String(getCellText(row, column)).toLowerCase().includes(term)
        )
      );
    }

    // Apply column text filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        const needle = value.toLowerCase();
        filteredData = filteredData.filter((row) =>
          String(getCellText(row, key)).toLowerCase().includes(needle)
        );
      }
    });

    // Apply column dropdown exact-match filters
    Object.entries(columnDropdownValues).forEach(([key, selected]) => {
      if (selected && selected.length > 0) {
        const selectedSet = new Set(selected);
        filteredData = filteredData.filter((row) =>
          selectedSet.has(String(getCellText(row, key)))
        );
      }
    });

    // Apply sorting (numeric-aware for columns like admissionNumber)
    if (sortConfig.key) {
      filteredData.sort((a, b) =>
        compareValues(
          getCellText(a, sortConfig.key),
          getCellText(b, sortConfig.key),
          sortConfig.direction
        )
      );
    }

    return filteredData;
  }, [data, columns, searchTerm, filters, columnDropdownValues, columnValuePaths, valueMappings, sortConfig]);

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
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setColumnDropdownValues({});
    setColumnDropdownEnabled({});
    setColumnMenuOpen(null);
    setDropdownValueSearch('');
  };

  const isColumnFilterActive = (column) => {
    const hasSearch = Boolean(filters[column]);
    const hasDropdown = (columnDropdownValues[column] || []).length > 0;
    const hasNestedPath = (columnValuePaths[column] || []).length > 0;
    return hasSearch || hasDropdown || hasNestedPath;
  };

  const toggleColumnMenu = (column, e) => {
    e.stopPropagation();
    if (columnMenuOpen === column) {
      setColumnMenuOpen(null);
      setDropdownValueSearch('');
      setNestedBrowsePath([]);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 320;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    setColumnMenuPosition({
      top: rect.bottom + 6,
      left,
    });
    setColumnMenuOpen(column);
    setDropdownValueSearch('');
    setNestedBrowsePath(columnValuePaths[column] || []);
  };

  const setColumnRootPath = (column, path) => {
    setColumnValuePaths((prev) => {
      if (!path.length) {
        const next = { ...prev };
        delete next[column];
        return next;
      }
      return { ...prev, [column]: path };
    });
    setColumnDropdownValues((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const clearColumnRootPath = (column) => {
    setColumnValuePaths((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
    setNestedBrowsePath([]);
  };

  const toggleColumnDropdownMode = (column) => {
    setColumnDropdownEnabled((prev) => {
      const nextEnabled = !prev[column];
      if (!nextEnabled) {
        setColumnDropdownValues((values) => {
          const next = { ...values };
          delete next[column];
          return next;
        });
      }
      return { ...prev, [column]: nextEnabled };
    });
  };

  const toggleDropdownValue = (column, value) => {
    setColumnDropdownValues((prev) => {
      const current = prev[column] || [];
      const exists = current.includes(value);
      const nextValues = exists
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (nextValues.length === 0) {
        const next = { ...prev };
        delete next[column];
        return next;
      }
      return { ...prev, [column]: nextValues };
    });
    setCurrentPage(1);
  };

  const clearColumnFilter = (column) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
    setColumnDropdownValues((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
    setCurrentPage(1);
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
    const values = [
      ...new Set(
        data.map((row) => {
          const text = getCellText(row, column);
          return text === '-' ? '' : String(text);
        })
      ),
    ];
    return values.sort();
  };

  // Settings persistence functions
  const buildCurrentSettingsSnapshot = () => ({
    visibleColumns,
    columnOrder,
    headerLabels,
    valueMappings,
    columnValuePaths,
    timestamp: new Date().toISOString(),
  });

  const refreshSettingPresets = () => {
    setSettingPresets(listSettingPresets());
  };

  const saveCurrentSettings = () => {
    const settings = buildCurrentSettingsSnapshot();
    localStorage.setItem('tableSettings', JSON.stringify(settings));
    alert('Settings saved successfully!');
  };

  const openSettingsPanel = () => {
    refreshSettingPresets();
    setShowSettingsPanel(true);
    setShowSettingsMenu(false);
  };

  const handleSaveNamedPreset = () => {
    try {
      const preset = saveSettingPreset(presetName, buildCurrentSettingsSnapshot());
      setPresetName('');
      setActivePresetId(preset.id);
      refreshSettingPresets();
      alert(`Saved settings as "${preset.name}"`);
    } catch (err) {
      alert(err.message || 'Failed to save settings');
    }
  };

  const handleLoadNamedPreset = (preset) => {
    if (!preset?.settings) {
      alert('Invalid settings preset');
      return;
    }
    applySettings(preset.settings);
    setActivePresetId(preset.id);
    alert(`Loaded "${preset.name}"`);
  };

  const handleUpdateNamedPreset = (preset) => {
    try {
      const updated = saveSettingPreset(
        preset.name,
        buildCurrentSettingsSnapshot(),
        preset.id
      );
      setActivePresetId(updated.id);
      refreshSettingPresets();
      alert(`Updated "${updated.name}" with current settings`);
    } catch (err) {
      alert(err.message || 'Failed to update settings');
    }
  };

  const handleExportNamedPreset = (preset) => {
    if (!preset?.settings) {
      alert('Invalid settings preset');
      return;
    }
    const fileName = sanitizeSettingsFileName(preset.name);
    downloadSettingsJson(
      {
        ...preset.settings,
        name: preset.name,
        timestamp: preset.updatedAt || preset.createdAt || new Date().toISOString(),
      },
      fileName
    );
  };

  const handleDeleteNamedPreset = (preset) => {
    if (!confirm(`Delete settings "${preset.name}"?`)) return;
    deleteSettingPreset(preset.id);
    if (activePresetId === preset.id) {
      setActivePresetId(null);
    }
    refreshSettingPresets();
  };

  const handleClearAllNamedPresets = () => {
    if (!confirm('Clear all named settings presets from this browser?')) return;
    clearAllSettingPresets();
    setActivePresetId(null);
    refreshSettingPresets();
  };

  const handleStartRenamePreset = (preset) => {
    setRenamingPresetId(preset.id);
    setRenamePresetValue(preset.name);
  };

  const handleCommitRenamePreset = (preset) => {
    try {
      renameSettingPreset(preset.id, renamePresetValue);
      setRenamingPresetId(null);
      setRenamePresetValue('');
      refreshSettingPresets();
    } catch (err) {
      alert(err.message || 'Failed to rename');
    }
  };

  const loadSavedSettings = () => {
    const savedSettings = localStorage.getItem('tableSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        applySettings(settings);
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
    const settings = buildCurrentSettingsSnapshot();
    const fileName = `table-settings-${new Date().toISOString().split('T')[0]}.json`;
    downloadSettingsJson(settings, fileName);
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
    const newColumnValuePaths = {};
    
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
      if (settings.columnValuePaths && Array.isArray(settings.columnValuePaths[col])) {
        newColumnValuePaths[col] = settings.columnValuePaths[col];
      }
    });
    
    setVisibleColumns(newVisibleColumns);
    setColumnOrder(newColumnOrder);
    setHeaderLabels(newHeaderLabels);
    setValueMappings(newValueMappings);
    setColumnValuePaths(newColumnValuePaths);
  };

  const showSettingsPreviewModal = () => {
    const settings = buildCurrentSettingsSnapshot();
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

  const exportReadyData = useMemo(
    () =>
      filteredAndSortedData.map((row) => {
        const next = { ...row };
        visibleColumnsList.forEach((column) => {
          next[column] = getCellText(row, column);
        });
        return next;
      }),
    [filteredAndSortedData, visibleColumnsList, columnValuePaths, valueMappings]
  );

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
            data={exportReadyData} 
            columns={visibleColumnsList}
            headerLabels={headerLabels}
            valueMappings={{}}
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
                    <button
                      onClick={openSettingsPanel}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-primary-700 bg-primary-50 hover:bg-primary-100 rounded font-medium"
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span>Open Settings</span>
                    </button>

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

        {/* Named Settings Panel */}
        {showSettingsPanel && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-gray-900">Open Settings</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Save multiple named table setups in this browser and load any one anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsPanel(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 space-y-1">
              <p className="font-medium">What you can do here</p>
              <ul className="list-disc pl-5 space-y-0.5 text-blue-800">
                <li>Save the current column/filter setup with a custom name</li>
                <li>Keep many presets (not just one) in localStorage</li>
                <li>Click any preset to load it into the table</li>
                <li>Use Update on a preset to overwrite it with your latest column/show-hide changes</li>
                <li>Export any preset as JSON (filename from preset name; unsafe characters become dashes)</li>
                <li>Rename or delete individual presets, or clear all</li>
              </ul>
              <p className="text-xs text-blue-700 pt-1">
                Note: localStorage does not auto-expire. Presets stay until you delete them or clear browser site data.
                Existing Save/Load/Export/Import menu options still work as before.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Save current settings as
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. Teachers transfer view"
                  className="input-field flex-1 min-w-[14rem] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNamedPreset();
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveNamedPreset}
                  className="btn-primary flex items-center space-x-2 text-sm"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Saved presets ({settingPresets.length})
                </p>
                {settingPresets.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllNamedPresets}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {settingPresets.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-500">
                  No named presets yet. Save current settings above.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {settingPresets.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    const isRenaming = renamingPresetId === preset.id;
                    return (
                      <li
                        key={preset.id}
                        className={`px-3 py-3 flex flex-wrap items-start justify-between gap-3 ${
                          isActive ? 'bg-primary-50' : 'bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="text"
                                value={renamePresetValue}
                                onChange={(e) => setRenamePresetValue(e.target.value)}
                                className="input-field text-sm flex-1 min-w-[10rem]"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitRenamePreset(preset);
                                  if (e.key === 'Escape') {
                                    setRenamingPresetId(null);
                                    setRenamePresetValue('');
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleCommitRenamePreset(preset)}
                                className="text-sm text-primary-700 font-medium"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLoadNamedPreset(preset)}
                              className="text-left w-full"
                            >
                              <p className="font-medium text-gray-900 truncate">
                                {preset.name}
                                {isActive && (
                                  <span className="ml-2 text-xs font-normal text-primary-700">
                                    loaded
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Updated {formatPresetDate(preset.updatedAt || preset.createdAt)}
                              </p>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadNamedPreset(preset)}
                            className="px-2 py-1 text-xs font-medium rounded border border-primary-200 text-primary-700 hover:bg-primary-50"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateNamedPreset(preset)}
                            className="px-2 py-1 text-xs font-medium rounded border border-amber-200 text-amber-800 hover:bg-amber-50"
                            title="Overwrite this preset with current table settings"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportNamedPreset(preset)}
                            className="p-1.5 rounded text-gray-500 hover:text-primary-700 hover:bg-primary-50"
                            title={`Export as ${sanitizeSettingsFileName(preset.name)}`}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartRenamePreset(preset)}
                            className="px-2 py-1 text-xs font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNamedPreset(preset)}
                            className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

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

      {/* Column drilldown menu (fixed so table overflow does not clip it) */}
      {columnMenuOpen && (() => {
        const column = columnMenuOpen;
        const dropdownEnabled = Boolean(columnDropdownEnabled[column]);
        const selectedValues = columnDropdownValues[column] || [];
        const uniqueValues = getUniqueValues(column);
        const filteredUniqueValues = dropdownValueSearch
          ? uniqueValues.filter((value) =>
              value.toLowerCase().includes(dropdownValueSearch.toLowerCase())
            )
          : uniqueValues;
        const typeInfo = detectColumnValueType(data, column);
        const sampleRoot = findSampleValue(data, column, nestedBrowsePath);
        const nestedInfo = getKeysAtPath(sampleRoot, nestedBrowsePath);
        const activePath = columnValuePaths[column] || [];
        const browsePreview = formatResolvedValue(
          resolveByPath(sampleRoot, nestedBrowsePath)
        );
        const pathSameAsActive =
          JSON.stringify(nestedBrowsePath) === JSON.stringify(activePath);
        const typeBadgeLabel = nestedInfo.mapped
          ? `${nestedInfo.type} (mapped)`
          : nestedInfo.type;

        return (
          <div
            ref={columnMenuRef}
            className="fixed w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-[60] text-left max-h-[80vh] overflow-y-auto"
            style={{ top: columnMenuPosition.top, left: columnMenuPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {headerLabels[column] || column}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                  {typeInfo.primary}
                </span>
                {Object.entries(typeInfo.counts)
                  .filter(([type]) => type !== typeInfo.primary)
                  .slice(0, 3)
                  .map(([type, count]) => (
                    <span
                      key={type}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500"
                    >
                      {type}:{count}
                    </span>
                  ))}
              </div>
            </div>

            <div className="p-3 space-y-3 border-b border-gray-100">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Nested value
                </p>
                <span className="text-[11px] text-gray-400">
                  Level {nestedBrowsePath.length}/{MAX_NEST_DEPTH}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={() => setNestedBrowsePath([])}
                  className={`px-1.5 py-0.5 rounded ${
                    nestedBrowsePath.length === 0
                      ? 'bg-primary-100 text-primary-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  root
                </button>
                {nestedBrowsePath.map((segment, index) => (
                  <React.Fragment key={`${segment}-${index}`}>
                    <ChevronRight className="h-3 w-3 text-gray-400" />
                    <button
                      type="button"
                      onClick={() =>
                        setNestedBrowsePath(nestedBrowsePath.slice(0, index + 1))
                      }
                      className={`px-1.5 py-0.5 rounded max-w-[7rem] truncate ${
                        index === nestedBrowsePath.length - 1
                          ? 'bg-primary-100 text-primary-700'
                          : 'hover:bg-gray-100'
                      }`}
                      title={segment}
                    >
                      {segment}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                <p className="text-[11px] text-gray-500 mb-1">
                  Current type:{' '}
                  <span className="font-medium text-gray-700">{typeBadgeLabel}</span>
                </p>
                <p className="text-xs text-gray-800 break-words" title={browsePreview}>
                  {browsePreview}
                </p>
              </div>

              {nestedInfo.options.length > 0 && canGoDeeper(nestedBrowsePath) ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {nestedInfo.options.map((option) => (
                    <button
                      key={option.segment}
                      type="button"
                      onClick={() =>
                        setNestedBrowsePath([...nestedBrowsePath, option.segment])
                      }
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-800 truncate">
                          {option.label}
                        </span>
                        <span className="block text-[11px] text-gray-500 truncate">
                          {option.childType} · {option.preview}
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : nestedInfo.type === 'object' || nestedInfo.type === 'array' ? (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                  Max {MAX_NEST_DEPTH} levels reached. Set this as root or go back.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setColumnRootPath(column, nestedBrowsePath)}
                  disabled={pathSameAsActive}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <CornerDownRight className="h-3.5 w-3.5" />
                  Set as root
                </button>
                {nestedBrowsePath.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setNestedBrowsePath(nestedBrowsePath.slice(0, -1))
                    }
                    className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    Back
                  </button>
                )}
                {activePath.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearColumnRootPath(column)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-md text-red-600 hover:bg-red-50"
                  >
                    Reset root
                  </button>
                )}
              </div>

              {activePath.length > 0 && (
                <p className="text-[11px] text-primary-700 bg-primary-50 rounded px-2 py-1.5">
                  Showing: {pathToLabel(column, activePath)}
                </p>
              )}
            </div>

            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={filters[column] || ''}
                    onChange={(e) => handleFilterChange(column, e.target.value)}
                    placeholder="Type to filter..."
                    className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      filters[column]
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dropdownEnabled}
                  onChange={() => toggleColumnDropdownMode(column)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>Use as dropdown</span>
              </label>

              {dropdownEnabled && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <input
                      type="text"
                      value={dropdownValueSearch}
                      onChange={(e) => setDropdownValueSearch(e.target.value)}
                      placeholder="Search values..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredUniqueValues.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500">No values found</p>
                    ) : (
                      filteredUniqueValues.map((value) => {
                        const selected = selectedValues.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleDropdownValue(column, value)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                              selected ? 'bg-primary-50 text-primary-800' : 'text-gray-700'
                            }`}
                          >
                            <span className="truncate" title={value}>
                              {value || '(empty)'}
                            </span>
                            {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {selectedValues.length > 0 && (
                    <div className="px-3 py-2 border-t border-gray-100 text-xs text-primary-700 bg-primary-50">
                      {selectedValues.length} selected
                    </div>
                  )}
                </div>
              )}

              {(filters[column] || selectedValues.length > 0) && (
                <button
                  type="button"
                  onClick={() => clearColumnFilter(column)}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear this column filter
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {displayColumnsList.map(column => {
                const columnActive = isColumnFilterActive(column);

                return (
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate">{headerLabels[column] || column}</span>
                      {(columnValuePaths[column] || []).length > 0 && (
                        <span className="block text-[10px] font-normal text-primary-600 truncate">
                          {pathToLabel(column, columnValuePaths[column])}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
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

                      {/* Column drilldown menu trigger */}
                      <button
                        type="button"
                        onClick={(e) => toggleColumnMenu(column, e)}
                        className={`p-1 rounded transition-colors duration-200 ${
                          columnActive || columnMenuOpen === column
                            ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-300'
                        }`}
                        title="Column options"
                      >
                        <ListFilter className="h-4 w-4" />
                      </button>
                      
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
              );
              })}
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
                      <div className="max-w-xs truncate" title={getCellText(row, column)}>
                        {getCellText(row, column)}
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
              ({data.length} total
              {Object.values(filters).some((f) => f) ||
              Object.values(columnDropdownValues).some((v) => v?.length) ||
              searchTerm
                ? ', filtered'
                : ''}
              )
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
