import React, { useState, useMemo } from 'react';
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
  GripVertical
} from 'lucide-react';

const DataTable = ({ data, columns }) => {
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

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filteredData = data;

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

    // Apply sorting
    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filteredData;
  }, [data, searchTerm, filters, sortConfig]);

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
        </div>

        {/* Column Settings Panel */}
        {showColumnSettings && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">Show/Hide Columns</h3>
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
              {visibleColumnsList.map(column => (
                <th
                  key={column}
                  className="table-header cursor-pointer hover:bg-gray-200 transition-colors duration-200 relative group"
                  onClick={() => handleSort(column)}
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
            {filteredAndSortedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {visibleColumnsList.map(column => (
                  <td key={column} className="table-cell">
                    <div className="max-w-xs truncate" title={String(row[column])}>
                      {row[column] !== null && row[column] !== undefined 
                        ? String(row[column]) 
                        : '-'
                      }
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results Summary */}
      <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600">
        Showing {filteredAndSortedData.length} of {data.length} rows
        {Object.values(filters).some(f => f) && (
          <span className="ml-2 text-primary-600">(filtered)</span>
        )}
      </div>
    </div>
  );
};

export default DataTable;
