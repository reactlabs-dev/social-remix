interface OverlayInput {
  width: number;
  height: number;
  message: string;
  locale: string;
  // Optional disclaimer text to render smaller within the band
  disclaimer?: string;
  theme: { primary: string; text?: string; bg?: string };
}

export function buildOverlaySvg({ width, height, message, disclaimer, theme }: OverlayInput): string {
  // Bottom band with primary color for legibility; text in #333333 or white if needed
  const bandHeight = Math.max(140, Math.round(height * 0.2));
  const padding = 32;
  const fontSize = Math.max(30, Math.round(height * 0.045));
  const textColor = theme.text && theme.text !== 'auto' ? theme.text : getContrastingText(theme.primary || '#a13a5a');
  const primary = theme.primary || '#a13a5a';
  const bg = theme.bg || 'rgba(255,255,255,0)';
  const disclaimerText = (disclaimer || '').trim();
  const disclaimerSize = Math.max(16, Math.round(fontSize * 0.45));
  const lineHeight = 1.25;
  const contentWidth = width - padding * 2;
  const msgLines = wrapTextLines(message, contentWidth, fontSize);
  const disclaimerLines = disclaimerText ? wrapTextLines(disclaimerText, contentWidth, disclaimerSize) : [];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${bg}" />
  <rect x="0" y="${height - bandHeight}" width="${width}" height="${bandHeight}" fill="${primary}" fill-opacity="1" />
  <g font-family="Arial, sans-serif" fill="${textColor}">
    <text x="${padding}" y="${height - bandHeight + padding + fontSize}" font-size="${fontSize}" font-weight="700" stroke="#000" stroke-opacity="0.14" stroke-width="0.9" paint-order="stroke fill" style="letter-spacing:-0.3px">
      ${msgLines
        .map((line, idx) => `<tspan x="${padding}" dy="${idx === 0 ? 0 : Math.round(fontSize * lineHeight)}">${escapeHtml(line)}</tspan>`) 
        .join('')}
    </text>
    ${disclaimerLines.length > 0
      ? (() => {
          // Anchor disclaimer to bottom of band with stronger padding for visual breathing room
          const paddingBottom = Math.max(24, Math.round(fontSize * 0.5));
          const bottomY = height - paddingBottom;
          const firstLineY = bottomY - (disclaimerLines.length - 1) * Math.round(disclaimerSize * lineHeight);
          return `<text x="${padding}" y="${firstLineY}" font-size="${disclaimerSize}" font-weight="500" opacity="0.9">
            ${disclaimerLines
              .map((line, idx) => `<tspan x=\"${padding}\" dy=\"${idx === 0 ? 0 : Math.round(disclaimerSize * lineHeight)}\">${escapeHtml(line)}</tspan>`) 
              .join('')}
          </text>`
        })()
      : ''}
  </g>
</svg>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Exported helper to decide contrasting text color for a given background color
export function getContrastingText(hexColor: string, fallback: string = '#333333'): string {
  const lum = hexLuminance(hexColor || fallback);
  // If background is bright (luminance high), use dark text; otherwise white
  return lum > 0.55 ? '#333333' : '#ffffff';
}

function hexLuminance(hex: string): number {
  const m = hex.match(/#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
  if (!m) return 0.5;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Simple text wrapper for approximate line-breaking using average character width
function wrapTextLines(text: string, maxWidthPx: number, fontSizePx: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  if (words.length === 0) return lines;
  const avgCharWidth = fontSizePx * 0.55; // heuristic for Arial
  const maxChars = Math.max(8, Math.floor(maxWidthPx / avgCharWidth));
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) lines.push(current.join(' '));
    current = [];
  };
  for (const w of words) {
    if ((current.join(' ').length + (current.length ? 1 : 0) + w.length) <= maxChars) {
      current.push(w);
    } else if (w.length > maxChars) {
      // hard-break very long words
      const segments = w.match(new RegExp(`.{1,${Math.max(4, Math.floor(maxChars * 0.9))}}`, 'g')) || [w];
      for (const seg of segments) {
        if (current.length === 0) {
          current.push(seg);
          flush();
        } else {
          flush();
          current.push(seg);
          flush();
        }
      }
    } else {
      flush();
      current.push(w);
    }
  }
  flush();
  return lines;
}
