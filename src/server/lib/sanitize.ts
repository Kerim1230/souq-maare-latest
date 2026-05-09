/**
 * Input sanitization for string fields.
 * Trims whitespace, limits length, removes null bytes, strips HTML tags.
 * Optionally escapes HTML entities for contexts requiring safe HTML output.
 */
export function sanitizeString(input: unknown, maxLength: number = 1000, escapeEntities: boolean = false): string {
  if (typeof input !== 'string') return '';
  let result = input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/<[^>]*>/g, '') // Strip HTML/XML tags to prevent XSS
    .trim()
    .slice(0, maxLength);

  if (escapeEntities) {
    result = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  return result;
}
