import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpinner } from './spinner';

describe('createSpinner', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalIsTTY = process.stdout.isTTY;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
  });

  describe('in TTY mode', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
      });
      // Mock clearLine and cursorTo for TTY
      (process.stdout as any).clearLine = vi.fn();
      (process.stdout as any).cursorTo = vi.fn();
    });

    it('should create a spinner with the given text', () => {
      const spinner = createSpinner('Loading');
      expect(spinner).toHaveProperty('start');
      expect(spinner).toHaveProperty('stop');
      expect(spinner).toHaveProperty('success');
      expect(spinner).toHaveProperty('fail');
    });

    it('should write spinner frame on start', () => {
      const spinner = createSpinner('Loading');
      spinner.start();

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('Loading');
    });

    it('should stop and clear line', () => {
      const spinner = createSpinner('Loading');
      spinner.start();
      spinner.stop();

      expect((process.stdout as any).clearLine).toHaveBeenCalled();
    });

    it('should show green checkmark on success', () => {
      const spinner = createSpinner('Loading');
      spinner.start();
      spinner.success('Done!');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Done!')
      );
      // Green color code
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[32m')
      );
    });

    it('should show red X on fail', () => {
      const spinner = createSpinner('Loading');
      spinner.start();
      spinner.fail('Error!');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error!')
      );
      // Red color code
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[31m')
      );
    });
  });

  describe('in non-TTY mode', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        configurable: true,
      });
    });

    it('should print message once on start (no animation)', () => {
      const spinner = createSpinner('Processing');
      spinner.start();

      expect(consoleLogSpy).toHaveBeenCalledWith('... Processing');
    });

    it('should show success message', () => {
      const spinner = createSpinner('Processing');
      spinner.success('Completed');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed')
      );
    });

    it('should show fail message', () => {
      const spinner = createSpinner('Processing');
      spinner.fail('Failed');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed')
      );
    });
  });
});
