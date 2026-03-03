/**
 * DVD Command Executor
 * Executes .dvd commands and captures terminal state snapshots
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { DVDCommand, DVDScript } from './dvd-parser';

export interface TerminalFrame {
  timestamp: number;
  output: string;
  cursor?: { x: number; y: number };
}

export interface ExecutionContext {
  shell: ChildProcess | null;
  buffer: string;
  frames: TerminalFrame[];
  clipboard: string;
  env: NodeJS.ProcessEnv;
  hideCommands: boolean;
  startTime: number;
}

export interface DVDExecutorOptions {
  shell?: string;
  cwd?: string;
  width?: number;
  height?: number;
  onFrame?: (frame: TerminalFrame) => void;
  onProgress?: (current: number, total: number) => void;
}

export class DVDExecutor {
  private context: ExecutionContext;
  private options: DVDExecutorOptions;
  private waitResolvers: Array<(value: boolean) => void> = [];

  constructor(options: DVDExecutorOptions = {}) {
    this.options = {
      ...options,
      shell: options.shell || process.env.SHELL || '/bin/bash',
      cwd: options.cwd || process.cwd(),
      width: options.width || 80,
      height: options.height || 24,
    };

    this.context = {
      shell: null,
      buffer: '',
      frames: [],
      clipboard: '',
      env: { ...process.env },
      hideCommands: false,
      startTime: Date.now(),
    };
  }

  /**
   * Initialize the shell process
   */
  private async initShell(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use -i flag to force interactive mode for bash-like shells
      const shellArgs = this.options.shell?.includes('bash') ? ['-i'] : [];

      this.context.shell = spawn(this.options.shell!, shellArgs, {
        cwd: this.options.cwd,
        env: {
          ...this.context.env,
          TERM: 'xterm-256color',
          COLUMNS: String(this.options.width),
          LINES: String(this.options.height),
          PS1: '$ ', // Set a simple prompt
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.context.shell.stdout || !this.context.shell.stdin) {
        reject(new Error('Failed to initialize shell'));
        return;
      }

      this.context.shell.stdout.on('data', (data: Buffer) => {
        this.context.buffer += data.toString();
        this.checkWaitConditions();
      });

      this.context.shell.stderr?.on('data', (data: Buffer) => {
        this.context.buffer += data.toString();
        this.checkWaitConditions();
      });

      this.context.shell.on('error', reject);

      // Wait a bit for shell to initialize
      setTimeout(resolve, 100);
    });
  }

  /**
   * Capture the current terminal state as a frame
   */
  private captureFrame(): TerminalFrame {
    const frame: TerminalFrame = {
      timestamp: Date.now() - this.context.startTime,
      output: this.context.buffer,
    };

    // Debug logging
    if (process.env.DEBUG_DVD) {
      console.log(`Frame ${this.context.frames.length}: ${JSON.stringify(this.context.buffer.slice(0, 100))}`);
    }

    this.context.frames.push(frame);
    this.options.onFrame?.(frame);

    return frame;
  }

  /**
   * Write to shell stdin
   */
  private async writeToShell(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.context.shell?.stdin) {
        resolve();
        return;
      }

      this.context.shell.stdin.write(text, () => {
        resolve();
      });
    });
  }

  /**
   * Check wait conditions
   */
  private checkWaitConditions(): void {
    // Notify any waiting commands
    this.waitResolvers.forEach((resolve) => resolve(true));
    this.waitResolvers = [];
  }

  /**
   * Wait for a condition or pattern
   */
  private async waitForCondition(
    condition?: 'Screen' | 'Line',
    pattern?: RegExp
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!pattern) {
        // Simple wait for any output change
        this.waitResolvers.push(() => resolve());
        return;
      }

      const checkPattern = () => {
        const target = condition === 'Line'
          ? this.context.buffer.split('\n').pop() || ''
          : this.context.buffer;

        if (pattern.test(target)) {
          resolve();
        } else {
          this.waitResolvers.push(() => {
            checkPattern();
          });
        }
      };

      checkPattern();
    });
  }

  /**
   * Execute a Type command
   */
  private async executeType(text: string, speed?: number): Promise<void> {
    const delay = speed || 50; // Default 50ms per character

    for (const char of text) {
      await this.writeToShell(char);
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (!this.context.hideCommands) {
        this.captureFrame();
      }
    }
  }

  /**
   * Execute a Key command
   */
  private async executeKey(key: string): Promise<void> {
    const keyMap: Record<string, string> = {
      Left: '\x1b[D',
      Right: '\x1b[C',
      Up: '\x1b[A',
      Down: '\x1b[B',
      Backspace: '\x7f',
      Enter: '\n',
      Tab: '\t',
      Space: ' ',
    };

    const sequence = keyMap[key];
    if (sequence) {
      await this.writeToShell(sequence);
      // Wait longer for Enter to allow shell command execution
      const delay = key === 'Enter' ? 300 : 50;
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.captureFrame();
    }
  }

  /**
   * Execute a Shortcut command
   */
  private async executeShortcut(
    ctrl: boolean,
    alt: boolean,
    shift: boolean,
    key: string
  ): Promise<void> {
    let sequence = '';

    // Convert key to control sequence
    if (ctrl) {
      const code = key.toUpperCase().charCodeAt(0) - 64;
      sequence = String.fromCharCode(code);
    } else {
      sequence = key;
    }

    if (alt) {
      sequence = `\x1b${sequence}`;
    }

    await this.writeToShell(sequence);
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.captureFrame();
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
        await this.executeKey(command.key);
        break;

      case 'Shortcut':
        await this.executeShortcut(
          command.ctrl,
          command.alt,
          command.shift,
          command.key
        );
        break;

      case 'Sleep':
        await new Promise((resolve) => setTimeout(resolve, command.duration));
        this.captureFrame();
        break;

      case 'Wait':
        await this.waitForCondition(command.condition, command.pattern);
        this.captureFrame();
        break;

      case 'Hide':
        this.context.hideCommands = true;
        break;

      case 'Show':
        this.context.hideCommands = false;
        break;

      case 'Screenshot':
        this.captureFrame();
        break;

      case 'Copy':
        this.context.clipboard = command.text;
        break;

      case 'Paste':
        if (this.context.clipboard) {
          await this.executeType(this.context.clipboard);
        }
        break;

      case 'Env':
        this.context.env[command.key] = command.value;
        break;

      case 'Output':
      case 'Require':
      case 'Set':
      case 'Source':
      case 'Comment':
        // These are handled at parse time or are no-ops during execution
        break;
    }
  }

  /**
   * Execute a complete DVD script
   */
  async execute(script: DVDScript): Promise<TerminalFrame[]> {
    // Apply environment variables from script
    for (const command of script.commands) {
      if (command.type === 'Env') {
        this.context.env[command.key] = command.value;
      }
    }

    await this.initShell();

    // Capture initial frame
    this.captureFrame();

    // Execute commands
    const actionCommands = script.commands.filter(
      (cmd) => !['Output', 'Require', 'Set', 'Env'].includes(cmd.type)
    );

    for (let i = 0; i < actionCommands.length; i++) {
      await this.executeCommand(actionCommands[i]);
      this.options.onProgress?.(i + 1, actionCommands.length);
    }

    // Capture final frame
    this.captureFrame();

    // Cleanup
    await this.cleanup();

    return this.context.frames;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.context.shell) {
      this.context.shell.kill();
      this.context.shell = null;
    }
  }

  /**
   * Get all captured frames
   */
  getFrames(): TerminalFrame[] {
    return this.context.frames;
  }
}

/**
 * Check if required programs are available
 */
export const checkRequirements = async (requirements: string[]): Promise<string[]> => {
  const missing: string[] = [];

  for (const program of requirements) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('which', [program], { stdio: 'ignore' });
        proc.on('exit', (code) => (code === 0 ? resolve() : reject()));
        proc.on('error', reject);
      });
    } catch {
      missing.push(program);
    }
  }

  return missing;
};
