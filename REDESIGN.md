# DVD Format Redesign

## Current Issues
1. Real shell execution creates too many frames (48 frames for 5 seconds)
2. No visible cursor during typing
3. Width/Height not respecting pixel dimensions from Set commands
4. File sizes too large (~55KB vs VHS 35KB)

## New Approach (Like VHS)

### Don't Execute - Simulate!

VHS doesn't actually run commands in a shell. It:
1. Shows typing character by character with cursor
2. Simulates the output (user provides what output should be)
3. Creates minimal frames only when screen changes

### Frame Strategy

Only create frames when:
- A character is typed (show cursor after each char)
- Enter is pressed (move to next line, show cursor)
- Sleep happens (one frame)
- Output appears (one frame per line)

### Cursor Implementation

Add a blinking cursor block after current position:
- During Type: show cursor at end of typed text
- After Enter: show cursor on new line
- Animate cursor blink with CSS

### Size Optimization

1. Use `<symbol>` and `<use>` for repeated elements
2. Only capture frames on state changes (not every 50ms)
3. Compress similar frames

### Dimensions

Map Set Width/Height to actual pixel dimensions:
- Width 1200 → width="1200" viewBox
- Height 600 → height="600" viewBox
- Calculate terminal columns/rows from font size

## Implementation Plan

1. Remove shell spawning
2. Build terminal state simulation
3. Add cursor rendering
4. Optimize frame generation
5. Fix dimensions
