import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { cleanHtmlForAnalysis } from '../htmlCleaner';

describe('cleanHtmlForAnalysis', () => {
  it('strips script and style tags', () => {
    const html = `
      <html><body>
        <script>var x = 1;</script>
        <style>.foo { color: red; }</style>
        <p>Hello World</p>
      </body></html>
    `;
    const result = cleanHtmlForAnalysis(html);
    expect(result.cleanedText).toContain('Hello World');
    expect(result.cleanedText).not.toContain('var x = 1');
    expect(result.cleanedText).not.toContain('.foo');
  });

  it('strips nav, header, and footer tags', () => {
    const html = `
      <html><body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <header><h1>Site Header</h1></header>
        <main><p>Happy Hour 3-6pm $5 margaritas</p></main>
        <footer><p>Copyright 2026</p></footer>
      </body></html>
    `;
    const result = cleanHtmlForAnalysis(html);
    expect(result.cleanedText).toContain('Happy Hour');
    expect(result.cleanedText).toContain('$5 margaritas');
    expect(result.cleanedText).not.toContain('Home');
    expect(result.cleanedText).not.toContain('Site Header');
    expect(result.cleanedText).not.toContain('Copyright');
  });

  it('removes hidden elements', () => {
    const html = `
      <html><body>
        <div style="display: none">Hidden content</div>
        <div style="display:none">Also hidden</div>
        <div aria-hidden="true">Screen reader hidden</div>
        <p>Visible content</p>
      </body></html>
    `;
    const result = cleanHtmlForAnalysis(html);
    expect(result.cleanedText).toContain('Visible content');
    expect(result.cleanedText).not.toContain('Hidden content');
    expect(result.cleanedText).not.toContain('Also hidden');
    expect(result.cleanedText).not.toContain('Screen reader hidden');
  });

  it('extracts text from <main> when available', () => {
    const html = `
      <html><body>
        <div class="sidebar">Sidebar stuff</div>
        <main>
          <h2>Happy Hour</h2>
          <p>Mon-Fri 3-6pm</p>
        </main>
        <div class="ads">Buy stuff</div>
      </body></html>
    `;
    const result = cleanHtmlForAnalysis(html);
    expect(result.cleanedText).toContain('Happy Hour');
    expect(result.cleanedText).toContain('Mon-Fri 3-6pm');
  });

  it('falls back to body when no semantic container found', () => {
    const html = `
      <html><body>
        <div><p>Some deal info here</p></div>
      </body></html>
    `;
    const result = cleanHtmlForAnalysis(html);
    expect(result.cleanedText).toContain('Some deal info here');
  });

  it('collapses whitespace and empty lines', () => {
    const html = `
      <html><body>
        <p>Line one</p>


        <p>Line two</p>
        <p>  Lots   of   spaces  </p>
      </body></html>
    `;
    const result = cleanHtmlForAnalysis(html);
    expect(result.cleanedText).not.toMatch(/  +/); // No double spaces
    expect(result.cleanedText).not.toMatch(/\n\s*\n/); // No blank lines
  });

  it('truncates content to max length', () => {
    const longContent = 'A'.repeat(500);
    const html = `<html><body><p>${longContent}</p></body></html>`;
    const result = cleanHtmlForAnalysis(html, 100);
    expect(result.cleanedText.length).toBe(100);
    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBeGreaterThan(100);
  });

  it('does not truncate short content', () => {
    const html = `<html><body><p>Short text</p></body></html>`;
    const result = cleanHtmlForAnalysis(html);
    expect(result.truncated).toBe(false);
    expect(result.cleanedText).toContain('Short text');
  });

  it('handles empty HTML', () => {
    const result = cleanHtmlForAnalysis('');
    expect(result.cleanedText).toBe('');
    expect(result.originalLength).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('strips noscript and iframe tags', () => {
    const html = `
      <html><body>
        <noscript>Enable JS</noscript>
        <iframe src="ad.html">Ad content</iframe>
        <p>Real content</p>
      </body></html>
    `;
    const result = cleanHtmlForAnalysis(html);
    expect(result.cleanedText).toContain('Real content');
    expect(result.cleanedText).not.toContain('Enable JS');
    expect(result.cleanedText).not.toContain('Ad content');
  });
});
