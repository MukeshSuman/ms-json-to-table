import { buildExportTableDocument } from './tableExportView';

export function printTable(
  data,
  columns,
  headerLabels = {},
  valueMappings = {},
  settings = {}
) {
  const html = buildExportTableDocument(data, columns, headerLabels, valueMappings, settings);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow.document;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
    frameWindow.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 2000);
  }, 150);
}
