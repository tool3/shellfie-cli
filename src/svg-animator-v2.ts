/**
 * SVG Animator V2
 * Combines pre-rendered terminal SVGs into animated SVG
 */

import type { TerminalFrame } from './dvd-executor-v2';

export interface AnimationOptions {
  fps?: number;
  loop?: boolean;
  pauseAtEnd?: number;
}

/**
 * Extract SVG body content (everything inside <svg>)
 */
function extractSVGBody(svg: string, frameId: string): string {
  const contentMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!contentMatch) return '';

  let content = contentMatch[1];

  // Make IDs unique
  content = content
    .replace(/id="([^"]*)"/g, `id="$1-${frameId}"`)
    .replace(/url\(#([^)]*)\)/g, `url(#$1-${frameId})`)
    .replace(/class="([^"]*)"/g, `class="$1 ${frameId}"`);

  return content;
}

/**
 * Get SVG dimensions from first frame
 */
function getSVGDimensions(svg: string): { width: number; height: number } {
  const widthMatch = svg.match(/width="(\d+)"/);
  const heightMatch = svg.match(/height="(\d+)"/);

  return {
    width: widthMatch ? parseInt(widthMatch[1], 10) : 800,
    height: heightMatch ? parseInt(heightMatch[1], 10) : 600,
  };
}

/**
 * Create CSS keyframes for animation
 */
function createKeyframes(frames: TerminalFrame[]): string {
  if (frames.length === 0) return '';

  const totalDuration = frames[frames.length - 1].timestamp;
  let css = '';

  frames.forEach((frame, i) => {
    const startPercent = i === 0 ? 0 : (frames[i - 1].timestamp / totalDuration) * 100;
    const endPercent = (frame.timestamp / totalDuration) * 100;
    const nextPercent = i < frames.length - 1
      ? (frames[i + 1].timestamp / totalDuration) * 100
      : 100;

    css += `
    @keyframes frame-${i}-anim {
      0% { opacity: 0; }
      ${startPercent.toFixed(2)}% { opacity: 0; }
      ${endPercent.toFixed(2)}% { opacity: 1; }
      ${nextPercent.toFixed(2)}% { opacity: 1; }
      ${(nextPercent + 0.01).toFixed(2)}% { opacity: 0; }
      100% { opacity: 0; }
    }`;
  });

  // First frame special case
  const firstEnd = (frames[1]?.timestamp / totalDuration) * 100 || 100;
  css = `
    @keyframes frame-0-anim {
      0% { opacity: 1; }
      ${firstEnd.toFixed(2)}% { opacity: 1; }
      ${(firstEnd + 0.01).toFixed(2)}% { opacity: 0; }
      100% { opacity: 0; }
    }` + css.substring(css.indexOf('@keyframes frame-1-anim'));

  return css;
}

/**
 * Create animated SVG from frames
 */
export async function createAnimatedSVG(
  frames: TerminalFrame[],
  options: AnimationOptions = {}
): Promise<string> {
  if (frames.length === 0) {
    throw new Error('No frames to animate');
  }

  // Get dimensions from first frame
  const { width, height } = getSVGDimensions(frames[0].svg);

  // Calculate duration
  const totalDuration = frames[frames.length - 1].timestamp;
  const pauseAtEnd = options.pauseAtEnd || 1000;
  const animationDuration = ((totalDuration + pauseAtEnd) / 1000).toFixed(2);
  const animationIterationCount = options.loop !== false ? 'infinite' : '1';

  // Create keyframes
  const keyframes = createKeyframes(frames);

  // Extract frame contents
  const frameBodies = frames.map((frame, i) => ({
    id: `frame-${i}`,
    content: extractSVGBody(frame.svg, `f${i}`),
  }));

  // Build animated SVG
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    ${keyframes}

    .frame {
      animation-duration: ${animationDuration}s;
      animation-timing-function: step-end;
      animation-iteration-count: ${animationIterationCount};
      animation-fill-mode: forwards;
    }

    ${frames.map((_, i) => `
    .frame-${i} {
      animation-name: frame-${i}-anim;
    }`).join('')}
  </style>

  <defs>
    ${frameBodies.map((frame) => `
    <g id="${frame.id}">
      ${frame.content}
    </g>`).join('')}
  </defs>

  ${frameBodies.map((frame, i) => `
  <use href="#${frame.id}" class="frame frame-${i}" />`).join('')}
</svg>`;

  return svg;
}

/**
 * Get animation metadata
 */
export function getAnimationMetadata(frames: TerminalFrame[]): {
  duration: number;
  frameCount: number;
  fps: number;
} {
  const duration = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;
  const frameCount = frames.length;
  const fps = frameCount > 1 ? frameCount / (duration / 1000) : 0;

  return {
    duration,
    frameCount,
    fps: Math.round(fps * 10) / 10,
  };
}
