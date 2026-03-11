import { describe, it, expect } from 'vitest';
import { parsePadding, getOutputPath, buildOptions, parseEscapeSequences } from './utils';

describe('parsePadding', () => {
  it('should parse single number value', () => {
    expect(parsePadding('16')).toBe(16);
    expect(parsePadding('0')).toBe(0);
    expect(parsePadding('100')).toBe(100);
  });

  it('should parse two values (vertical, horizontal) with comma', () => {
    expect(parsePadding('10,20')).toEqual([10, 20]);
    expect(parsePadding('0,0')).toEqual([0, 0]);
  });

  it('should parse two values with space', () => {
    expect(parsePadding('10 20')).toEqual([10, 20]);
    expect(parsePadding('  10   20  ')).toEqual([10, 20]);
  });

  it('should parse four values (top, right, bottom, left) with comma', () => {
    expect(parsePadding('10,20,15,25')).toEqual([10, 20, 15, 25]);
  });

  it('should parse four values with space', () => {
    expect(parsePadding('10 20 15 25')).toEqual([10, 20, 15, 25]);
  });

  it('should throw for invalid values', () => {
    expect(() => parsePadding('abc')).toThrow('Invalid padding value');
    expect(() => parsePadding('10,abc')).toThrow('Invalid padding value');
  });

  it('should throw for invalid count of values', () => {
    expect(() => parsePadding('10,20,30')).toThrow('Invalid padding format');
    expect(() => parsePadding('1,2,3,4,5')).toThrow('Invalid padding format');
  });
});

describe('getOutputPath', () => {
  it('should use explicit output path', () => {
    const result = getOutputPath({ output: '/path/to/output.svg' });
    expect(result).toBe('/path/to/output.svg');
  });

  it('should add .svg extension if missing from output', () => {
    const result = getOutputPath({ output: '/path/to/output' });
    expect(result).toBe('/path/to/output.svg');
  });

  it('should use name option with current directory', () => {
    const result = getOutputPath({ name: 'my-screenshot' });
    expect(result).toContain('my-screenshot.svg');
  });

  it('should not duplicate .svg extension in name', () => {
    const result = getOutputPath({ name: 'my-screenshot.svg' });
    expect(result).toContain('my-screenshot.svg');
    expect(result).not.toContain('.svg.svg');
  });

  it('should derive filename from input file', () => {
    const result = getOutputPath({ inputFile: '/some/path/input.txt' });
    expect(result).toContain('input.svg');
  });

  it('should return default shellfie.svg when no options', () => {
    const result = getOutputPath({});
    expect(result).toContain('shellfie.svg');
  });

  it('should prioritize output over name', () => {
    const result = getOutputPath({
      output: '/explicit/path.svg',
      name: 'ignored',
    });
    expect(result).toBe('/explicit/path.svg');
  });

  it('should prioritize name over inputFile', () => {
    const result = getOutputPath({
      name: 'custom-name',
      inputFile: '/some/input.txt',
    });
    expect(result).toContain('custom-name.svg');
    expect(result).not.toContain('input');
  });
});

describe('buildOptions', () => {
  it('should return default options for empty arguments', () => {
    const options = buildOptions({});
    expect(options.template).toBe('macos');
    expect(options.fontSize).toBe(14);
    expect(options.lineHeight).toBe(1.4);
    expect(options.embedFont).toBe(false);
    expect(options.controls).toBe(true);
    expect(options.customGlyphs).toBe(true);
  });

  it('should set template option', () => {
    const options = buildOptions({ template: 'windows' });
    expect(options.template).toBe('windows');
  });

  it('should set theme name for later resolution', () => {
    const options = buildOptions({ theme: 'dracula' });
    expect(options.themeName).toBe('dracula');
  });

  it('should set title option', () => {
    const options = buildOptions({ title: 'My Title' });
    expect(options.title).toBe('My Title');
  });

  it('should set empty title when provided', () => {
    const options = buildOptions({ title: '' });
    expect(options.title).toBe('');
  });

  it('should set width option', () => {
    const options = buildOptions({ width: 80 });
    expect(options.width).toBe(80);
  });

  it('should parse and set padding option', () => {
    const options = buildOptions({ padding: '10,20,15,25' });
    expect(options.padding).toEqual([10, 20, 15, 25]);
  });

  it('should set font-size option', () => {
    const options = buildOptions({ 'font-size': 16 });
    expect(options.fontSize).toBe(16);
  });

  it('should set line-height option', () => {
    const options = buildOptions({ 'line-height': 1.6 });
    expect(options.lineHeight).toBe(1.6);
  });

  it('should set watermark option', () => {
    const options = buildOptions({ watermark: '@shellfie' });
    expect(options.watermark).toBe('@shellfie');
  });

  it('should parse watermark escape sequences', () => {
    const options = buildOptions({ watermark: '\\033[31mRed\\033[0m' });
    expect(options.watermark).toBe('\x1b[31mRed\x1b[0m');
  });

  it('should set controls to false when controls is false', () => {
    const options = buildOptions({ 'controls': false });
    expect(options.controls).toBe(false);
  });

  it('should set controls to true by default', () => {
    const options = buildOptions({});
    expect(options.controls).toBe(true);
  });

  it('should set customGlyphs to false when custom-glyphs is false', () => {
    const options = buildOptions({ 'custom-glyphs': false });
    expect(options.customGlyphs).toBe(false);
  });

  it('should set language option', () => {
    const options = buildOptions({ language: 'typescript' });
    expect(options.language).toBe('typescript');
  });

  it('should disable syntax highlighting when highlight is false', () => {
    const options = buildOptions({ 'highlight': false });
    expect(options.language).toBe(false);
  });

  it('should return language when highlight is true', () => {
    const options = buildOptions({ language: 'python', 'highlight': true });
    expect(options.language).toBe('python');
  });

  it('should set font-family option', () => {
    const options = buildOptions({ 'font-family': 'Fira Code' });
    expect(options.fontFamily).toBe('Fira Code');
  });

  it('should set embedFont when embed-font is true', () => {
    const options = buildOptions({ 'embed-font': true });
    expect(options.embedFont).toBe(true);
  });

  it('should create header config with height', () => {
    const options = buildOptions({ 'header-height': 50 });
    expect(options.header).toEqual({ height: 50 });
  });

  it('should create header config with color', () => {
    const options = buildOptions({ 'header-color': '#ff0000' });
    expect(options.header).toEqual({ backgroundColor: '#ff0000' });
  });

  it('should create header config with both height and color', () => {
    const options = buildOptions({
      'header-height': 50,
      'header-color': '#ff0000',
    });
    expect(options.header).toEqual({ height: 50, backgroundColor: '#ff0000' });
  });

  it('should create footer config with height', () => {
    const options = buildOptions({ 'footer-height': 30 });
    expect(options.footer).toEqual({ height: 30 });
  });

  it('should create footer config with color', () => {
    const options = buildOptions({ 'footer-color': '#00ff00' });
    expect(options.footer).toEqual({ backgroundColor: '#00ff00' });
  });

  it('should create footer config with both height and color', () => {
    const options = buildOptions({
      'footer-height': 30,
      'footer-color': '#00ff00',
    });
    expect(options.footer).toEqual({ height: 30, backgroundColor: '#00ff00' });
  });

  it('should handle all options together', () => {
    const options = buildOptions({
      template: 'minimal',
      theme: 'nord',
      title: 'Test',
      width: 120,
      padding: '20',
      'font-size': 12,
      'line-height': 1.5,
      watermark: 'Made with shellfie',
      'controls': false,
      'custom-glyphs': false,
      language: 'bash',
      'highlight': true,
      'font-family': 'JetBrains Mono',
      'embed-font': true,
      'header-height': 40,
      'footer-height': 20,
    });

    expect(options.template).toBe('minimal');
    expect(options.themeName).toBe('nord');
    expect(options.title).toBe('Test');
    expect(options.width).toBe(120);
    expect(options.padding).toBe(20);
    expect(options.fontSize).toBe(12);
    expect(options.lineHeight).toBe(1.5);
    expect(options.watermark).toBe('Made with shellfie');
    expect(options.controls).toBe(false);
    expect(options.customGlyphs).toBe(false);
    expect(options.language).toBe('bash');
    expect(options.fontFamily).toBe('JetBrains Mono');
    expect(options.embedFont).toBe(true);
    expect(options.header).toEqual({ height: 40 });
    expect(options.footer).toEqual({ height: 20 });
  });
});

describe('parseEscapeSequences', () => {
  it('should convert octal escape sequences (\\033)', () => {
    const input = '\\033[31mRed\\033[0m';
    const result = parseEscapeSequences(input);
    expect(result).toBe('\x1b[31mRed\x1b[0m');
  });

  it('should convert hex escape sequences (\\x1b)', () => {
    const input = '\\x1b[32mGreen\\x1b[0m';
    const result = parseEscapeSequences(input);
    expect(result).toBe('\x1b[32mGreen\x1b[0m');
  });

  it('should convert shorthand escape sequences (\\e)', () => {
    const input = '\\e[34mBlue\\e[0m';
    const result = parseEscapeSequences(input);
    expect(result).toBe('\x1b[34mBlue\x1b[0m');
  });

  it('should handle uppercase hex notation (\\x1B)', () => {
    const input = '\\x1B[35mMagenta\\x1B[0m';
    const result = parseEscapeSequences(input);
    expect(result).toBe('\x1b[35mMagenta\x1b[0m');
  });

  it('should handle mixed escape sequence formats', () => {
    const input = '\\033[1m\\x1b[31mBold Red\\e[0m';
    const result = parseEscapeSequences(input);
    expect(result).toBe('\x1b[1m\x1b[31mBold Red\x1b[0m');
  });

  it('should leave plain text unchanged', () => {
    const input = '@username';
    const result = parseEscapeSequences(input);
    expect(result).toBe('@username');
  });

  it('should handle empty string', () => {
    const result = parseEscapeSequences('');
    expect(result).toBe('');
  });

  it('should handle text with no escape sequences', () => {
    const input = 'Just plain text with numbers 123';
    const result = parseEscapeSequences(input);
    expect(result).toBe('Just plain text with numbers 123');
  });
});
