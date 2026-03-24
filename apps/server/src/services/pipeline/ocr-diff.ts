import type { OcrResult, OcrDiffResult } from './types';

// Normalize OCR text for comparison
export function normalizeOcrText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')           // normalize line endings
    .replace(/[ \t]+/g, ' ')          // collapse whitespace
    .replace(/\n{3,}/g, '\n\n')       // collapse multiple blank lines
    .replace(/---PAGE BREAK---/g, '') // remove page markers
    .trim();
}

// Split text into pages if page breaks exist
function splitPages(text: string): string[] {
  const parts = text.split(/---PAGE BREAK---/);
  return parts.map(p => normalizeOcrText(p)).filter(p => p.length > 0);
}

// Simple character-level similarity (Jaccard-like) using trigrams
function textSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Use character trigrams for comparison
  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();
  for (let i = 0; i <= a.length - 3; i++) trigramsA.add(a.substring(i, i + 3));
  for (let i = 0; i <= b.length - 3; i++) trigramsB.add(b.substring(i, i + 3));

  let intersection = 0;
  for (const t of trigramsA) if (trigramsB.has(t)) intersection++;
  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export function diffOcrResults(a: OcrResult, b: OcrResult, threshold: number = 0.05): OcrDiffResult {
  // Compare whole-document text (normalized) rather than page-level,
  // because Gemini returns one flat text without page breaks while Mistral
  // returns per-page. Page-level comparison would produce false mismatches.
  const textA = normalizeOcrText(a.text);
  const textB = normalizeOcrText(b.text);

  const agreementScore = textSimilarity(textA, textB);

  // Also do page-level comparison if BOTH engines provide page splits
  const mismatchPages: number[] = [];
  if (a.pageTexts?.length && b.pageTexts?.length) {
    const maxPages = Math.max(a.pageTexts.length, b.pageTexts.length);
    for (let i = 0; i < maxPages; i++) {
      const pageA = normalizeOcrText(a.pageTexts[i] || '');
      const pageB = normalizeOcrText(b.pageTexts[i] || '');
      const sim = textSimilarity(pageA, pageB);
      if (sim < (1 - threshold)) {
        mismatchPages.push(i + 1);
      }
    }
  }

  // Use the configured threshold to determine if review is needed
  // threshold=0.05 means we tolerate up to 5% disagreement (agreementScore >= 0.95)
  const needsReview = agreementScore < (1 - threshold);

  // Choose engine: use Mistral by default (higher accuracy baseline),
  // but if Mistral text is significantly shorter (possibly truncated), prefer Gemini
  let chosenEngine: 'mistral' | 'gemini' = 'mistral';
  let reason: string;

  if (textA.length > 0 && textB.length > 0 && textA.length < textB.length * 0.5) {
    chosenEngine = 'gemini';
    reason = `Mistral output significantly shorter than Gemini (${textA.length} vs ${textB.length} chars) — using Gemini.`;
  } else if (needsReview) {
    reason = `Agreement score ${(agreementScore * 100).toFixed(1)}% below 95% threshold. ${mismatchPages.length} page(s) with differences. Using Mistral (higher accuracy baseline).`;
  } else {
    reason = `Agreement score ${(agreementScore * 100).toFixed(1)}% — engines agree. Using Mistral.`;
  }

  return {
    agreementScore,
    mismatchPages,
    chosenEngine,
    reason,
    needsReview,
  };
}
