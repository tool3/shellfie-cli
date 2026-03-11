#!/usr/bin/env node

import yargs from 'yargs';
import { createSpinner } from './spinner';
import {
  THEME_NAMES,
  TEMPLATE_NAMES,
  listThemes,
  listTemplates,
  loadInput,
  generateSvg,
  outputToStdout,
  outputToFile,
  resolveOutputPath,
} from './shellfie';
import type { CliArgs } from './utils';

const createParser = () =>
  yargs
    .scriptName('shellfie')
    .usage('$0 [options] [file]')
    .usage('')
    .usage('Terminal output to beautiful SVGs')
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: 'Output file path (defaults to ./shellfie.svg)',
    })
    .option('name', {
      alias: 'n',
      type: 'string',
      describe: 'Output filename (without extension)',
    })
    .option('stdout', {
      alias: 's',
      type: 'boolean',
      describe: 'Output SVG to stdout instead of file',
      default: false,
    })
    .option('template', {
      alias: 't',
      type: 'string',
      choices: TEMPLATE_NAMES,
      describe: 'Window template style',
      default: 'macos',
    })
    .option('theme', {
      alias: 'T',
      type: 'string',
      choices: THEME_NAMES,
      describe: 'Color theme',
    })
    .option('title', {
      alias: 'i',
      type: 'string',
      describe: 'Window title text',
    })
    .option('width', {
      alias: 'w',
      type: 'number',
      describe: 'Terminal width in columns (auto-detected if not set)',
    })
    .option('padding', {
      alias: 'p',
      type: 'string',
      describe: 'Padding in pixels (single value or "top,right,bottom,left")',
    })
    .option('font-size', {
      alias: 'f',
      type: 'number',
      describe: 'Font size in pixels',
      default: 14,
    })
    .option('line-height', {
      alias: 'l',
      type: 'number',
      describe: 'Line height multiplier',
      default: 1.4,
    })
    .option('watermark', {
      alias: 'W',
      type: 'string',
      describe: 'Watermark text (bottom-right corner)',
    })
    .option('controls', {
      alias: 'C',
      type: 'boolean',
      describe: 'Show window control buttons',
      default: true,
    })
    .option('custom-glyphs', {
      alias: 'G',
      type: 'boolean',
      describe: 'Use pixel-perfect box instead of drawing font glyphs',
      default: true,
    })
    .option('language', {
      alias: 'g',
      type: 'string',
      describe: 'Syntax highlighting language (auto, typescript, python, bash, etc.)',
      default: 'auto',
    })
    .option('highlight', {
      alias: 'N',
      type: 'boolean',
      describe: 'Syntax highlighting',
      default: true,
    })
    .option('font-family', {
      alias: 'F',
      type: 'string',
      describe: 'CSS font-family string',
    })
    .option('embed-font', {
      alias: 'e',
      type: 'boolean',
      describe: 'Embed system font in SVG (for portability)',
      default: false,
    })
    .option('header-height', {
      alias: 'H',
      type: 'number',
      describe: 'Custom header bar height (enables header)',
    })
    .option('header-color', {
      alias: 'c',
      type: 'string',
      describe: 'Header background color (hex)',
    })
    .option('footer-height', {
      alias: 'r',
      type: 'number',
      describe: 'Footer bar height (enables footer)',
    })
    .option('footer-color', {
      alias: 'R',
      type: 'string',
      describe: 'Footer background color (hex)',
    })
    .option('list-themes', {
      alias: 'L',
      type: 'boolean',
      describe: 'List all available themes',
    })
    .option('list-templates', {
      alias: 'P',
      type: 'boolean',
      describe: 'List all available templates',
    })
    .example('cat output.txt | $0 -o screenshot.svg', 'Create SVG from piped input')
    .example('$0 terminal.txt --theme dracula', 'Create SVG from file with theme')
    .example('npm test 2>&1 | $0 --title "Tests"', 'Capture command output with title')
    .example('$0 --list-themes', 'List all available themes')
    .demandCommand(0)
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .wrap(Math.min(100, process.stdout.columns || 80))
    .showHelpOnFail(true);

const exit = (code: number, message?: string): never => {
  if (message) console.error(message);
  process.exit(code);
};

const handleListCommands = (argv: CliArgs): boolean => {
  if (argv['list-themes']) {
    listThemes();
    return true;
  }
  if (argv['list-templates']) {
    listTemplates();
    return true;
  }
  return false;
};

const fetchInput = async (inputFile: string | undefined): Promise<string> =>
  loadInput(inputFile).catch(() => {
    throw new Error(`Cannot read file "${inputFile}"`);
  });

const validateInput = (input: string): void => {
  if (!input.trim()) throw new Error('Input is empty.');
};

const writeSvg = (svg: string, argv: CliArgs, inputFile: string | undefined): string => {
  const outputPath = resolveOutputPath(argv, inputFile);

  if (argv.stdout) {
    outputToStdout(svg);
    process.exit(0);
  }

  outputToFile(svg, outputPath);
  return outputPath;
};

const run = async (): Promise<void> => {
  const parser = createParser();
  const argv = (await parser.parse()) as CliArgs;

  if (handleListCommands(argv)) process.exit(0);

  const inputFile = argv._[0] as string | undefined;

  const input = await fetchInput(inputFile).catch((err) =>
    exit(1, `Error: ${err.message}`)
  );

  if (!input) {
    parser.showHelp();
    process.exit(0);
  }

  validateInput(input);

  const spinner = createSpinner('Creating SVG');
  if (!argv.stdout) spinner.start();

  try {
    const svg = await generateSvg(input, argv);
    const outputPath = writeSvg(svg, argv, inputFile);
    spinner.success(`Created ${outputPath}`);
  } catch (err) {
    spinner.fail('Failed to create SVG');
    exit(1, err instanceof Error ? err.message : String(err));
  }
};

run();
