/**
 * SVG Animator - Generates animated SVGs using sprite-sheet technique
 *
 * Like svg-term, this lays out all frames horizontally and uses CSS
 * transform animation to shift between them. This keeps file size small
 * because:
 * 1. Only frame content differs (shared chrome/window)
 * 2. CSS animation is tiny compared to duplicating structure
 */

import { Recording } from './recorder';
import { shellfieAsync, type shellfieOptions } from 'shellfie';

export interface AnimatorOptions {
  loop: boolean;
  shellfieOptions: shellfieOptions;
}

const DEFAULT_OPTIONS: AnimatorOptions = {
  loop: true,
  shellfieOptions: {},
};

/**
 * Generates an animated SVG from a recording using sprite-sheet technique.
 */
export async function generateAnimatedSvg(
  recording: Recording,
  options: Partial<AnimatorOptions> = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { frames, duration } = recording;

  // Single frame = static SVG
  if (frames.length <= 1) {
    const content = frames.length === 1 ? frames[0].content : '';
    return shellfieAsync(content, opts.shellfieOptions);
  }

  // Render all frames
  const frameSvgs = await Promise.all(
    frames.map(f => shellfieAsync(f.content, opts.shellfieOptions))
  );

  // Parse dimensions from first frame
  const { width, height } = parseDimensions(frameSvgs[0]);

  // Build sprite-sheet SVG
  return buildSpriteSheetSvg(frameSvgs, width, height, duration, opts.loop);
}

/**
 * Parse width and height from SVG.
 */
function parseDimensions(svg: string): { width: number; height: number } {
  const widthMatch = svg.match(/width="([^"]+)"/);
  const heightMatch = svg.match(/height="([^"]+)"/);

  return {
    width: widthMatch ? parseFloat(widthMatch[1]) : 800,
    height: heightMatch ? parseFloat(heightMatch[1]) : 600,
  };
}

/**
 * Build sprite-sheet SVG with CSS animation.
 *
 * Structure:
 * <svg viewBox="0 0 width height" style="overflow:hidden">
 *   <defs>...</defs>
 *   <style>keyframes animation</style>
 *   <g class="reel" style="animation">
 *     <g transform="translate(0,0)">frame 0 content</g>
 *     <g transform="translate(width,0)">frame 1 content</g>
 *     ...
 *   </g>
 * </svg>
 */
function buildSpriteSheetSvg(
  frameSvgs: string[],
  width: number,
  height: number,
  duration: number,
  loop: boolean
): string {
  const frameCount = frameSvgs.length;
  const totalWidth = width * frameCount;

  // Build keyframes - each frame gets equal time
  const keyframes = buildKeyframes(frameCount, width);

  // Build CSS
  const iterationCount = loop ? 'infinite' : '1';
  const css = `
<style>
@keyframes reel {
${keyframes}
}
.reel {
  animation: reel ${duration.toFixed(2)}s steps(1, end) ${iterationCount};
  animation-fill-mode: forwards;
}
</style>`;

  // Extract content from each frame (glyphs + text)
  const frameContents = frameSvgs.map((svg, i) => {
    const content = extractContent(svg);
    return `    <g transform="translate(${width * i}, 0)">\n${content}\n    </g>`;
  });

  // Extract shared parts from first frame (defs, title-bar, background)
  const { defs, titleBar, background } = extractSharedParts(frameSvgs[0]);

  // Build final SVG
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="overflow: hidden;">
${css}
${defs}
${background}
${titleBar}
  <g class="reel">
${frameContents.join('\n')}
  </g>
</svg>`;
}

/**
 * Build CSS keyframes for sprite-sheet animation.
 */
function buildKeyframes(frameCount: number, frameWidth: number): string {
  const lines: string[] = [];

  for (let i = 0; i < frameCount; i++) {
    const percent = (i / frameCount) * 100;
    const translateX = -frameWidth * i;
    lines.push(`  ${percent.toFixed(2)}% { transform: translateX(${translateX}px); }`);
  }

  // Final keyframe
  lines.push(`  100% { transform: translateX(${-frameWidth * (frameCount - 1)}px); }`);

  return lines.join('\n');
}

/**
 * Extract the renderable content from an SVG (glyphs + text groups).
 */
function extractContent(svg: string): string {
  const parts: string[] = [];

  // Extract glyphs group
  const glyphsMatch = svg.match(/<g class="glyphs">[\s\S]*?<\/g>/);
  if (glyphsMatch) {
    parts.push('      ' + glyphsMatch[0]);
  }

  // Extract text group
  const textMatch = svg.match(/<g class="text">[\s\S]*?<\/g>/);
  if (textMatch) {
    parts.push('      ' + textMatch[0]);
  }

  return parts.join('\n');
}

/**
 * Extract shared parts from SVG (defs, title-bar, background rect).
 */
function extractSharedParts(svg: string): {
  defs: string;
  titleBar: string;
  background: string;
} {
  // Extract defs
  const defsMatch = svg.match(/<defs>[\s\S]*?<\/defs>/);
  const defs = defsMatch ? `  ${defsMatch[0]}` : '';

  // Extract background rect
  const bgMatch = svg.match(/<rect x="0" y="0"[^>]*filter[^>]*\/>/);
  const background = bgMatch ? `  ${bgMatch[0]}` : '';

  // Extract title-bar
  const titleBarMatch = svg.match(/<g class="title-bar">[\s\S]*?<\/g>/);
  const titleBar = titleBarMatch ? `  ${titleBarMatch[0]}` : '';

  return { defs, titleBar, background };
}

// Export for shellfie.ts
export { generateAnimatedSvg as generateOptimizedAnimatedSvg };
