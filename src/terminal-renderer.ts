/**
 * Terminal Renderer
 * Renders terminal state with cursor and fixed dimensions
 */

import { parseAnsi, type ParsedLine, type TextSpan, type RGB, darkTheme, type Theme } from 'shellfie';

export interface TerminalState {
  lines: string[];
  cursorX: number;
  cursorY: number;
  width: number;  // pixels
  height: number; // pixels
  fontSize: number;
  fontFamily: string;
  showCursor: boolean;
}

export interface RenderOptions {
  title?: string;
  template?: 'macos' | 'windows' | 'minimal';
  theme?: Theme;
  padding?: number;
}

/**
 * Render terminal state as SVG
 */
export function renderTerminalSVG(state: TerminalState, options: RenderOptions = {}): string {
  const {
    lines,
    cursorX,
    cursorY,
    width,
    height,
    fontSize,
    fontFamily = "'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace",
    showCursor,
  } = state;

  const padding = options.padding || 16;
  const headerHeight = options.template === 'minimal' ? 0 : 39;
  const lineHeight = fontSize * 1.4;

  // Calculate character width (monospace approximation)
  const charWidth = fontSize * 0.6;

  // Use provided theme or default to dark theme
  const theme = options.theme || darkTheme;

  // Background and chrome
  const bgColor = theme.background;
  const textColor = theme.foreground;
  const cursorColor = theme.cursor;

  const svgWidth = width;
  const svgHeight = height;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

  // Add styles
  svg += `
  <style>
    .cursor {
      animation: blink 1s step-end infinite;
    }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      50.01%, 100% { opacity: 0; }
    }
  </style>`;

  // Background
  svg += `
  <rect width="${svgWidth}" height="${svgHeight}" fill="${bgColor}" rx="10" ry="10"/>`;

  // Header (if not minimal)
  if (options.template !== 'minimal') {
    svg += `
  <g class="title-bar">
    <rect width="${svgWidth}" height="${headerHeight}" fill="${bgColor}" rx="10" ry="10"/>
    <rect y="29" width="${svgWidth}" height="10" fill="${bgColor}"/>
    <line x1="0" y1="39.5" x2="${svgWidth}" y2="39.5" stroke="#d4d4d41a" stroke-width="1"/>
    <circle cx="16" cy="19.5" r="6" fill="#ff5f56"/>
    <circle cx="36" cy="19.5" r="6" fill="#ffbd2e"/>
    <circle cx="56" cy="19.5" r="6" fill="#27c93f"/>`;

    if (options.title) {
      svg += `
    <text x="${svgWidth / 2}" y="24.2" fill="${textColor}" font-family="${fontFamily}" font-size="12" text-anchor="middle" opacity="0.8">${escapeXml(options.title)}</text>`;
    }

    svg += `
  </g>`;
  }

  // Content area
  const contentY = headerHeight + padding;
  svg += `
  <g class="content">`;

  // Render lines with ANSI color support
  lines.forEach((line, i) => {
    const y = contentY + (i * lineHeight) + fontSize;
    if (line) {
      // Parse ANSI codes
      const parsedLines = parseAnsi(line);
      if (parsedLines.length > 0 && parsedLines[0].spans.length > 0) {
        let xOffset = padding;
        parsedLines[0].spans.forEach((span) => {
          const color = resolveColor(span.style.foreground, theme);
          const escapedText = escapeXml(span.text);

          // Build style attributes
          let styleAttr = '';
          if (span.style.bold) styleAttr += ' font-weight="bold"';
          if (span.style.italic) styleAttr += ' font-style="italic"';
          if (span.style.underline) styleAttr += ' text-decoration="underline"';

          svg += `
    <text x="${xOffset}" y="${y}" fill="${color}" font-family="${fontFamily}" font-size="${fontSize}"${styleAttr} xml:space="preserve">${escapedText}</text>`;

          // Update x offset for next span
          xOffset += span.text.length * charWidth;
        });
      }
    }
  });

  // Render cursor
  if (showCursor) {
    const cursorXPos = padding + (cursorX * charWidth);
    const cursorYPos = contentY + (cursorY * lineHeight);
    svg += `
    <rect class="cursor" x="${cursorXPos}" y="${cursorYPos}" width="${charWidth}" height="${lineHeight}" fill="${cursorColor}" opacity="0.7"/>`;
  }

  svg += `
  </g>
</svg>`;

  return svg;
}

/**
 * Resolve ANSI color to hex
 */
function resolveColor(color: string | RGB | undefined, theme: Theme): string {
  if (!color) return theme.foreground;

  // Handle RGB objects
  if (typeof color === 'object') {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  // Handle ANSI color names
  const colorMap: Record<string, keyof Theme> = {
    ansi0: 'black',
    ansi1: 'red',
    ansi2: 'green',
    ansi3: 'yellow',
    ansi4: 'blue',
    ansi5: 'magenta',
    ansi6: 'cyan',
    ansi7: 'white',
    ansi8: 'brightBlack',
    ansi9: 'brightRed',
    ansi10: 'brightGreen',
    ansi11: 'brightYellow',
    ansi12: 'brightBlue',
    ansi13: 'brightMagenta',
    ansi14: 'brightCyan',
    ansi15: 'brightWhite',
  };

  const themeKey = colorMap[color];
  if (themeKey) {
    return theme[themeKey] as string;
  }

  // Already a hex color
  return color;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Create terminal state from text buffer
 */
export function createTerminalState(
  buffer: string,
  cursorX: number,
  cursorY: number,
  width: number,
  height: number,
  fontSize: number,
  showCursor: boolean = true
): TerminalState {
  const lines = buffer.split('\n');

  return {
    lines,
    cursorX,
    cursorY,
    width,
    height,
    fontSize,
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace",
    showCursor,
  };
}
