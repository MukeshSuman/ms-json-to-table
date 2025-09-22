# JSON to List Converter

A modern web application for converting JSON data to interactive tables with advanced features and export capabilities.

## Features

### Table Features

- **Column Management**: Show/hide columns with easy toggle controls
- **Sorting**: Click column headers to sort data (ascending/descending)
- **Filtering**: Individual column filters and global search
- **Responsive Design**: Works on desktop and mobile devices

### Export Capabilities

- **Excel Export**: Export data to .xlsx format with customizable settings
- **PDF Export**: Export table data only (not full page) with advanced customization:
  - Add extra columns with custom headings
  - Add extra empty rows
  - Set minimum row height
  - Professional styling with alternating row colors

### Data Handling

- **JSON Upload**: Drag & drop or browse to upload JSON files
- **Data Validation**: Ensures JSON contains array of objects
- **Error Handling**: Clear error messages for invalid files

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd json-to-list-excel-pdf
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Building for Production

```bash
npm run build
```

This builds the app for production to the `build` folder.

## Usage

1. **Upload JSON File**: Drag and drop a JSON file or click to browse
2. **Configure Table**: Use the column settings to show/hide columns
3. **Filter & Sort**: Use search and column filters to find specific data
4. **Export Data**: Choose Excel or PDF export with customization options

## JSON Format

The application expects JSON files containing an array of objects:

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "department": "Engineering"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "department": "Marketing"
  }
]
```

## Export Settings

### PDF Export Customization

- **Extra Columns**: Add additional columns with custom headings
- **Extra Rows**: Add empty rows for manual data entry
- **Row Height**: Set minimum row height for better readability
- **Styling**: Professional blue headers with alternating row colors

### Excel Export Options

- **Headers**: Include or exclude column headers
- **Auto Width**: Automatically adjust column widths
- **Formatting**: Clean, professional formatting

## Technologies Used

- **React**: Frontend framework
- **Tailwind CSS**: Styling and responsive design
- **XLSX**: Excel file generation
- **jsPDF**: PDF generation
- **Lucide React**: Icons

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License
