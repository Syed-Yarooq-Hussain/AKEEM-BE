import PDFDocument = require('pdfkit');

export function renderReportHtml(title: string, markdown: string): string {
  const lines = String(markdown || '').split(/\r?\n/);
  const body: string[] = [];
  let listOpen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      if (!listOpen) {
        body.push('<ul>');
        listOpen = true;
      }
      body.push(`<li>${inlineMarkup(listItem[1])}</li>`);
      continue;
    }
    if (listOpen) {
      body.push('</ul>');
      listOpen = false;
    }
    if (!line) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      body.push(`<h${level}>${inlineMarkup(heading[2])}</h${level}>`);
    } else {
      body.push(`<p>${inlineMarkup(line)}</p>`);
    }
  }
  if (listOpen) body.push('</ul>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;max-width:860px;margin:48px auto;padding:0 24px;color:#172033;line-height:1.6}
    h1,h2,h3{color:#0a0e1a;line-height:1.25;margin-top:1.5em}h1{font-size:30px}h2{font-size:22px}h3{font-size:18px}
    p,li{font-size:14px}ul{padding-left:24px}strong{font-weight:700}code{background:#f1f5f9;padding:2px 5px;border-radius:4px}
  </style>
</head>
<body>${body.join('\n')}</body>
</html>`;
}

export async function renderReportPdf(
  title: string,
  markdown: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margin: 54,
      info: { Title: title, Creator: 'NexusFlow OS' },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.font('Helvetica-Bold').fontSize(20).text(title);
    document.moveDown(0.8);
    for (const rawLine of String(markdown || '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        document.moveDown(0.5);
        continue;
      }
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        const sizes = [18, 15, 13];
        document
          .moveDown(0.4)
          .font('Helvetica-Bold')
          .fontSize(sizes[heading[1].length - 1])
          .text(stripMarkup(heading[2]));
      } else if (/^[-*]\s+/.test(line)) {
        document
          .font('Helvetica')
          .fontSize(10.5)
          .text(`• ${stripMarkup(line.replace(/^[-*]\s+/, ''))}`, {
            indent: 12,
          });
      } else {
        document
          .font('Helvetica')
          .fontSize(10.5)
          .text(stripMarkup(line), { paragraphGap: 5 });
      }
    }
    document.end();
  });
}

function inlineMarkup(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function stripMarkup(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
