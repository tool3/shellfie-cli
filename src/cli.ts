#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { shellfieAsync, themes, type shellfieOptions, type Theme } from 'shellfie';
import yargs from 'yargs';
import { createSpinner } from './spinner';
import { readStdin, parsePadding, getOutputPath } from './utils';

const THEME_NAMES = Object.keys(themes) as (keyof typeof themes)[];
const TEMPLATE_NAMES = ['macos', 'windows', 'minimal'] as const;

async function run(): Promise<void> {
  const argv = await yargs
    .scriptName('shellfie')
    .usage('$0 [options] [file]')
    .usage('')
    .usage('Transform terminal output into beautiful SVG images')

    // Output options
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
      type: 'boolean',
      describe: 'Output SVG to stdout instead of file',
      default: false,
    })

    // Template & Theme
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
      type: 'string',
      describe: 'Window title text',
    })

    // Dimensions
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
      type: 'number',
      describe: 'Font size in pixels',
      default: 14,
    })
    .option('line-height', {
      type: 'number',
      describe: 'Line height multiplier',
      default: 1.4,
    })

    // Styling
    .option('watermark', {
      type: 'string',
      describe: 'Watermark text (bottom-right corner)',
    })
    .option('no-controls', {
      type: 'boolean',
      describe: 'Hide window control buttons',
      default: false,
    })
    .option('no-custom-glyphs', {
      type: 'boolean',
      describe: 'Use font glyphs instead of pixel-perfect box drawing',
      default: false,
    })

    // Font
    .option('font-family', {
      type: 'string',
      describe: 'CSS font-family string',
    })
    .option('embed-font', {
      type: 'boolean',
      describe: 'Embed system font in SVG (for portability)',
      default: false,
    })

    // Header/Footer
    .option('header-height', {
      type: 'number',
      describe: 'Custom header bar height (enables header)',
    })
    .option('header-color', {
      type: 'string',
      describe: 'Header background color (hex)',
    })
    .option('footer-height', {
      type: 'number',
      describe: 'Footer bar height (enables footer)',
    })
    .option('footer-color', {
      type: 'string',
      describe: 'Footer background color (hex)',
    })

    // List options
    .option('list-themes', {
      type: 'boolean',
      describe: 'List all available themes',
    })
    .option('list-templates', {
      type: 'boolean',
      describe: 'List all available templates',
    })

    // Examples at the end
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
    .showHelpOnFail(true)
    .parse();

  // Handle list commands
  if (argv['list-themes']) {
    console.log('Available themes:');
    THEME_NAMES.forEach((name) => console.log(`  ${name}`));
    process.exit(0);
  }

  if (argv['list-templates']) {
    console.log('Available templates:');
    TEMPLATE_NAMES.forEach((name) => console.log(`  ${name}`));
    process.exit(0);
  }

  // Read input
  let input: string;
  const inputFile = argv._[0] as string | undefined;

  if (inputFile) {
    // Read from file
    const filePath = resolve(inputFile);
    try {
      input = readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`Error: Cannot read file "${inputFile}"`);
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    // Read from stdin (piped input)
    input = await readStdin();
  } else {
    // No input provided - show help
    yargs.showHelp();
    process.exit(0);
  }

  if (!input.trim()) {
    console.error('Error: Input is empty.');
    process.exit(1);
  }

  // Build shellfie options
  const options: shellfieOptions = {
    template: argv.template as 'macos' | 'windows' | 'minimal',
    fontSize: argv['font-size'],
    lineHeight: argv['line-height'],
    embedFont: argv['embed-font'],
    controls: !argv['no-controls'],
    customGlyphs: !argv['no-custom-glyphs'],
  };

  if (argv.theme) {
    options.theme = themes[argv.theme as keyof typeof themes] as Theme;
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

  if (argv.watermark !== undefined) {
    options.watermark = argv.watermark;
  }

  if (argv['font-family'] !== undefined) {
    options.fontFamily = argv['font-family'];
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

  // Generate SVG
  const spinner = createSpinner('Creating SVG');

  if (!argv.stdout) {
    spinner.start();
  }

  try {
    const svg = await shellfieAsync(input, options);

    if (argv.stdout) {
      process.stdout.write(svg);
      process.exit(0);
    }

    // Determine output path
    const outputPath = getOutputPath({
      output: argv.output,
      name: argv.name,
      inputFile,
    });

    // Write file
    writeFileSync(outputPath, svg, 'utf-8');

    spinner.success(`Created ${outputPath}`);
  } catch (err) {
    spinner.fail('Failed to create SVG');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

run();
