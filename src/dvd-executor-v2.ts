/**
 * DVD Command Executor V2
 * Executes real commands with typing effect and cursor
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { DVDCommand, DVDScript } from './dvd-parser';
import { renderTerminalSVG, createTerminalState, type TerminalState } from './terminal-renderer';

const execAsync = promisify(exec);

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
  title?: string;
  template?: 'macos' | 'windows' | 'minimal';
}

export interface DVDExecutorOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  title?: string;
  template?: 'macos' | 'windows' | 'minimal';
  onFrame?: (frame: TerminalFrame) => void;
  onProgress?: (current: number, total: number) => void;
}

export class DVDExecutorV2 {
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
      title: options.title,
      template: options.template || 'macos',
    };
  }

  /**
   * Capture current terminal state as a frame
   */
  private captureFrame(showCursor: boolean = true): void {
    const buffer = [...this.context.lines];
    buffer[this.context.cursorY] = this.context.currentLine;

    const state = createTerminalState(
      buffer.join('\n'),
      this.context.cursorX,
      this.context.cursorY,
      this.context.width,
      this.context.height,
      this.context.fontSize,
      showCursor
    );

    const svg = renderTerminalSVG(state, {
      title: this.context.title,
      template: this.context.template,
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
  private async executeType(text: string, speed?: number): Promise<void> {
    const delay = speed || 50;

    for (const char of text) {
      this.context.currentLine += char;
      this.context.cursorX++;

      // Capture frame showing the new character with cursor
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.captureFrame(true);
    }
  }

  /**
   * Execute Enter - run the command and capture output
   */
  private async executeEnter(): Promise<void> {
    const command = this.context.currentLine.trim();

    // Finalize current line (the command that was typed)
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
      try {
        const { stdout, stderr } = await execAsync(command, {
          env: { ...process.env, FORCE_COLOR: '1', CLICOLOR_FORCE: '1' },
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        const output = (stdout + stderr).trim();
        if (output) {
          // Split output into lines and add to terminal
          const outputLines = output.split('\n');
          for (const line of outputLines) {
            this.context.lines[this.context.cursorY] = line;
            this.context.cursorY++;
            this.context.lines[this.context.cursorY] = '';
          }

          // Capture frame showing command output
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.captureFrame(true);
        }
      } catch (err) {
        // Command failed - show error output
        const error = err as { stderr?: string; stdout?: string };
        const errorOutput = (error.stderr || error.stdout || 'Command failed').trim();
        const errorLines = errorOutput.split('\n');

        for (const line of errorLines) {
          this.context.lines[this.context.cursorY] = line;
          this.context.cursorY++;
          this.context.lines[this.context.cursorY] = '';
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        this.captureFrame(true);
      }
    }
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
    this.captureFrame(true);
  }

  /**
   * Execute Backspace
   */
  private async executeBackspace(): Promise<void> {
    if (this.context.cursorX > 0) {
      this.context.currentLine =
        this.context.currentLine.slice(0, this.context.cursorX - 1) +
        this.context.currentLine.slice(this.context.cursorX);
      this.context.cursorX--;

      await new Promise((resolve) => setTimeout(resolve, 50));
      this.captureFrame(true);
    }
  }

  /**
   * Execute a single command
   */
  private async executeCommand(command: DVDCommand): Promise<void> {
    switch (command.type) {
      case 'Type':
        await this.executeType(command.text, command.speed);
        break;

      case 'Key':
        if (['Left', 'Right', 'Up', 'Down'].includes(command.key)) {
          await this.executeArrow(command.key as 'Left' | 'Right' | 'Up' | 'Down');
        } else if (command.key === 'Enter') {
          await this.executeEnter();
        } else if (command.key === 'Backspace') {
          await this.executeBackspace();
        } else if (command.key === 'Space') {
          await this.executeType(' ');
        } else if (command.key === 'Tab') {
          await this.executeType('    '); // 4 spaces
        }
        break;

      case 'Sleep':
        await new Promise((resolve) => setTimeout(resolve, command.duration));
        this.captureFrame(true);
        break;

      case 'Screenshot':
        this.captureFrame(true);
        break;

      case 'Copy':
        this.context.clipboard = command.text;
        break;

      case 'Paste':
        if (this.context.clipboard) {
          await this.executeType(this.context.clipboard);
        }
        break;

      case 'Hide':
      case 'Show':
      case 'Output':
      case 'Require':
      case 'Set':
      case 'Source':
      case 'Env':
      case 'Comment':
      case 'Shortcut':
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
      if (key === 'Title') this.context.title = value;
      if (key === 'Template') this.context.template = value as any;
    }

    // Capture initial frame
    this.captureFrame(true);

    // Execute commands
    const actionCommands = script.commands.filter(
      (cmd) => !['Output', 'Require', 'Set', 'Env'].includes(cmd.type)
    );

    for (let i = 0; i < actionCommands.length; i++) {
      await this.executeCommand(actionCommands[i]);
      this.options.onProgress?.(i + 1, actionCommands.length);
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
