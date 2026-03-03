/**
 * DVD (Dynamic Video Display) Format Parser
 * Zero-dependency parser for .dvd scripting format
 * Inspired by VHS .tape format but for animated SVGs
 */

export type DVDCommand =
  | { type: 'Output'; path: string }
  | { type: 'Require'; program: string }
  | { type: 'Set'; setting: string; value: string }
  | { type: 'Type'; text: string; speed?: number }
  | { type: 'Key'; key: 'Left' | 'Right' | 'Up' | 'Down' | 'Backspace' | 'Enter' | 'Tab' | 'Space' }
  | { type: 'Shortcut'; ctrl: boolean; alt: boolean; shift: boolean; key: string }
  | { type: 'Sleep'; duration: number }
  | { type: 'Wait'; condition?: 'Screen' | 'Line'; pattern?: RegExp }
  | { type: 'Hide' }
  | { type: 'Show' }
  | { type: 'Screenshot'; name?: string }
  | { type: 'Copy'; text: string }
  | { type: 'Paste' }
  | { type: 'Source'; file: string }
  | { type: 'Env'; key: string; value: string }
  | { type: 'Comment' };

export interface DVDScript {
  commands: DVDCommand[];
  settings: Map<string, string>;
  output?: string;
  requirements: string[];
}

export class DVDParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(`Parse error at line ${line}, column ${column}: ${message}`);
    this.name = 'DVDParseError';
  }
}

/**
 * Parse a time duration string (e.g., "500ms", "2s", "1.5s")
 */
export const parseDuration = (duration: string): number => {
  const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  return unit === 's' ? value * 1000 : value;
};

/**
 * Parse a regex pattern from string (e.g., "/pattern/", "/pattern/i")
 */
export const parseRegex = (pattern: string): RegExp => {
  const match = pattern.match(/^\/(.+?)\/([gimsuvy]*)$/);
  if (!match) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
  return new RegExp(match[1], match[2]);
};

/**
 * Parse a quoted string, handling escape sequences
 */
export const parseQuotedString = (str: string): string => {
  if (!str.startsWith('"') || !str.endsWith('"')) {
    throw new Error(`Expected quoted string, got: ${str}`);
  }

  const content = str.slice(1, -1);
  return content
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
};

/**
 * Tokenize a line into command and arguments
 */
export const tokenizeLine = (line: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (!inQuotes && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

/**
 * Parse a single command line
 */
export const parseCommand = (line: string, lineNumber: number): DVDCommand => {
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) {
    return { type: 'Comment' };
  }

  // Skip comments
  if (trimmed.startsWith('#')) {
    return { type: 'Comment' };
  }

  const tokens = tokenizeLine(trimmed);
  if (tokens.length === 0) {
    return { type: 'Comment' };
  }

  const command = tokens[0];

  try {
    // Output command
    if (command === 'Output') {
      if (tokens.length < 2) {
        throw new Error('Output command requires a path');
      }
      return { type: 'Output', path: tokens[1] };
    }

    // Require command
    if (command === 'Require') {
      if (tokens.length < 2) {
        throw new Error('Require command requires a program name');
      }
      return { type: 'Require', program: tokens[1] };
    }

    // Set command
    if (command === 'Set') {
      if (tokens.length < 3) {
        throw new Error('Set command requires a setting name and value');
      }
      return { type: 'Set', setting: tokens[1], value: tokens.slice(2).join(' ') };
    }

    // Type command with optional speed override
    if (command === 'Type' || command.startsWith('Type@')) {
      let speed: number | undefined;
      if (command.includes('@')) {
        const speedStr = command.split('@')[1];
        speed = parseDuration(speedStr);
      }

      if (tokens.length < 2) {
        throw new Error('Type command requires text to type');
      }

      const text = parseQuotedString(tokens.slice(1).join(' '));
      return { type: 'Type', text, speed };
    }

    // Arrow keys
    if (['Left', 'Right', 'Up', 'Down'].includes(command)) {
      return { type: 'Key', key: command as 'Left' | 'Right' | 'Up' | 'Down' };
    }

    // Special keys
    if (['Backspace', 'Enter', 'Tab', 'Space'].includes(command)) {
      return { type: 'Key', key: command as 'Backspace' | 'Enter' | 'Tab' | 'Space' };
    }

    // Ctrl/Alt/Shift combinations
    if (command.startsWith('Ctrl')) {
      const parts = command.split('+');
      const ctrl = parts.includes('Ctrl');
      const alt = parts.includes('Alt');
      const shift = parts.includes('Shift');
      const key = parts[parts.length - 1];

      if (!key || key === 'Ctrl' || key === 'Alt' || key === 'Shift') {
        throw new Error('Shortcut command requires a key');
      }

      return { type: 'Shortcut', ctrl, alt, shift, key };
    }

    // Sleep command
    if (command === 'Sleep') {
      if (tokens.length < 2) {
        throw new Error('Sleep command requires a duration');
      }
      return { type: 'Sleep', duration: parseDuration(tokens[1]) };
    }

    // Wait command
    if (command === 'Wait' || command === 'WaitScreen' || command === 'WaitLine') {
      let condition: 'Screen' | 'Line' | undefined;
      let patternToken = tokens[1];

      if (command === 'WaitScreen') {
        condition = 'Screen';
      } else if (command === 'WaitLine') {
        condition = 'Line';
      }

      const pattern = patternToken ? parseRegex(patternToken) : undefined;
      return { type: 'Wait', condition, pattern };
    }

    // Hide/Show commands
    if (command === 'Hide') {
      return { type: 'Hide' };
    }

    if (command === 'Show') {
      return { type: 'Show' };
    }

    // Screenshot command
    if (command === 'Screenshot') {
      const name = tokens[1];
      return { type: 'Screenshot', name };
    }

    // Copy command
    if (command === 'Copy') {
      if (tokens.length < 2) {
        throw new Error('Copy command requires text to copy');
      }
      const text = parseQuotedString(tokens.slice(1).join(' '));
      return { type: 'Copy', text };
    }

    // Paste command
    if (command === 'Paste') {
      return { type: 'Paste' };
    }

    // Source command
    if (command === 'Source') {
      if (tokens.length < 2) {
        throw new Error('Source command requires a file path');
      }
      return { type: 'Source', file: tokens[1] };
    }

    // Env command
    if (command === 'Env') {
      if (tokens.length < 3) {
        throw new Error('Env command requires a key and value');
      }
      return { type: 'Env', key: tokens[1], value: tokens.slice(2).join(' ') };
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (err) {
    throw new DVDParseError(
      err instanceof Error ? err.message : String(err),
      lineNumber,
      0
    );
  }
};

/**
 * Parse a complete .dvd script
 */
export const parseDVD = (content: string): DVDScript => {
  const lines = content.split('\n');
  const commands: DVDCommand[] = [];
  const settings = new Map<string, string>();
  const requirements: string[] = [];
  let output: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const command = parseCommand(lines[i], i + 1);

    if (command.type === 'Comment') {
      continue;
    }

    if (command.type === 'Output') {
      output = command.path;
    } else if (command.type === 'Require') {
      requirements.push(command.program);
    } else if (command.type === 'Set') {
      settings.set(command.setting, command.value);
    }

    commands.push(command);
  }

  return {
    commands,
    settings,
    output,
    requirements,
  };
};
