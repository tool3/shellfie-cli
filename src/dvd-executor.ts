/**
 * DVD Command Executor
 * Executes real commands with typing effect and cursor
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DVDCommand, DVDScript } from './dvd-parser';
import { renderTerminalSVG, createTerminalState, type TerminalState } from './terminal-renderer';
import { themes, type Theme, shellfie } from 'shellfie';

export interface TerminalFrame {
  timestamp: number;
  svg: string;
  state: TerminalState;
}

export interface SimulatorContext {
  lines: string[];
  currentLine: string;
  cursorX: number;
  cursorY: number;
  frames: TerminalFrame[];
  clipboard: string;
  startTime: number;
  width: number;
  height: number;
  fontSize: number;
  typingSpeed: number; // milliseconds per character
  title?: string;
  template?: 'macos' | 'windows' | 'minimal';
  promptPrefix: string; // ANSI formatted prompt prefix
  theme?: Theme;
  cursorBlink: boolean; // Enable/disable cursor blinking
  selectionStart?: number; // Selection start position (for text selection)
  selectionEnd?: number; // Selection end position
  watermark?: string; // Watermark text to display
  screenshotCounter: number; // Counter for auto-named screenshots
  outputPath?: string; // Output path from DVD script
}

export interface DVDExecutorOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  title?: string;
  template?: 'macos' | 'windows' | 'minimal';
  theme?: Theme;
  onFrame?: (frame: TerminalFrame) => void;
  onProgress?: (current: number, total: number, description?: string) => void;
}

export class DVDExecutor {
  private context: SimulatorContext;
  private options: DVDExecutorOptions;

  constructor(options: DVDExecutorOptions = {}) {
    this.options = options;

    this.context = {
      lines: [''],
      currentLine: '',
      cursorX: 0,
      cursorY: 0,
      frames: [],
      clipboard: '',
      startTime: Date.now(),
      width: options.width || 800,
      height: options.height || 600,
      fontSize: options.fontSize || 14,
      typingSpeed: 50, // Default 50ms per character
      title: options.title,
      template: options.template || 'macos',
      promptPrefix: '\x1b[95m❯\x1b[0m ', // Default: pink > character
      cursorBlink: true, // Default: cursor blinks
      screenshotCounter: 0,
    };
  }

  /**
   * Capture current terminal state as a frame
   */
  private captureFrame(showCursor: boolean = true, activeCursor: boolean = false): void {
    const buffer = [...this.context.lines];
    buffer[this.context.cursorY] = this.context.currentLine;

    const state = createTerminalState(
      buffer.join('\n'),
      this.context.cursorX,
      this.context.cursorY,
      this.context.width,
      this.context.height,
      this.context.fontSize,
      showCursor,
      activeCursor,
      this.context.selectionStart,
      this.context.selectionEnd
    );

    const svg = renderTerminalSVG(state, {
      title: this.context.title,
      template: this.context.template,
      theme: this.context.theme,
      watermark: this.context.watermark,
    });

    const frame: TerminalFrame = {
      timestamp: Date.now() - this.context.startTime,
      svg,
      state,
    };

    this.context.frames.push(frame);
    this.options.onFrame?.(frame);
  }

  /**
   * Execute Type command - simulate typing character by character
   */
  private async executeType(text: string, speed?: number, prefix?: string): Promise<void> {
    const delay = speed || this.context.typingSpeed;
    const promptPrefix = prefix ?? this.context.promptPrefix;

    // If there's a selection, delete it first
    if (this.hasSelection()) {
      this.deleteSelection();
      this.captureFrame(true, true);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Check if we need to add a prefix
    // Add prefix if: line is empty OR line only contains the prefix already
    const shouldAddPrefix =
      promptPrefix &&
      (this.context.currentLine === '' || this.context.currentLine === promptPrefix);

    if (shouldAddPrefix && this.context.currentLine === '') {
      // Only add prefix if line is completely empty
      this.context.currentLine = promptPrefix;
      this.context.cursorX = this.stripAnsi(promptPrefix).length;
      this.captureFrame(true, true); // active cursor during prefix
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    for (const char of text) {
      this.context.currentLine += char;
      this.context.cursorX++;

      // Capture frame showing the new character with active cursor (no blink during typing)
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.captureFrame(true, true);
    }
  }

  /**
   * Strip ANSI escape codes to get actual string length
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Execute Enter - run the command and capture streaming output
   */
  private async executeEnter(): Promise<void> {
    const fullLine = this.context.currentLine;

    // Strip the prompt prefix from the command before executing
    // Check if the line starts with the prefix and remove it
    let command = fullLine;
    if (this.context.promptPrefix && fullLine.startsWith(this.context.promptPrefix)) {
      command = fullLine.slice(this.context.promptPrefix.length);
    }
    command = command.trim();

    // Finalize current line (the command that was typed - keep the visual prefix)
    this.context.lines[this.context.cursorY] = this.context.currentLine;

    // Move to next line
    this.context.cursorY++;
    this.context.cursorX = 0;
    this.context.currentLine = '';

    if (!this.context.lines[this.context.cursorY]) {
      this.context.lines[this.context.cursorY] = '';
    }

    // Capture frame showing command was submitted (cursor on new line)
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.captureFrame(true);

    // Execute the command if it's not empty
    if (command) {
      await this.executeCommandStreaming(command);
    }
  }

  /**
   * Execute command with streaming output support
   */
  private async executeCommandStreaming(command: string): Promise<void> {
    return new Promise((resolve) => {
      const child = spawn(command, [], {
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1', CLICOLOR_FORCE: '1' },
      });

      let outputBuffer = '';
      let lastFrameTime = Date.now();
      const FRAME_INTERVAL = 100; // Capture frame every 100ms when output is streaming

      const processOutput = (data: string) => {
        outputBuffer += data;

        // Process complete lines
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          this.context.lines[this.context.cursorY] = line;
          this.context.cursorY++;
          this.context.lines[this.context.cursorY] = '';

          // Capture frame if enough time has passed (for animations)
          const now = Date.now();
          if (now - lastFrameTime >= FRAME_INTERVAL) {
            this.captureFrame(true);
            lastFrameTime = now;
          }
        }
      };

      child.stdout?.on('data', (data: Buffer) => {
        processOutput(data.toString());
      });

      child.stderr?.on('data', (data: Buffer) => {
        processOutput(data.toString());
      });

      child.on('close', () => {
        // Process any remaining buffered output
        if (outputBuffer) {
          this.context.lines[this.context.cursorY] = outputBuffer;
          this.context.cursorY++;
          this.context.lines[this.context.cursorY] = '';
        }

        // Add prompt prefix to the new line after command completes
        this.context.currentLine = this.context.promptPrefix;
        this.context.cursorX = this.stripAnsi(this.context.promptPrefix).length;

        // Capture final frame with cursor on new line with prefix
        setTimeout(() => {
          this.captureFrame(true);
          resolve();
        }, 100);
      });

      child.on('error', (err) => {
        this.context.lines[this.context.cursorY] = `Command failed: ${err.message}`;
        this.context.cursorY++;
        this.context.lines[this.context.cursorY] = '';

        // Add prompt prefix to the new line after error
        this.context.currentLine = this.context.promptPrefix;
        this.context.cursorX = this.stripAnsi(this.context.promptPrefix).length;

        this.captureFrame(true);
        resolve();
      });
    });
  }

  /**
   * Execute arrow keys
   */
  private async executeArrow(direction: 'Left' | 'Right' | 'Up' | 'Down'): Promise<void> {
    switch (direction) {
      case 'Left':
        if (this.context.cursorX > 0) this.context.cursorX--;
        break;
      case 'Right':
        if (this.context.cursorX < this.context.currentLine.length) this.context.cursorX++;
        break;
      case 'Up':
        if (this.context.cursorY > 0) {
          this.context.cursorY--;
          this.context.currentLine = this.context.lines[this.context.cursorY];
          this.context.cursorX = Math.min(this.context.cursorX, this.context.currentLine.length);
        }
        break;
      case 'Down':
        if (this.context.cursorY < this.context.lines.length - 1) {
          this.context.cursorY++;
          this.context.currentLine = this.context.lines[this.context.cursorY];
          this.context.cursorX = Math.min(this.context.cursorX, this.context.currentLine.length);
        }
        break;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    this.captureFrame(true, true); // active cursor during arrow key movement
  }

  /**
   * Execute Screenshot - save current terminal state as static SVG using shellfie
   */
  private async executeScreenshot(path?: string): Promise<void> {
    // Determine the screenshot path
    let screenshotPath: string;
    if (path) {
      screenshotPath = path;
    } else {
      // Auto-generate name based on Output path
      const baseName = this.context.outputPath
        ? this.context.outputPath.replace(/\.svg$/, '')
        : 'screenshot';
      screenshotPath = `${baseName}_screenshot_${this.context.screenshotCounter}.svg`;
      this.context.screenshotCounter++;
    }

    // Get current terminal content
    const buffer = [...this.context.lines];
    buffer[this.context.cursorY] = this.context.currentLine;
    const content = buffer.join('\n');

    // Use shellfie to generate static SVG
    // Note: Don't pass width - shellfie auto-sizes based on content
    const svg = shellfie(content, {
      fontSize: this.context.fontSize,
      title: this.context.title,
      template: this.context.template,
      theme: this.context.theme,
      watermark: this.context.watermark,
    });

    // Write to file
    writeFileSync(resolve(screenshotPath), svg, 'utf-8');
  }

  /**
   * Execute Backspace - delete characters with animation
   */
  private async executeBackspace(count: number = 1): Promise<void> {
    const delay = this.context.typingSpeed;

    // If there's a selection, delete it instead of normal backspace
    if (this.hasSelection()) {
      this.deleteSelection();
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.captureFrame(true, true);
      return;
    }

    for (let i = 0; i < count; i++) {
      if (this.context.currentLine.length > 0) {
        // Always delete from the end of the line (like a real terminal)
        this.context.currentLine = this.context.currentLine.slice(0, -1);
        this.context.cursorX--;

        await new Promise((resolve) => setTimeout(resolve, delay));
        this.captureFrame(true, true); // active cursor during backspace
      }
    }
  }

  /**
   * Execute keyboard shortcut with modifiers
   */
  private async executeShortcut(
    ctrl: boolean,
    alt: boolean,
    shift: boolean,
    cmd: boolean,
    key: string
  ): Promise<void> {
    // Normalize Cmd to Ctrl for cross-platform compatibility
    const metaKey = cmd || ctrl;

    // Handle different shortcut combinations
    if (shift && !alt && !metaKey) {
      // Shift + Arrow keys = Selection
      if (key === 'Left' || key === 'Right') {
        await this.executeSelectionMove(key === 'Right', shift);
      }
    } else if (alt && shift && !metaKey) {
      // Alt + Shift + Arrow = Word selection
      if (key === 'Left' || key === 'Right') {
        await this.executeWordSelection(key === 'Right');
      }
    } else if (alt && !shift && !metaKey) {
      // Alt + Arrow = Word movement
      if (key === 'Left' || key === 'Right') {
        await this.executeWordMove(key === 'Right');
      }
    } else if (metaKey && !alt && !shift) {
      // Cmd/Ctrl + Arrow = Line navigation
      if (key === 'Left' || key === 'Right') {
        await this.executeLineNavigation(key === 'Right');
      } else if (key === 'Backspace') {
        await this.executeWordDelete();
      }
    }
  }

  /**
   * Execute selection movement (Shift + Left/Right)
   */
  private async executeSelectionMove(right: boolean, shift: boolean): Promise<void> {
    const strippedLine = this.stripAnsi(this.context.currentLine);

    // Initialize selection anchor if not already set
    if (!shift || (this.context.selectionStart === undefined && this.context.selectionEnd === undefined)) {
      this.context.selectionStart = this.context.cursorX;
      this.context.selectionEnd = this.context.cursorX;
    }

    // Move cursor
    if (right) {
      if (this.context.cursorX < strippedLine.length) {
        this.context.cursorX++;
      }
    } else {
      if (this.context.cursorX > 0) {
        this.context.cursorX--;
      }
    }

    // Update selection end
    if (shift) {
      this.context.selectionEnd = this.context.cursorX;
    } else {
      this.clearSelection();
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    this.captureFrame(true, true);
  }

  /**
   * Execute word movement (Alt + Left/Right)
   */
  private async executeWordMove(right: boolean): Promise<void> {
    const strippedLine = this.stripAnsi(this.context.currentLine);
    this.clearSelection(); // Clear any selection

    const direction = right ? 'right' : 'left';
    const newPosition = this.findWordBoundary(direction, this.context.cursorX, this.context.currentLine);
    this.context.cursorX = newPosition;

    await new Promise((resolve) => setTimeout(resolve, 50));
    this.captureFrame(true, true);
  }

  /**
   * Execute word selection (Alt + Shift + Left/Right)
   */
  private async executeWordSelection(right: boolean): Promise<void> {
    // Initialize selection if not set
    if (this.context.selectionStart === undefined) {
      this.context.selectionStart = this.context.cursorX;
      this.context.selectionEnd = this.context.cursorX;
    }

    const direction = right ? 'right' : 'left';
    const newPosition = this.findWordBoundary(direction, this.context.cursorX, this.context.currentLine);
    this.context.cursorX = newPosition;
    this.context.selectionEnd = newPosition;

    await new Promise((resolve) => setTimeout(resolve, 50));
    this.captureFrame(true, true);
  }

  /**
   * Execute line navigation (Cmd/Ctrl + Left/Right)
   */
  private async executeLineNavigation(toEnd: boolean): Promise<void> {
    const strippedLine = this.stripAnsi(this.context.currentLine);
    this.clearSelection(); // Clear any selection

    if (toEnd) {
      // Move to end of line
      this.context.cursorX = strippedLine.length;
    } else {
      // Move to beginning of line (after prompt if it exists)
      const promptLength = this.context.promptPrefix ? this.stripAnsi(this.context.promptPrefix).length : 0;
      this.context.cursorX = promptLength;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    this.captureFrame(true, true);
  }

  /**
   * Execute word deletion (Cmd/Ctrl + Backspace)
   */
  private async executeWordDelete(): Promise<void> {
    const delay = this.context.typingSpeed;
    const strippedLine = this.stripAnsi(this.context.currentLine);

    // Find word boundary to the left
    const wordStart = this.findWordBoundary('left', this.context.cursorX, this.context.currentLine);

    // Calculate how many characters to delete
    const deleteCount = this.context.cursorX - wordStart;

    if (deleteCount <= 0) return;

    // Animate deletion character by character
    for (let i = 0; i < deleteCount; i++) {
      if (this.context.currentLine.length > 0) {
        this.context.currentLine = this.context.currentLine.slice(0, -1);
        this.context.cursorX--;

        await new Promise((resolve) => setTimeout(resolve, delay / 2)); // Faster than regular backspace
        this.captureFrame(true, true);
      }
    }
  }

  /**
   * Check if there's an active selection
   */
  private hasSelection(): boolean {
    return (
      this.context.selectionStart !== undefined &&
      this.context.selectionEnd !== undefined &&
      this.context.selectionStart !== this.context.selectionEnd
    );
  }

  /**
   * Get selected text
   */
  private getSelectedText(): string {
    if (!this.hasSelection()) return '';

    const start = Math.min(this.context.selectionStart!, this.context.selectionEnd!);
    const end = Math.max(this.context.selectionStart!, this.context.selectionEnd!);

    const strippedLine = this.stripAnsi(this.context.currentLine);
    return strippedLine.substring(start, end);
  }

  /**
   * Clear selection
   */
  private clearSelection(): void {
    this.context.selectionStart = undefined;
    this.context.selectionEnd = undefined;
  }

  /**
   * Delete selected text and return true if selection was deleted
   */
  private deleteSelection(): boolean {
    if (!this.hasSelection()) return false;

    const start = Math.min(this.context.selectionStart!, this.context.selectionEnd!);
    const end = Math.max(this.context.selectionStart!, this.context.selectionEnd!);

    // Map visual positions to actual positions in currentLine (with ANSI codes)
    const strippedLine = this.stripAnsi(this.context.currentLine);
    const before = strippedLine.substring(0, start);
    const after = strippedLine.substring(end);

    // Rebuild line - this is simplified, should preserve ANSI codes properly
    this.context.currentLine = before + after;
    this.context.cursorX = start;
    this.clearSelection();

    return true;
  }

  /**
   * Find word boundary in the given direction
   * Returns the position of the word boundary
   */
  private findWordBoundary(direction: 'left' | 'right', position: number, text: string): number {
    const stripped = this.stripAnsi(text);

    if (direction === 'left') {
      // Move left to find word boundary
      if (position === 0) return 0;

      let pos = position - 1;

      // Skip whitespace
      while (pos > 0 && /\s/.test(stripped[pos])) {
        pos--;
      }

      // Skip word characters
      if (/\w/.test(stripped[pos])) {
        while (pos > 0 && /\w/.test(stripped[pos - 1])) {
          pos--;
        }
      } else if (/\S/.test(stripped[pos])) {
        // Skip punctuation (non-whitespace, non-word)
        while (pos > 0 && /[^\w\s]/.test(stripped[pos - 1])) {
          pos--;
        }
      }

      return pos;
    } else {
      // Move right to find word boundary
      if (position >= stripped.length) return stripped.length;

      let pos = position;

      // Skip whitespace
      while (pos < stripped.length && /\s/.test(stripped[pos])) {
        pos++;
      }

      // Skip word characters
      if (pos < stripped.length && /\w/.test(stripped[pos])) {
        while (pos < stripped.length && /\w/.test(stripped[pos])) {
          pos++;
        }
      } else if (pos < stripped.length && /\S/.test(stripped[pos])) {
        // Skip punctuation
        while (pos < stripped.length && /[^\w\s]/.test(stripped[pos])) {
          pos++;
        }
      }

      return pos;
    }
  }

  /**
   * Execute a single command
   */
  private async executeCommand(command: DVDCommand): Promise<void> {
    switch (command.type) {
      case 'Type':
        await this.executeType(command.text, command.speed, command.prefix);
        break;

      case 'Key':
        if (['Left', 'Right', 'Up', 'Down'].includes(command.key)) {
          const count = command.count || 1;
          for (let i = 0; i < count; i++) {
            await this.executeArrow(command.key as 'Left' | 'Right' | 'Up' | 'Down');
          }
        } else if (command.key === 'Enter') {
          await this.executeEnter();
        } else if (command.key === 'Backspace') {
          await this.executeBackspace(command.count || 1);
        } else if (command.key === 'Space') {
          const count = command.count || 1;
          await this.executeType(' '.repeat(count));
        } else if (command.key === 'Tab') {
          const count = command.count || 1;
          await this.executeType('    '.repeat(count)); // 4 spaces per tab
        }
        break;

      case 'Sleep':
        await new Promise((resolve) => setTimeout(resolve, command.duration));
        this.captureFrame(true);
        break;

      case 'Screenshot':
        await this.executeScreenshot(command.path);
        break;

      case 'Copy':
        this.context.clipboard = command.text;
        break;

      case 'Paste':
        if (this.context.clipboard) {
          await this.executeType(this.context.clipboard);
        }
        break;

      case 'Shortcut':
        await this.executeShortcut(command.ctrl, command.alt, command.shift, command.cmd, command.key);
        break;

      case 'Hide':
      case 'Show':
      case 'Output':
      case 'Require':
      case 'Set':
      case 'Source':
      case 'Env':
      case 'Comment':
      case 'Wait':
        // Not implemented in simulation mode
        break;
    }
  }

  /**
   * Execute complete DVD script
   */
  async execute(script: DVDScript): Promise<TerminalFrame[]> {
    // Apply settings
    for (const [key, value] of script.settings.entries()) {
      if (key === 'Width') this.context.width = parseInt(value, 10);
      if (key === 'Height') this.context.height = parseInt(value, 10);
      if (key === 'FontSize') this.context.fontSize = parseInt(value, 10);
      if (key === 'TypingSpeed') this.context.typingSpeed = parseInt(value, 10);
      if (key === 'Title') this.context.title = value;
      if (key === 'Template') this.context.template = value as any;
      if (key === 'Theme') {
        // Look up theme from shellfie themes
        const themeName = value as keyof typeof themes;
        if (themes[themeName]) {
          this.context.theme = themes[themeName];
        }
      }
      if (key === 'PromptPrefix') {
        // Parse the string to handle escape sequences
        this.context.promptPrefix = value
          .replace(/\\e/g, '\x1b')
          .replace(/\\x1b/g, '\x1b')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t');
      }
      if (key === 'Watermark') {
        // Parse the string to handle escape sequences (same as PromptPrefix)
        this.context.watermark = value
          .replace(/\\e/g, '\x1b')
          .replace(/\\x1b/g, '\x1b')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t');
      }
      if (key === 'CursorBlink') {
        this.context.cursorBlink = value.toLowerCase() !== 'false';
      }
    }

    // Store output path for auto-naming screenshots
    this.context.outputPath = script.output;

    // Capture initial frame
    this.captureFrame(true);

    // Execute commands
    const actionCommands = script.commands.filter(
      (cmd) => !['Output', 'Require', 'Set', 'Env'].includes(cmd.type)
    );

    for (let i = 0; i < actionCommands.length; i++) {
      const cmd = actionCommands[i];

      // Create progress message with command type BEFORE executing
      let cmdDescription: string = cmd.type;
      if (cmd.type === 'Key') {
        cmdDescription = cmd.key;
      }

      this.options.onProgress?.(i + 1, actionCommands.length, cmdDescription);

      // Now execute the command
      await this.executeCommand(cmd);
    }

    // Capture final frame without cursor
    this.captureFrame(false);

    return this.context.frames;
  }

  /**
   * Get all captured frames
   */
  getFrames(): TerminalFrame[] {
    return this.context.frames;
  }

  /**
   * Cleanup (no-op for simulation)
   */
  async cleanup(): Promise<void> {
    // Nothing to clean up in simulation mode
  }
}
