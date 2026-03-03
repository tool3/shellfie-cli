/**
 * Recorder - Captures terminal animation frames
 *
 * Detects frame boundaries from clear screen sequences and splits input.
 * For simple piped animations only - no PTY needed.
 */

export interface Frame {
  content: string;  // Raw ANSI content for this frame
  timestamp: number; // Time in seconds
}

export interface Recording {
  frames: Frame[];
  duration: number;
}

export interface RecordOptions {
  fps: number;
  maxDuration: number;
  maxFrames: number;
}

const DEFAULT_OPTIONS: RecordOptions = {
  fps: 10,
  maxDuration: 30,
  maxFrames: 100,
};

/**
 * Frame boundary patterns - sequences that indicate a new frame
 */
const CLEAR_SCREEN_BOUNDARIES = [
  '\x1Bc',           // Full reset (RIS) - most common
  '\x1B[2J\x1B[H',   // Clear + home
  '\x1B[H\x1B[2J',   // Home + clear
  '\x1B[2J',         // Clear entire screen
];

/**
 * Cursor save/restore pattern (used by lolcat -a)
 * ESC 7 = save cursor, ESC 8 = restore cursor
 * Each restore marks a new animation frame
 */
const CURSOR_RESTORE = '\x1B8';

/**
 * Records piped input and splits into frames.
 * Detects frame boundaries from clear screen sequences.
 */
export function recordPipedInput(
  input: string,
  options: Partial<RecordOptions> = {}
): Recording {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const frameInterval = 1 / opts.fps;

  // Try to split by clear screen patterns
  const frames = splitByFrameBoundary(input);

  // If only one frame, it's static content
  if (frames.length <= 1) {
    return {
      frames: [{ content: cleanContent(input), timestamp: 0 }],
      duration: 0,
    };
  }

  // Clean and timestamp frames
  const timedFrames: Frame[] = [];
  for (let i = 0; i < frames.length && timedFrames.length < opts.maxFrames; i++) {
    const cleaned = cleanContent(frames[i]);
    if (cleaned.trim()) {
      const timestamp = timedFrames.length * frameInterval;
      if (timestamp > opts.maxDuration) break;
      timedFrames.push({ content: cleaned, timestamp });
    }
  }

  if (timedFrames.length === 0) {
    return {
      frames: [{ content: cleanContent(input), timestamp: 0 }],
      duration: 0,
    };
  }

  return {
    frames: timedFrames,
    duration: timedFrames.length * frameInterval,
  };
}

/**
 * Split input by frame boundary sequences.
 * Tries clear screen patterns first, then cursor restore (lolcat style).
 */
function splitByFrameBoundary(input: string): string[] {
  // Try clear screen patterns first
  for (const pattern of CLEAR_SCREEN_BOUNDARIES) {
    if (input.includes(pattern)) {
      const parts = input.split(pattern).filter(p => p.trim().length > 0);
      if (parts.length > 1) {
        return parts;
      }
    }
  }

  // Try cursor restore pattern (lolcat -a style animation)
  // Pattern: ESC7 (save) content ESC8 (restore) content ESC8 (restore) ...
  if (input.includes(CURSOR_RESTORE)) {
    const parts = input.split(CURSOR_RESTORE).filter(p => p.trim().length > 0);
    if (parts.length > 1) {
      // Each part after restore is a complete frame - clean up save cursor too
      return parts.map(p => p.replace(/\x1B7/g, ''));
    }
  }

  return [input];
}

/**
 * Clean content - remove cursor control sequences.
 */
function cleanContent(content: string): string {
  return content
    .replace(/\x1B\[\?25[lh]/g, '')   // Hide/show cursor
    .replace(/\x1B\[\d*[ABCD]/g, '')  // Cursor movement
    .replace(/\x1B\[\d*;\d*[Hf]/g, '') // Cursor position
    .replace(/\x1B\[K/g, '')          // Clear to end of line
    .replace(/\x1B\[0?K/g, '')        // Clear to end of line
    .replace(/\x1B\[1K/g, '')         // Clear to start of line
    .replace(/\x1B\[2K/g, '');        // Clear entire line
}
