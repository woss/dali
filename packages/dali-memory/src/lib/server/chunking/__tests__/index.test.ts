import { describe, it, expect } from 'vitest';
import { chunkContent } from '../index';

describe('chunkContent', () => {
  // ---------------------------------------------------------------------------
  // 1. Short content returns single chunk
  // ---------------------------------------------------------------------------
  it('returns single chunk for short content', () => {
    const result = chunkContent('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      text: 'Hello world',
      chunkIndex: 0,
      section: '',
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Paragraph splitting
  // ---------------------------------------------------------------------------
  it('splits multiple paragraphs into separate chunks', () => {
    // Each paragraph (59-67 chars) fits within maxChunkSize (80), but no two
    // fit together (min pair is 59+1+66=126 > 80). Guarantees 3 chunks.
    const p1 = 'Paragraph one content here. It is long enough to not merge.';
    const p2 = 'Second paragraph content here. It is also long enough for chunking.';
    const p3 = 'Third paragraph content here. It is also long enough to not merge.';
    const content = [p1, p2, p3].join('\n\n');

    const result = chunkContent(content, { maxChunkSize: 80, minChunkSize: 1, overlap: 0 });
    expect(result.length).toBeGreaterThanOrEqual(3);
    const texts = result.map((c) => c.text);
    expect(texts.some((t) => t.includes('Paragraph one'))).toBe(true);
    expect(texts.some((t) => t.includes('Second paragraph'))).toBe(true);
    expect(texts.some((t) => t.includes('Third paragraph'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 3. Overlap applied between consecutive chunks
  // ---------------------------------------------------------------------------
  it('applies overlap at the start of the second chunk', () => {
    // Build content that splits into multiple chunks
    const para = 'This is a test paragraph with enough text to fill multiple chunks. ';
    const content = Array.from({ length: 40 }, (_, i) => `${para}Paragraph ${i + 1}.`).join('\n\n');

    const overlapSize = 60;
    const result = chunkContent(content, {
      maxChunkSize: 400,
      overlap: overlapSize,
      minChunkSize: 1,
    });

    expect(result.length).toBeGreaterThanOrEqual(2);

    // Chunk 2 should start with the last `overlapSize` chars of chunk 1
    const firstChunkTail = result[0].text.slice(-overlapSize).trimEnd();
    expect(result[1].text.startsWith(firstChunkTail + ' ')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. MinChunkSize merge — small chunk merged into previous chunk
  // ---------------------------------------------------------------------------
  it('merges small segments into the previous chunk when below minChunkSize', () => {
    // "X. " repeated 20 times → at sentence level this produces 20 "X." segments
    // With maxChunkSize 25: chunks of ~23 chars each + a final ~11 char chunk
    // The final chunk (11 chars) is < minChunkSize (300) so it merges into the
    // previous, while minChunkSize=0 keeps all chunks separate.
    const content = 'X. '.repeat(20);
    const resultWithMerge = chunkContent(content, {
      maxChunkSize: 25,
      minChunkSize: 300,
      overlap: 0,
    });
    const resultWithoutMerge = chunkContent(content, {
      maxChunkSize: 25,
      minChunkSize: 0,
      overlap: 0,
    });

    expect(resultWithMerge.length).toBeLessThan(resultWithoutMerge.length);
    // The merged result should still contain all the letters
    expect(resultWithMerge.some((c) => c.text.includes('X'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 5. Heading detection — h1
  // ---------------------------------------------------------------------------
  it('detects h1 heading and assigns section metadata', () => {
    const content = '# My Heading\n\nSome content under the heading.';
    const result = chunkContent(content, { maxChunkSize: 200, minChunkSize: 1, overlap: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('My Heading');
  });

  // ---------------------------------------------------------------------------
  // 6. Nested headings — h2
  // ---------------------------------------------------------------------------
  it('detects h2 heading as section', () => {
    const content = '## Sub Section\n\nContent under the sub section.';
    const result = chunkContent(content, { maxChunkSize: 200, minChunkSize: 1, overlap: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('Sub Section');
  });

  // ---------------------------------------------------------------------------
  // 7. h4-h6 headings
  // ---------------------------------------------------------------------------
  it.each([
    ['####', 'Deep Heading'],
    ['#####', 'Deeper Heading'],
    ['######', 'Deepest Heading'],
  ])('detects %s heading as section', (marker, headingText) => {
    const content = `${marker} ${headingText}\n\nContent under ${marker}.`;
    const result = chunkContent(content, { maxChunkSize: 200, minChunkSize: 1, overlap: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe(headingText);
  });

  // ---------------------------------------------------------------------------
  // 8. Section propagation — subsequent chunks inherit the heading
  // ---------------------------------------------------------------------------
  it('propagates section to subsequent chunks after a heading', () => {
    const p1 = 'A. '.repeat(60); // ~180 chars — under heading
    const p2 = 'B. '.repeat(60); // ~180 chars — also under same heading
    const content = `# Persisting Section\n\n${p1}\n\n${p2}`;
    const result = chunkContent(content, { maxChunkSize: 400, minChunkSize: 1, overlap: 0 });

    // Both chunks should inherit the section
    for (const chunk of result) {
      expect(chunk.section).toBe('Persisting Section');
    }
  });

  // ---------------------------------------------------------------------------
  // 9. Empty content
  // ---------------------------------------------------------------------------
  it('returns empty array for empty content', () => {
    const result = chunkContent('');
    expect(result).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // 10. Custom options — maxChunkSize and overlap produce expected sizes
  // ---------------------------------------------------------------------------
  it('respects custom maxChunkSize and overlap options', () => {
    const content = 'word '.repeat(200); // ~1000 chars
    const result = chunkContent(content, {
      maxChunkSize: 100,
      overlap: 20,
      minChunkSize: 1,
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    // Each chunk (except first) has overlap prepended, so may exceed maxChunkSize
    expect(result[0].text.length).toBeLessThanOrEqual(100);
    // Overlap tail from previous chunk should appear near the start of the next chunk
    for (let i = 1; i < result.length; i++) {
      const overlapText = result[i - 1].text.slice(-20).trim();
      // The overlap text (non-empty) should be present near the start of chunk i
      if (overlapText.length > 0) {
        // Check that overlapText appears within first N chars of next chunk
        const head = result[i].text.slice(0, overlapText.length + 40);
        expect(head).toContain(overlapText);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 11. Whitespace-only content
  // ---------------------------------------------------------------------------
  it('returns empty array for whitespace-only content', () => {
    const result = chunkContent('   \n\n  \t  ');
    expect(result).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Edge: content exactly at maxChunkSize (no splitting needed)
  // ---------------------------------------------------------------------------
  it('returns single chunk when content equals maxChunkSize', () => {
    const content = 'a'.repeat(1500);
    const result = chunkContent(content, { maxChunkSize: 1500, overlap: 0, minChunkSize: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(content);
  });

  // ---------------------------------------------------------------------------
  // Edge: content just over maxChunkSize (should split)
  // ---------------------------------------------------------------------------
  it('splits when content slightly exceeds maxChunkSize', () => {
    const para1 = 'a'.repeat(800);
    const para2 = 'b'.repeat(800);
    const content = `${para1}\n\n${para2}`;
    const result = chunkContent(content, { maxChunkSize: 1000, overlap: 0, minChunkSize: 1 });
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // Edge: Unicode and special characters
  // ---------------------------------------------------------------------------
  it('handles unicode content correctly', () => {
    const content = '# 日本語\n\nこれは日本語のテキストです。\n\n別の段落。';
    const result = chunkContent(content, { maxChunkSize: 200, minChunkSize: 1, overlap: 0 });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].section).toBe('日本語');
    expect(result.some((c) => c.text.includes('日本語'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Property: chunkIndex is always sequential starting at 0
  // ---------------------------------------------------------------------------
  it('assigns sequential chunkIndex values starting at 0', () => {
    const content = Array.from({ length: 20 }, (_, i) => `Paragraph ${i}. `).join('\n\n');
    const result = chunkContent(content, { maxChunkSize: 150, minChunkSize: 1, overlap: 0 });
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].chunkIndex).toBe(i);
    }
  });
});
