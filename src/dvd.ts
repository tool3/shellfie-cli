/**
 * DVD (Dynamic Video Display) - Main Interface
 * Create animated SVGs from .dvd script files
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseDVD } from './dvd-parser';
import { DVDExecutorV2 } from './dvd-executor-v2';
import { createAnimatedSVG, getAnimationMetadata } from './svg-animator-v2';
import { createSpinner } from './spinner';
import type { AnimationOptions } from './svg-animator-v2';

export interface DVDOptions extends AnimationOptions {
  verbose?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
  title?: string;
  template?: 'macos' | 'windows' | 'minimal';
}

/**
 * Read and parse a .dvd file
 */
export const loadDVDFile = (filePath: string): ReturnType<typeof parseDVD> => {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseDVD(content);
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new Error(`DVD file not found: ${filePath}`);
    }
    throw err;
  }
};

/**
 * Get executor options from DVD settings
 */
const buildExecutorOptions = (
  settings: Map<string, string>,
  cliOptions: DVDOptions
): {
  width?: number;
  height?: number;
  fontSize?: number;
  title?: string;
  template?: 'macos' | 'windows' | 'minimal';
} => {
  const options: {
    width?: number;
    height?: number;
    fontSize?: number;
    title?: string;
    template?: 'macos' | 'windows' | 'minimal';
  } = {};

  // Map DVD settings to executor options
  if (settings.has('Width')) {
    options.width = parseInt(settings.get('Width')!, 10);
  }
  if (settings.has('Height')) {
    options.height = parseInt(settings.get('Height')!, 10);
  }
  if (settings.has('FontSize')) {
    options.fontSize = parseInt(settings.get('FontSize')!, 10);
  }
  if (settings.has('Title')) {
    options.title = settings.get('Title');
  }
  if (settings.has('Template')) {
    options.template = settings.get('Template') as 'macos' | 'windows' | 'minimal';
  }

  // Override with CLI options
  return { ...options, ...cliOptions };
};

/**
 * Execute a DVD script and generate animated SVG
 */
export const executeDVD = async (
  filePath: string,
  options: DVDOptions = {}
): Promise<{ svg: string; metadata: ReturnType<typeof getAnimationMetadata> }> => {
  const spinner = createSpinner('Loading DVD script');

  if (!options.verbose) {
    spinner.start();
  }

  // Load and parse the DVD file
  const script = loadDVDFile(filePath);

  if (options.verbose) {
    console.log(`Loaded ${script.commands.length} commands from ${filePath}`);
  } else {
    spinner.update('Checking requirements');
  }

  // Check requirements (basic check using which)
  if (script.requirements.length > 0) {
    if (options.verbose) {
      console.log(`Requirements specified: ${script.requirements.join(', ')}`);
    }
  }

  // Build executor options from settings
  const executorOptions = buildExecutorOptions(script.settings, options);

  // Execute the script
  if (!options.verbose) {
    spinner.update('Executing DVD script');
  }

  const executor = new DVDExecutorV2({
    width: executorOptions.width,
    height: executorOptions.height,
    fontSize: executorOptions.fontSize,
    title: executorOptions.title,
    template: executorOptions.template,
    onProgress: (current, total) => {
      if (options.verbose) {
        console.log(`Executing command ${current}/${total}`);
      } else {
        spinner.update(`Executing commands (${current}/${total})`);
      }
    },
  });

  try {
    const frames = await executor.execute(script);

    if (options.verbose) {
      console.log(`Captured ${frames.length} frames`);
    } else {
      spinner.update('Generating animated SVG');
    }

    // Generate animated SVG
    const animationOptions: AnimationOptions = {
      fps: options.fps,
      loop: options.loop !== false, // Default to true
      pauseAtEnd: options.pauseAtEnd || 1000, // Default 1s pause
    };

    const svg = await createAnimatedSVG(frames, animationOptions);

    const metadata = getAnimationMetadata(frames);

    if (!options.verbose) {
      spinner.stop();
    }

    return { svg, metadata };
  } catch (err) {
    await executor.cleanup();
    throw err;
  }
};

/**
 * Main entry point - execute DVD and write to file
 */
export const createDVD = async (
  inputPath: string,
  outputPath?: string,
  options: DVDOptions = {}
): Promise<string> => {
  const spinner = createSpinner('Creating animated SVG');

  try {
    const script = loadDVDFile(inputPath);
    const output = outputPath || script.output || inputPath.replace(/\.dvd$/, '.svg');

    const { svg, metadata } = await executeDVD(inputPath, options);

    // Write output
    writeFileSync(output, svg, 'utf-8');

    const sizeKB = (Buffer.byteLength(svg, 'utf-8') / 1024).toFixed(2);

    spinner.success(
      `Created ${output} (${metadata.frameCount} frames, ${(metadata.duration / 1000).toFixed(2)}s, ${sizeKB}KB)`
    );

    if (options.verbose) {
      console.log(`Animation: ${metadata.frameCount} frames @ ${metadata.fps} fps`);
      console.log(`Duration: ${(metadata.duration / 1000).toFixed(2)}s`);
      console.log(`File size: ${sizeKB}KB`);
    }

    return output;
  } catch (err) {
    spinner.fail('Failed to create DVD');
    if (err instanceof Error) {
      console.error(err.message);
      console.error(err.stack);
    }
    throw err;
  }
};
