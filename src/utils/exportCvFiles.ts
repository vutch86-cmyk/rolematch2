import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';

/**
 * Downloads raw text content as a .txt file
 */
export function exportToTxt(text: string, filename = 'document.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parses markdown text into docx Paragraphs and TextRuns
 */
export async function exportToDocx(markdownText: string, filename = 'CV_Updated_AI.docx') {
  const lines = markdownText.split('\n');
  const children: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
      continue;
    }

    // Heading 1 (# ...)
    if (line.startsWith('# ')) {
      const headingText = line.replace(/^#\s+/, '').replace(/\*\*/g, '');
      children.push(
        new Paragraph({
          text: headingText,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // Heading 2 (## ...)
    if (line.startsWith('## ')) {
      const headingText = line.replace(/^##\s+/, '').replace(/\*\*/g, '');
      children.push(
        new Paragraph({
          text: headingText,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
        })
      );
      continue;
    }

    // Heading 3 (### ...)
    if (line.startsWith('### ')) {
      const headingText = line.replace(/^###\s+/, '').replace(/\*\*/g, '');
      children.push(
        new Paragraph({
          text: headingText,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 60 },
        })
      );
      continue;
    }

    // Bullet points (- or *)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const bulletContent = line.replace(/^[-*]\s+/, '');
      const textRuns = parseInlineFormatting(bulletContent);
      children.push(
        new Paragraph({
          children: textRuns,
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
        })
      );
      continue;
    }

    // Regular paragraph
    const textRuns = parseInlineFormatting(line);
    children.push(
      new Paragraph({
        children: textRuns,
        spacing: { before: 60, after: 60 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parses simple inline markdown bold (**text**) and italic (*text*) into docx TextRuns
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|[^*]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      runs.push(
        new TextRun({
          text: chunk.slice(2, -2),
          bold: true,
          font: 'Calibri',
          size: 22,
        })
      );
    } else if (chunk.startsWith('*') && chunk.endsWith('*')) {
      runs.push(
        new TextRun({
          text: chunk.slice(1, -1),
          italics: true,
          font: 'Calibri',
          size: 22,
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: chunk,
          font: 'Calibri',
          size: 22,
        })
      );
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, font: 'Calibri', size: 22 }));
  }

  return runs;
}

/**
 * Triggers clean print-to-PDF formatting in an isolated printable window/iframe
 */
export function exportToPdf(markdownText: string, filename = 'CV_Updated_AI.pdf') {
  // Convert basic markdown to styled HTML for print window
  const htmlContent = parseMarkdownToPrintHtml(markdownText);

  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (!printWindow) {
    alert('Vui lòng cho phép bật cửa sổ bật lên (popup) để xuất tệp PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            padding: 0;
            margin: 0;
            background: #fff;
          }
          h1 {
            font-size: 22px;
            color: #0f172a;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 6px;
            margin-top: 0;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          h2 {
            font-size: 15px;
            color: #1e40af;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-top: 16px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          h3 {
            font-size: 13px;
            color: #334155;
            margin-top: 12px;
            margin-bottom: 6px;
          }
          p {
            font-size: 12px;
            margin-top: 4px;
            margin-bottom: 8px;
          }
          ul {
            margin-top: 4px;
            margin-bottom: 8px;
            padding-left: 18px;
          }
          li {
            font-size: 11.5px;
            margin-bottom: 4px;
            color: #334155;
          }
          strong {
            color: #0f172a;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMarkdownToPrintHtml(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      return;
    }

    // Escape HTML characters to prevent XSS injection
    const safeLine = escapeHtml(trimmed);

    // Format bold text
    const formatted = safeLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    if (trimmed.startsWith('# ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h1>${formatted.replace(/^#\s+/, '')}</h1>`;
    } else if (trimmed.startsWith('## ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h2>${formatted.replace(/^##\s+/, '')}</h2>`;
    } else if (trimmed.startsWith('### ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h3>${formatted.replace(/^###\s+/, '')}</h3>`;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${formatted.replace(/^[-*]\s+/, '')}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${formatted}</p>`;
    }
  });

  if (inList) html += '</ul>';

  return html;
}
