/**
 * Minimal spinner implementation with zero dependencies.
 * Shows a spinning animation while processing.
 */

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL = 80;

export interface Spinner {
  start(): void;
  stop(): void;
  success(message: string): void;
  fail(message: string): void;
}

export function createSpinner(text: string): Spinner {
  let frameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let currentText = text;

  const clearLine = (): void => {
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  };

  const render = (): void => {
    clearLine();
    const frame = SPINNER_FRAMES[frameIndex];
    process.stdout.write(`${frame} ${currentText}`);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  };

  return {
    start(): void {
      if (!process.stdout.isTTY) {
        // Non-TTY: just print the message once
        console.log(`... ${currentText}`);
        return;
      }
      render();
      intervalId = setInterval(render, FRAME_INTERVAL);
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      clearLine();
    },

    success(message: string): void {
      this.stop();
      console.log(`\x1b[32m✓ ${message}\x1b[0m`);
    },

    fail(message: string): void {
      this.stop();
      console.log(`\x1b[31m✗ ${message}\x1b[0m`);
    },
  };
}
