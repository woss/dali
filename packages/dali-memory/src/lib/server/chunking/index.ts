export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
  minChunkSize?: number;
}

export interface ChunkResult {
  text: string;
  chunkIndex: number;
  section: string;
}

const DEFAULTS: Required<ChunkOptions> = {
  maxChunkSize: 1500,
  overlap: 80,
  minChunkSize: 100,
};

// ---------------------------------------------------------------------------
// Sentence split helper – preserves trailing period on each non-final segment
// ---------------------------------------------------------------------------

function splitSentences(text: string): string[] {
  const parts = text.split('. ');
  if (parts.length <= 1) return [text];
  const result: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    result.push(parts[i] + '.');
  }
  // Last part keeps its original form (may or may not end with a period)
  result.push(parts[parts.length - 1]);
  return result;
}

// ---------------------------------------------------------------------------
// Recursive hierarchical splitting
// ---------------------------------------------------------------------------

/**
 * Split text using a hierarchy of separators:
 *   0 – paragraph  (`\n\n`)
 *   1 – line       (`\n`)
 *   2 – sentence   (`. `)
 *   3 – word       (whitespace)
 *
 * Segments larger than `maxSize` are recursively split at the next finer
 * level.  A level that does not meaningfully split the text (≤ 1 non-empty
 * part) falls through to the next level immediately.
 */
function splitText(text: string, maxSize: number, level = 0): string[] {
  if (text.length <= maxSize || level > 3) return [text];

  let parts: string[];
  let nextLevel: number;

  switch (level) {
    case 0:
      parts = text.split(/\n\s*\n/);
      nextLevel = 1;
      break;
    case 1:
      parts = text.split('\n');
      nextLevel = 2;
      break;
    case 2:
      parts = splitSentences(text);
      nextLevel = 3;
      break;
    case 3:
      parts = text.split(/\s+/);
      nextLevel = 4;
      break;
    default:
      return [text];
  }

  const nonEmpty = parts.filter((p) => p.trim().length > 0);

  // Separator didn't split into multiple pieces – try next level
  if (nonEmpty.length <= 1) {
    return splitText(text, maxSize, nextLevel);
  }

  const result: string[] = [];
  for (const part of nonEmpty) {
    if (part.length > maxSize && nextLevel <= 3) {
      result.push(...splitText(part, maxSize, nextLevel));
    } else {
      result.push(part);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Heading detection
// ---------------------------------------------------------------------------

/**
 * Check whether `text` starts with a markdown heading (`# `, `## `, `### `).
 * Returns the heading text (without markers) or `null`.
 */
function detectHeading(text: string): string | null {
  const firstLine = text.split('\n')[0].trim();
  const match = firstLine.match(/^(#{1,6})\s+(.+)/);
  return match ? match[2].trim() : null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Split long content into overlapping chunks that fit within a token-limit
 * budget for embedding, preserving section-context metadata from markdown
 * headings.
 *
 * The splitting hierarchy is:
 *   paragraph → line → sentence → word
 *
 * Each level is tried in order; segments that still exceed `maxChunkSize`
 * are split at the next finer level.
 */
export function chunkContent(content: string, options?: ChunkOptions): ChunkResult[] {
  const opts: Required<ChunkOptions> = { ...DEFAULTS, ...options };

  // -----------------------------------------------------------------------
  // Step 1 – Recursive hierarchical split
  // -----------------------------------------------------------------------
  const segments = splitText(content, opts.maxChunkSize);
  if (segments.length === 0) return [];

  // -----------------------------------------------------------------------
  // Step 2 – Assign section metadata from markdown headings
  // -----------------------------------------------------------------------
  interface SegmentInfo {
    text: string;
    section: string;
  }

  let currentSection = '';
  const infos: SegmentInfo[] = [];

  for (const seg of segments) {
    const heading = detectHeading(seg);
    if (heading !== null) {
      currentSection = heading;
    }
    infos.push({ text: seg, section: currentSection });
  }

  // -----------------------------------------------------------------------
  // Step 3 – Build chunks by accumulating segments up to maxChunkSize
  // -----------------------------------------------------------------------
  const rawChunks: SegmentInfo[] = [];
  let acc = '';
  let accSection = '';

  for (const info of infos) {
    if (acc.length === 0) {
      acc = info.text;
      accSection = info.section;
    } else if (acc.length + info.text.length + 1 <= opts.maxChunkSize) {
      acc += ' ' + info.text;
      accSection = info.section;
    } else {
      rawChunks.push({ text: acc, section: accSection });
      acc = info.text;
      accSection = info.section;
    }
  }
  if (acc.length > 0) {
    rawChunks.push({ text: acc, section: accSection });
  }

  // -----------------------------------------------------------------------
  // Step 4 – Apply overlap between consecutive chunks
  // -----------------------------------------------------------------------
  if (opts.overlap > 0 && rawChunks.length > 1) {
    for (let i = 1; i < rawChunks.length; i++) {
      const prevText = rawChunks[i - 1].text;
      const actualOverlap = Math.min(opts.overlap, prevText.length);
      rawChunks[i].text = prevText.slice(-actualOverlap).trimEnd() + ' ' + rawChunks[i].text;
    }
  }

  // -----------------------------------------------------------------------
  // Step 5 – Merge chunks smaller than minChunkSize into previous chunk
  // -----------------------------------------------------------------------
  const merged: SegmentInfo[] = [];
  for (const chunk of rawChunks) {
    if (merged.length > 0 && chunk.text.length < opts.minChunkSize) {
      merged[merged.length - 1].text += ' ' + chunk.text;
    } else {
      merged.push({ ...chunk });
    }
  }

  // -----------------------------------------------------------------------
  // Step 6 – Trim whitespace, skip empty, build results
  // -----------------------------------------------------------------------
  const results: ChunkResult[] = [];
  for (let i = 0; i < merged.length; i++) {
    const trimmed = merged[i].text.trim();
    if (trimmed.length === 0) continue;
    results.push({
      text: trimmed,
      chunkIndex: i,
      section: merged[i].section,
    });
  }

  return results;
}
