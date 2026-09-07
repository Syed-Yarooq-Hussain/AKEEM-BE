import { renderReportHtml, renderReportPdf } from './report-renderer';

describe('report renderer', () => {
  it('renders escaped HTML rather than returning Markdown with an HTML label', () => {
    const html = renderReportHtml(
      'Quarterly <Review>',
      '# Result\n\n**Safe** <script>',
    );
    expect(html).toContain('<h1>Result</h1>');
    expect(html).toContain('<strong>Safe</strong> &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('produces a real PDF document', async () => {
    const pdf = await renderReportPdf(
      'Quarterly Review',
      '# Result\n\nRevenue improved.',
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
