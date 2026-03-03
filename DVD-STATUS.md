# DVD Format - Current Status

## What Works

✅ Parser - Complete `.dvd` syntax support
✅ All commands parsed correctly (Type, Sleep, Enter, etc.)
✅ Real shell execution
✅ Frame capture from terminal output
✅ Animated SVG generation with CSS keyframes
✅ Unique IDs per frame (no conflicts)
✅ File sizes reasonable (30-55KB)
✅ All tests passing (87 tests)

## Critical Issues

❌ **SVG dimensions auto-calculated** - Results in tiny/wrong sizes
❌ **No visible cursor** - Can't see typing happening
❌ **Too many frames** - Real shell creates frame per keystroke
❌ **Timing unpredictable** - Shell response time varies

## Root Cause

The current approach uses:
- Real shell (`spawn bash -i`)
- `shellfie` library for SVG generation (auto-sizes based on content)
- Frame capture every 50ms + on every keystroke

This works for static SVGs but not for VHS-style animations.

## What VHS Does Differently

1. **Uses ttyd + headless Chrome** to render a real PTY
2. **Captures video frames** at fixed intervals
3. **Has full terminal emulator** with cursor, colors, etc.
4. **Converts video → GIF** with optimization

## Path Forward

### Option A: Light Fixes (2-3 hours)
- Force fixed SVG dimensions
- Reduce frame rate (only capture on Sleep/Enter)
- Document cursor limitation
- **Result**: Functional but not great

### Option B: Proper Implementation (1-2 days)
- Integrate a terminal emulator library (xterm.js headless?)
- Render terminal state with cursor
- Capture frames only on state changes
- Generate optimized SVG
- **Result**: Production quality like VHS

### Option C: Hybrid (4-6 hours)
- Keep shell execution
- Add manual terminal state tracking
- Render cursor ourselves
- Optimize frame generation
- **Result**: Good enough, some limitations

## Recommendation

Given time constraints and complexity:

**Ship Option A now** with clear documentation of limitations, then iterate to Option C/B based on feedback.

Current code is 80% there - just needs dimension fixes and frame optimization.
