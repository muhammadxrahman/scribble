import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportToPDF(title: string, content: string) {
  // Create a temporary container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '210mm'; // A4 width
  container.style.padding = '20mm';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.fontSize = '12pt';
  container.style.lineHeight = '1.6';
  container.style.color = '#000';
  
  // Add title
  const titleElement = document.createElement('h1');
  titleElement.textContent = title;
  titleElement.style.fontSize = '24pt';
  titleElement.style.marginBottom = '20px';
  titleElement.style.color = '#000';
  container.appendChild(titleElement);
  
  // Add content
  const contentElement = document.createElement('div');
  contentElement.innerHTML = content;
  contentElement.style.color = '#000';
  container.appendChild(contentElement);
  
  document.body.appendChild(container);
  
  try {
    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
    
    // Download
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export function printDocument(title: string, content: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            padding: 20mm;
          }
          h1 { font-size: 24pt; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${content}
      </body>
    </html>
  `);
  
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
}