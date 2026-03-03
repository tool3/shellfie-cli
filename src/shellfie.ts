import { writeFileSync } from 'node:fs';
import { themes, shellfieAsync, type shellfieOptions, type Theme } from 'shellfie';
import { readInput, getOutputPath, buildOptions, type CliArgs, type BuildOptionsResult } from './utils';
import { recordPipedInput } from './recorder';
import { generateAnimatedSvg } from './svg-animator';

export const THEME_NAMES = Object.keys(themes) as (keyof typeof themes)[];
export const TEMPLATE_NAMES = ['macos', 'windows', 'minimal'] as const;

const printList = (title: string, items: readonly string[]): void => {
  console.log(title);
  items.forEach((name) => console.log(`  ${name}`));
};

export const listThemes = (): void => printList('Available themes:', THEME_NAMES);

export const listTemplates = (): void => printList('Available templates:', TEMPLATE_NAMES);

export const resolveTheme = (themeName?: string): Theme | undefined =>
  themeName ? (themes[themeName as keyof typeof themes] as Theme) : undefined;

export const toShellfieOptions = ({ themeName, ...rest }: BuildOptionsResult): shellfieOptions => ({
  ...rest,
  theme: resolveTheme(themeName),
});

export const loadInput = (inputFile?: string): Promise<string> => readInput(inputFile);

/**
 * Generate a static SVG from terminal input.
 */
export const generateSvg = async (input: string, argv: Partial<CliArgs>): Promise<string> => {
  const options = buildOptions(argv);
  return shellfieAsync(input, toShellfieOptions(options));
};

/**
 * Options for animated SVG generation.
 */
export interface AnimatedSvgOptions {
  fps: number;
  maxDuration: number;
  maxFrames: number;
  loop: boolean;
  shellfieOptions: shellfieOptions;
}

/**
 * Generate an animated SVG from terminal input.
 * Detects frame boundaries (clear screen) and creates sprite-sheet animation.
 */
export const generateAnimatedSvgFromInput = async (
  input: string,
  options: AnimatedSvgOptions
): Promise<string> => {
  // Record input - splits into frames by clear screen sequences
  const recording = recordPipedInput(input, {
    fps: options.fps,
    maxDuration: options.maxDuration,
    maxFrames: options.maxFrames,
  });

  // Generate animated SVG using sprite-sheet technique
  return generateAnimatedSvg(recording, {
    loop: options.loop,
    shellfieOptions: options.shellfieOptions,
  });
};

// Export with simpler name for CLI
export { generateAnimatedSvgFromInput as generateAnimatedSvg };

export const outputToStdout = (svg: string): void => {
  process.stdout.write(svg);
};

export const outputToFile = (svg: string, outputPath: string): void => {
  writeFileSync(outputPath, svg, 'utf-8');
};

export const resolveOutputPath = (
  argv: { output?: string; name?: string },
  inputFile?: string
): string =>
  getOutputPath({ output: argv.output, name: argv.name, inputFile });
