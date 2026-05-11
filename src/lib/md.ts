// Minimal markdown-to-HTML for short overlay strings (incentive_map,
// circularity_notes). Handles paragraphs, **bold**, *italic*, and inline
// `code`. If overlays grow richer, swap in a real markdown library.

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(s: string): string {
  let out = escape(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|\s)\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

export function mdToHtml(input: string): string {
  if (!input) return '';
  const paragraphs = input.trim().split(/\n\s*\n/);
  return paragraphs.map((p) => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('\n');
}
