import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

export interface CliArgs {
  _: (string | number)[];
  output?: string;
  name?: string;
  stdout: boolean;
  template: string;
  theme?: string;
  title?: string;
  width?: number;
  padding?: string;
  'font-size': number;
  'line-height': number;
  watermark?: string;
  'no-controls': boolean;
  'no-custom-glyphs': boolean;
  'font-family'?: string;
  'embed-font': boolean;
  'header-height'?: number;
  'header-color'?: string;
  'footer-height'?: number;
  'footer-color'?: string;
  'list-themes'?: boolean;
  'list-templates'?: boolean;
  // Simplified animation options
  animate?: boolean;
  fps?: number;
  'max-duration'?: number;
  'max-frames'?: number;
  loop?: boolean;
}

export interface BuildOptionsResult {
  template: 'macos' | 'windows' | 'minimal';
  themeName?: string;
  title?: string;
  width?: number;
  padding?: number | [number, number] | [number, number, number, number];
  fontSize: number;
  lineHeight: number;
  watermark?: string;
  controls: boolean;
  customGlyphs: boolean;
  fontFamily?: string;
  embedFont: boolean;
  header?: { height?: number; backgroundColor?: string };
  footer?: { height?: number; backgroundColor?: string };
}

type Padding = number | [number, number] | [number, number, number, number];

const ESCAPE_REPLACEMENTS: [RegExp, string][] = [
  [/\\033/g, '\x1b'],
  [/\\x1[bB]/g, '\x1b'],
  [/\\e/g, '\x1b'],
];

export const parseEscapeSequences = (input: string): string =>
  ESCAPE_REPLACEMENTS.reduce((str, [pattern, replacement]) => str.replace(pattern, replacement), input);

export const readStdin = (): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });

export const readInput = async (inputFile?: string): Promise<string> => {
  if (inputFile) return readFileSync(resolve(inputFile), 'utf-8');
  if (!process.stdin.isTTY) return readStdin();
  return '';
};

export const parsePadding = (input: string): Padding => {
  const values = input
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map(Number);

  if (values.some(isNaN)) {
    throw new Error(`Invalid padding value: "${input}". Use numbers only.`);
  }

  const paddingByLength: Record<number, () => Padding> = {
    1: () => values[0],
    2: () => values as [number, number],
    4: () => values as [number, number, number, number],
  };

  const toPadding = paddingByLength[values.length];
  if (!toPadding) {
    throw new Error(
      `Invalid padding format: "${input}". Use 1, 2, or 4 values (e.g., "16", "10,20", "10,20,15,25").`
    );
  }

  return toPadding();
};

const ensureSvgExtension = (path: string): string =>
  path.endsWith('.svg') ? path : `${path}.svg`;

export const getOutputPath = (options: {
  output?: string;
  name?: string;
  inputFile?: string;
}): string => {
  const { output, name, inputFile } = options;

  if (output) return ensureSvgExtension(resolve(output));
  if (name) return resolve(process.cwd(), ensureSvgExtension(name));
  if (inputFile) return resolve(process.cwd(), `${basename(inputFile).replace(/\.[^.]+$/, '')}.svg`);

  return resolve(process.cwd(), 'shellfie.svg');
};

const buildHeaderFooter = (
  height: number | undefined,
  color: string | undefined
): { height?: number; backgroundColor?: string } | undefined => {
  if (height === undefined && color === undefined) return undefined;
  return {
    ...(height !== undefined && { height }),
    ...(color !== undefined && { backgroundColor: color }),
  };
};

export const buildOptions = (argv: Partial<CliArgs>): BuildOptionsResult => ({
  template: (argv.template as 'macos' | 'windows' | 'minimal') ?? 'macos',
  fontSize: argv['font-size'] ?? 14,
  lineHeight: argv['line-height'] ?? 1.4,
  embedFont: argv['embed-font'] ?? false,
  controls: !argv['no-controls'],
  customGlyphs: !argv['no-custom-glyphs'],
  ...(argv.theme && { themeName: argv.theme }),
  ...(argv.title !== undefined && { title: argv.title }),
  ...(argv.width !== undefined && { width: argv.width }),
  ...(argv.padding !== undefined && { padding: parsePadding(argv.padding) }),
  ...(argv.watermark !== undefined && { watermark: parseEscapeSequences(argv.watermark) }),
  ...(argv['font-family'] !== undefined && { fontFamily: argv['font-family'] }),
  ...({ header: buildHeaderFooter(argv['header-height'], argv['header-color']) }),
  ...({ footer: buildHeaderFooter(argv['footer-height'], argv['footer-color']) }),
});
