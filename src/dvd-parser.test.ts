import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  parseRegex,
  parseQuotedString,
  tokenizeLine,
  parseCommand,
  parseDVD,
} from './dvd-parser';

describe('parseDuration', () => {
  it('should parse milliseconds', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('100ms')).toBe(100);
  });

  it('should parse seconds', () => {
    expect(parseDuration('2s')).toBe(2000);
    expect(parseDuration('1.5s')).toBe(1500);
  });

  it('should throw on invalid format', () => {
    expect(() => parseDuration('invalid')).toThrow();
    expect(() => parseDuration('100')).toThrow();
  });
});

describe('parseRegex', () => {
  it('should parse basic regex', () => {
    const regex = parseRegex('/test/');
    expect(regex.test('test')).toBe(true);
    expect(regex.test('other')).toBe(false);
  });

  it('should parse regex with flags', () => {
    const regex = parseRegex('/TEST/i');
    expect(regex.test('test')).toBe(true);
    expect(regex.test('TEST')).toBe(true);
  });

  it('should throw on invalid format', () => {
    expect(() => parseRegex('invalid')).toThrow();
    expect(() => parseRegex('/test')).toThrow();
  });
});

describe('parseQuotedString', () => {
  it('should parse simple quoted string', () => {
    expect(parseQuotedString('"hello"')).toBe('hello');
  });

  it('should handle escape sequences', () => {
    expect(parseQuotedString('"hello\\nworld"')).toBe('hello\nworld');
    expect(parseQuotedString('"tab\\there"')).toBe('tab\there');
    expect(parseQuotedString('"quote\\" here"')).toBe('quote" here');
    expect(parseQuotedString('"backslash\\\\"')).toBe('backslash\\');
  });

  it('should throw on unquoted string', () => {
    expect(() => parseQuotedString('hello')).toThrow();
  });
});

describe('tokenizeLine', () => {
  it('should tokenize simple command', () => {
    expect(tokenizeLine('Type "hello"')).toEqual(['Type', '"hello"']);
  });

  it('should handle multiple arguments', () => {
    expect(tokenizeLine('Set FontSize 16')).toEqual(['Set', 'FontSize', '16']);
  });

  it('should preserve quoted strings with spaces', () => {
    expect(tokenizeLine('Type "hello world"')).toEqual(['Type', '"hello world"']);
  });

  it('should handle escaped quotes', () => {
    expect(tokenizeLine('Type "say \\"hi\\""')).toEqual(['Type', '"say \\"hi\\""']);
  });
});

describe('parseCommand', () => {
  it('should parse Output command', () => {
    const cmd = parseCommand('Output demo.svg', 1);
    expect(cmd).toEqual({ type: 'Output', path: 'demo.svg' });
  });

  it('should parse Require command', () => {
    const cmd = parseCommand('Require node', 1);
    expect(cmd).toEqual({ type: 'Require', program: 'node' });
  });

  it('should parse Set command', () => {
    const cmd = parseCommand('Set FontSize 16', 1);
    expect(cmd).toEqual({ type: 'Set', setting: 'FontSize', value: '16' });
  });

  it('should parse Type command', () => {
    const cmd = parseCommand('Type "hello world"', 1);
    expect(cmd).toEqual({ type: 'Type', text: 'hello world', speed: undefined });
  });

  it('should parse Type command with speed', () => {
    const cmd = parseCommand('Type@100ms "hello"', 1);
    expect(cmd).toEqual({ type: 'Type', text: 'hello', speed: 100 });
  });

  it('should parse arrow keys', () => {
    expect(parseCommand('Left', 1)).toEqual({ type: 'Key', key: 'Left' });
    expect(parseCommand('Right', 1)).toEqual({ type: 'Key', key: 'Right' });
    expect(parseCommand('Up', 1)).toEqual({ type: 'Key', key: 'Up' });
    expect(parseCommand('Down', 1)).toEqual({ type: 'Key', key: 'Down' });
  });

  it('should parse special keys', () => {
    expect(parseCommand('Enter', 1)).toEqual({ type: 'Key', key: 'Enter' });
    expect(parseCommand('Backspace', 1)).toEqual({ type: 'Key', key: 'Backspace' });
    expect(parseCommand('Tab', 1)).toEqual({ type: 'Key', key: 'Tab' });
    expect(parseCommand('Space', 1)).toEqual({ type: 'Key', key: 'Space' });
  });

  it('should parse Ctrl shortcuts', () => {
    const cmd = parseCommand('Ctrl+C', 1);
    expect(cmd).toEqual({ type: 'Shortcut', ctrl: true, alt: false, shift: false, cmd: false, key: 'C' });
  });

  it('should parse Ctrl+Alt shortcuts', () => {
    const cmd = parseCommand('Ctrl+Alt+T', 1);
    expect(cmd).toEqual({ type: 'Shortcut', ctrl: true, alt: true, shift: false, cmd: false, key: 'T' });
  });

  it('should parse Sleep command', () => {
    const cmd = parseCommand('Sleep 500ms', 1);
    expect(cmd).toEqual({ type: 'Sleep', duration: 500 });
  });

  it('should parse Wait command', () => {
    const cmd = parseCommand('Wait /done/', 1);
    expect(cmd.type).toBe('Wait');
    expect(cmd.pattern).toBeDefined();
  });

  it('should parse Hide/Show commands', () => {
    expect(parseCommand('Hide', 1)).toEqual({ type: 'Hide' });
    expect(parseCommand('Show', 1)).toEqual({ type: 'Show' });
  });

  it('should parse Screenshot command', () => {
    expect(parseCommand('Screenshot', 1)).toEqual({ type: 'Screenshot', path: undefined });
    expect(parseCommand('Screenshot final', 1)).toEqual({ type: 'Screenshot', path: 'final' });
  });

  it('should parse Copy/Paste commands', () => {
    expect(parseCommand('Copy "text"', 1)).toEqual({ type: 'Copy', text: 'text' });
    expect(parseCommand('Paste', 1)).toEqual({ type: 'Paste' });
  });

  it('should parse Env command', () => {
    const cmd = parseCommand('Env NODE_ENV production', 1);
    expect(cmd).toEqual({ type: 'Env', key: 'NODE_ENV', value: 'production' });
  });

  it('should parse comments', () => {
    expect(parseCommand('# This is a comment', 1)).toEqual({ type: 'Comment' });
    expect(parseCommand('', 1)).toEqual({ type: 'Comment' });
  });

  it('should throw on unknown command', () => {
    expect(() => parseCommand('UnknownCommand', 1)).toThrow('Unknown command');
  });
});

describe('parseDVD', () => {
  it('should parse a complete DVD script', () => {
    const script = `# Demo script
Output demo.svg
Require node

Set FontSize 16
Set Width 80

Type "hello"
Enter
Sleep 1s
`;

    const result = parseDVD(script);

    expect(result.output).toBe('demo.svg');
    expect(result.requirements).toEqual(['node']);
    expect(result.settings.get('FontSize')).toBe('16');
    expect(result.settings.get('Width')).toBe('80');
    expect(result.commands.length).toBeGreaterThan(0);
  });

  it('should handle empty lines and comments', () => {
    const script = `
# Comment
Output test.svg

# Another comment

Type "test"
`;

    const result = parseDVD(script);
    expect(result.output).toBe('test.svg');
  });

  it('should parse multiple commands', () => {
    const script = `Output test.svg
Type "line1"
Enter
Type "line2"
Enter
`;

    const result = parseDVD(script);
    const typeCommands = result.commands.filter((cmd) => cmd.type === 'Type');
    expect(typeCommands).toHaveLength(2);
  });
});
