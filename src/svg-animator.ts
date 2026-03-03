/**
 * SVG Animator
 * Converts terminal frames into animated SVG using CSS animations
 * Zero dependencies - pure SVG/CSS animations
 */

import { shellfieAsync, type shellfieOptions } from 'shellfie';
import type { TerminalFrame } from './dvd-executor';

export interface AnimationOptions extends shellfieOptions {
  fps?: number;
  loop?: boolean;
  pauseAtEnd?: number;
}

/**
 * Generate individual SVG frames from terminal output
 */
const generateFrameSVG = async (
  output: string,
  options: shellfieOptions
): Promise<string> => {
  // If output is empty, use a single space to avoid issues
  const content = output || ' ';

  if (process.env.DEBUG_DVD) {
    console.log(`[SVG-ANIM] Generating frame for output (${content.length} chars): ${JSON.stringify(content.slice(0, 80))}`);
  }

  const svg = await shellfieAsync(content, options);

  if (process.env.DEBUG_DVD) {
    console.log(`[SVG-ANIM] Generated SVG (${svg.length} chars), has content: ${svg.includes('tspan')}`);
  }

  return svg;
};

/**
 * Extract SVG content (everything inside the <svg> tag)
 * Also makes IDs unique by adding a suffix
 */
const extractSVGContent = (svg: string, frameSuffix: string): { content: string; width: number; height: number } => {
  const widthMatch = svg.match(/width="(\d+)"/);
  const heightMatch = svg.match(/height="(\d+)"/);
  const contentMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);

  const width = widthMatch ? parseInt(widthMatch[1], 10) : 800;
  const height = heightMatch ? parseInt(heightMatch[1], 10) : 600;
  let content = contentMatch ? contentMatch[1] : '';

  // Make IDs unique by appending frame suffix
  // Replace id="foo" with id="foo-frame-N" and url(#foo) with url(#foo-frame-N)
  content = content.replace(/id="([^"]*)"/g, `id="$1-${frameSuffix}"`);
  content = content.replace(/url\(#([^)]*)\)/g, `url(#$1-${frameSuffix})`);

  return { content, width, height };
};

/**
 * Create CSS keyframes for frame animation
 */
const createKeyframes = (frameCount: number, frames: TerminalFrame[]): string => {
  if (frameCount === 0) return '';

  const totalDuration = frames[frames.length - 1].timestamp;
  const keyframes: string[] = [];

  for (let i = 0; i < frameCount; i++) {
    const timestamp = frames[i].timestamp;
    const percentage = (timestamp / totalDuration) * 100;
    keyframes.push(`
      ${percentage.toFixed(2)}% {
        opacity: ${i === 0 ? 1 : 0};
      }`);

    // Make this frame visible
    if (i > 0) {
      const prevPercentage = (frames[i - 1].timestamp / totalDuration) * 100;
      keyframes.push(`
      ${prevPercentage.toFixed(2)}% {
        opacity: 0;
      }
      ${percentage.toFixed(2)}% {
        opacity: 1;
      }`);
    }
  }

  return `
    @keyframes dvd-frame-0 {
      0% { opacity: 1; }
      ${((frames[1]?.timestamp || 0) / totalDuration * 100).toFixed(2)}% { opacity: 1; }
      ${((frames[1]?.timestamp || 0) / totalDuration * 100 + 0.01).toFixed(2)}% { opacity: 0; }
      100% { opacity: 0; }
    }
    ${frames.slice(1, -1).map((frame, index) => {
      const i = index + 1;
      const prevTime = frames[i - 1].timestamp;
      const currTime = frame.timestamp;
      const nextTime = frames[i + 1]?.timestamp || totalDuration;

      return `
    @keyframes dvd-frame-${i} {
      0% { opacity: 0; }
      ${(prevTime / totalDuration * 100).toFixed(2)}% { opacity: 0; }
      ${(currTime / totalDuration * 100).toFixed(2)}% { opacity: 1; }
      ${(nextTime / totalDuration * 100).toFixed(2)}% { opacity: 1; }
      ${(nextTime / totalDuration * 100 + 0.01).toFixed(2)}% { opacity: 0; }
      100% { opacity: 0; }
    }`;
    }).join('\n')}
    ${frameCount > 1 ? `
    @keyframes dvd-frame-${frameCount - 1} {
      0% { opacity: 0; }
      ${(frames[frameCount - 2].timestamp / totalDuration * 100).toFixed(2)}% { opacity: 0; }
      ${(frames[frameCount - 1].timestamp / totalDuration * 100).toFixed(2)}% { opacity: 1; }
      100% { opacity: 1; }
    }` : ''}
  `;
};

/**
 * Create animated SVG from terminal frames
 */
export const createAnimatedSVG = async (
  frames: TerminalFrame[],
  options: AnimationOptions = {}
): Promise<string> => {
  if (frames.length === 0) {
    throw new Error('No frames to animate');
  }

  // Generate SVG for each frame
  const frameSVGs: Array<{ content: string; width: number; height: number }> = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (process.env.DEBUG_DVD && (i < 3 || i > frames.length - 3)) {
      console.log(`[CREATE-ANIM] Processing frame ${i}, output length: ${frame.output.length}, first 50 chars: ${JSON.stringify(frame.output.slice(0, 50))}`);
    }

    const svg = await generateFrameSVG(frame.output, options);
    const extracted = extractSVGContent(svg, `frame-${i}`);

    if (process.env.DEBUG_DVD && (i < 3 || i > frames.length - 3)) {
      console.log(`[CREATE-ANIM] Extracted content length: ${extracted.content.length}, has text: ${extracted.content.includes('text')}`);
    }

    frameSVGs.push(extracted);
  }

  // Use dimensions from first frame
  const { width, height } = frameSVGs[0];

  if (process.env.DEBUG_DVD) {
    console.log(`[BUILD-SVG] Building final SVG with ${frameSVGs.length} frames`);
    console.log(`[BUILD-SVG] Last frame content length: ${frameSVGs[frameSVGs.length - 1].content.length}`);
    console.log(`[BUILD-SVG] Last frame has Testing: ${frameSVGs[frameSVGs.length - 1].content.includes('Testing')}`);
  }

  // Calculate animation duration
  const totalDuration = frames[frames.length - 1].timestamp;
  const duration = (totalDuration / 1000).toFixed(2); // Convert to seconds

  // Create keyframes
  const keyframes = createKeyframes(frames.length, frames);

  // Create animation CSS
  const pauseAtEnd = options.pauseAtEnd || 0;
  const pauseAtEndSeconds = pauseAtEnd / 1000; // Convert ms to seconds
  const animationDuration = (parseFloat(duration) + pauseAtEndSeconds).toFixed(2);
  const animationIterationCount = options.loop ? 'infinite' : '1';

  // Build the animated SVG
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <style>
    ${keyframes}

    .dvd-frame {
      animation-duration: ${animationDuration}s;
      animation-timing-function: step-end;
      animation-iteration-count: ${animationIterationCount};
      animation-fill-mode: forwards;
    }

    ${frameSVGs.map((_, i) => `
    .dvd-frame-${i} {
      animation-name: dvd-frame-${i};
    }`).join('\n')}
  </style>

  <defs>
    ${frameSVGs.map((frame, i) => `
    <g id="frame-${i}">
      ${frame.content}
    </g>`).join('\n')}
  </defs>

  ${frameSVGs.map((_, i) => `
  <use href="#frame-${i}" class="dvd-frame dvd-frame-${i}" />`).join('\n')}
</svg>`;

  if (process.env.DEBUG_DVD) {
    console.log(`[BUILD-SVG] Final SVG length: ${svg.length}`);
    console.log(`[BUILD-SVG] Final SVG has Testing: ${svg.includes('Testing')}`);
  }

  return svg;
};

/**
 * Create a static SVG from a single frame (for screenshots)
 */
export const createStaticSVG = async (
  frame: TerminalFrame,
  options: shellfieOptions = {}
): Promise<string> => {
  return await generateFrameSVG(frame.output, options);
};

/**
 * Optimize SVG by removing duplicate content
 * This reduces file size for animations with similar frames
 */
export const optimizeSVG = (svg: string): string => {
  // Simple optimization: remove extra whitespace
  return svg
    .replace(/\n\s+/g, '\n')
    .replace(/>\s+</g, '><')
    .trim();
};

/**
 * Get animation metadata
 */
export const getAnimationMetadata = (frames: TerminalFrame[]): {
  duration: number;
  frameCount: number;
  fps: number;
} => {
  const duration = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;
  const frameCount = frames.length;
  const fps = frameCount > 1 ? (frameCount / (duration / 1000)) : 0;

  return {
    duration,
    frameCount,
    fps: Math.round(fps * 10) / 10,
  };
};
