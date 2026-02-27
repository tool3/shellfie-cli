import { writeFileSync } from 'node:fs';
import { themes, shellfieAsync, type shellfieOptions, type Theme } from 'shellfie';
import { readInput, getOutputPath, buildOptions, type CliArgs, type BuildOptionsResult } from './utils';

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

export const generateSvg = (input: string, argv: Partial<CliArgs>): Promise<string> =>
  shellfieAsync(input, toShellfieOptions(buildOptions(argv)));

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
