# DVD Examples

This directory contains example `.dvd` files showcasing various features and styles.

## Running Examples

Generate any example with:
```bash
shellfie <example-file>.dvd
```

Or from the project root:
```bash
node dist/cli.js examples/dvds/<example-file>.dvd
```

## Available Examples

### `ansi-colors.dvd`
Demonstrates typing text with embedded ANSI color codes and formatting. Shows how colors are preserved in the final SVG.

### `custom-prompt.dvd`
Shows how to customize the command prompt with a custom ANSI-colored prefix using the `PromptPrefix` setting.

### `rainbow.dvd`
Beautiful rainbow-colored text effects using ANSI codes.

### `templates.dvd`
Demonstrates the `minimal` template style for a clean look.

### `macos-style.dvd`
Classic macOS terminal window appearance with the default `macos` template.

### `windows-style.dvd`
Windows terminal appearance with a PowerShell-style prompt.

### `font-sizes.dvd`
Shows how to use larger fonts (20px) for better readability in presentations.

## Key Settings

All examples use these common settings:

- `Output` - Where to save the SVG file
- `Set Width` - Terminal width in pixels
- `Set Height` - Terminal height in pixels
- `Set FontSize` - Font size in pixels
- `Set Title` - Window title
- `Set Template` - Window style (`macos`, `windows`, or `minimal`)
- `Set PromptPrefix` - Custom ANSI-formatted prompt prefix

## Default Prompt

If you don't set a custom `PromptPrefix`, the default is a pink arrow: `\x1b[95m❯\x1b[0m `
