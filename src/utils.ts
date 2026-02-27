import { resolve, basename, dirname } from 'node:path';
import type { shellfieOptions } from 'shellfie';

/**
 * Read all data from stdin.
 */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

/**
 * Parse padding string into shellfie-compatible format.
 * Supports:
 *   - Single value: "16" -> 16
 *   - Two values: "10,20" or "10 20" -> [10, 20]
 *   - Four values: "10,20,15,25" or "10 20 15 25" -> [10, 20, 15, 25]
 */
export function parsePadding(
  input: string
): number | [number, number] | [number, number, number, number] {
  const values = input
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map(Number);

  if (values.some(isNaN)) {
    throw new Error(`Invalid padding value: "${input}". Use numbers only.`);
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return values as [number, number];
  }

  if (values.length === 4) {
    return values as [number, number, number, number];
  }

  throw new Error(
    `Invalid padding format: "${input}". Use 1, 2, or 4 values (e.g., "16", "10,20", "10,20,15,25").`
  );
}

/**
 * Determine the output file path.
 */
export function getOutputPath(options: {
  output?: string;
  name?: string;
  inputFile?: string;
}): string {
  const { output, name, inputFile } = options;

  // Explicit output path takes priority
  if (output) {
    let outputPath = resolve(output);
    // Ensure .svg extension
    if (!outputPath.endsWith('.svg')) {
      outputPath += '.svg';
    }
    return outputPath;
  }

  // Use name option with current directory
  if (name) {
    const filename = name.endsWith('.svg') ? name : `${name}.svg`;
    return resolve(process.cwd(), filename);
  }

  // Derive from input file name
  if (inputFile) {
    const base = basename(inputFile).replace(/\.[^.]+$/, '');
    return resolve(process.cwd(), `${base}.svg`);
  }

  // Default
  return resolve(process.cwd(), 'shellfie.svg');
}

/**
 * Build shellfie options from CLI arguments.
 * Exported for testing purposes.
 */
export function buildOptions(argv: {
  template?: string;
  theme?: string;
  title?: string;
  width?: number;
  padding?: string;
  'font-size'?: number;
  'line-height'?: number;
  watermark?: string;
  'no-controls'?: boolean;
  'no-custom-glyphs'?: boolean;
  'font-family'?: string;
  'embed-font'?: boolean;
  'header-height'?: number;
  'header-color'?: string;
  'footer-height'?: number;
  'footer-color'?: string;
}): { options: Partial<shellfieOptions>; themeName?: string } {
  const options: Partial<shellfieOptions> = {};
  let themeName: string | undefined;

  if (argv.template) {
    options.template = argv.template as 'macos' | 'windows' | 'minimal';
  }

  if (argv.theme) {
    themeName = argv.theme;
  }

  if (argv.title !== undefined) {
    options.title = argv.title;
  }

  if (argv.width !== undefined) {
    options.width = argv.width;
  }

  if (argv.padding !== undefined) {
    options.padding = parsePadding(argv.padding);
  }

  if (argv['font-size'] !== undefined) {
    options.fontSize = argv['font-size'];
  }

  if (argv['line-height'] !== undefined) {
    options.lineHeight = argv['line-height'];
  }

  if (argv.watermark !== undefined) {
    options.watermark = argv.watermark;
  }

  if (argv['no-controls']) {
    options.controls = false;
  }

  if (argv['no-custom-glyphs']) {
    options.customGlyphs = false;
  }

  if (argv['font-family'] !== undefined) {
    options.fontFamily = argv['font-family'];
  }

  if (argv['embed-font']) {
    options.embedFont = true;
  }

  // Header configuration
  if (argv['header-height'] !== undefined || argv['header-color'] !== undefined) {
    options.header = {};
    if (argv['header-height'] !== undefined) {
      options.header.height = argv['header-height'];
    }
    if (argv['header-color'] !== undefined) {
      options.header.backgroundColor = argv['header-color'];
    }
  }

  // Footer configuration
  if (argv['footer-height'] !== undefined || argv['footer-color'] !== undefined) {
    options.footer = {};
    if (argv['footer-height'] !== undefined) {
      options.footer.height = argv['footer-height'];
    }
    if (argv['footer-color'] !== undefined) {
      options.footer.backgroundColor = argv['footer-color'];
    }
  }

  return { options, themeName };
}
