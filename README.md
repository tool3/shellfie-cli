# shellfie-cli

Transform your terminal output into beautiful SVG screenshots, directly from the command line.

```sh
npm test | npx shellfie
```

![npm test](https://raw.githubusercontent.com/tool3/shellfie-cli/refs/heads/master/examples/tests.svg)

✅ **Zero friction** - Pipe any command output and get an SVG instantly.  
✅ **Beautiful defaults** - macOS-style terminal window with syntax highlighting.  
✅ **Fully customizable** - 12 themes, 3 templates, custom fonts, and more.  
✅ **Portable SVGs** - Embed fonts for consistent rendering everywhere.  
✅ **Run everywhere** - Terminal, CI/CD, npm scripts.   

## Installation

### Homebrew (macOS/Linux)

```sh
brew install tool3/tap/shellfie
```

### Shell script (macOS/Linux)

```sh
curl -fsSL https://raw.githubusercontent.com/tool3/shellfie-cli/master/scripts/install.sh | bash
```

### npm

```sh
# Use directly with npx (no install needed)
npx shellfie-cli --help

# Or install globally
npm install -g shellfie-cli

# Or add to your project
npm install shellfie-cli --save-dev
```

### Download binary

Pre-built binaries for macOS, Linux, and Windows are available on the [Releases](https://github.com/tool3/shellfie-cli/releases) page.

## Quick Start

### Pipe command output

```sh
# Capture npm test output
npm test 2>&1 | shellfie -o test-results.svg

# Capture git log
git log --oneline -10 | shellfie --title "Recent Commits" -o commits.svg

# Capture any command with colors
ls -la --color=always | shellfie --theme nord
```

```sh
lolcat --help | shellfie -o lolcat
```

![npm test](https://raw.githubusercontent.com/tool3/shellfie-cli/refs/heads/master/examples/lolcat.svg)

### Read from a file

```sh
# Convert a log file to SVG
shellfie error.log -o error-screenshot.svg

# ASCII art
shellfie banner.txt --template minimal --theme monokai
```

### Output to stdout

```sh
# Pipe SVG to another command or file
cat output.txt | shellfie --stdout > output.svg

# Use with clipboard (macOS)
echo "Hello World" | shellfie --stdout | pbcopy
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--output <path>` | `-o` | Output file path (default: `./shellfie.svg`) |
| `--name <name>` | `-n` | Output filename (without extension) |
| `--stdout` | | Print SVG to stdout instead of file |
| `--template <name>` | `-t` | Window style: `macos`, `windows`, `minimal` |
| `--theme <name>` | `-T` | Color theme (see [Themes](#themes)) |
| `--title <text>` | | Window title bar text |
| `--watermark <text>` | | Text in bottom-right corner (supports ANSI colors) |
| `--width <cols>` | `-w` | Terminal width in columns (auto-detected) |
| `--padding <value>` | `-p` | Padding in pixels (`16` or `top,right,bottom,left`) |
| `--font-size <px>` | | Font size in pixels (default: `14`) |
| `--line-height <n>` | | Line height multiplier (default: `1.4`) |
| `--font-family <css>` | | CSS font-family string |
| `--embed-font` | | Embed system font for portable SVGs |
| `--no-controls` | | Hide window control buttons |
| `--no-custom-glyphs` | | Use font glyphs instead of pixel-perfect box drawing |
| `--header-height <px>` | | Custom header bar height |
| `--header-color <hex>` | | Header background color |
| `--footer-height <px>` | | Footer bar height |
| `--footer-color <hex>` | | Footer background color |
| `--list-themes` | | List all available themes |
| `--list-templates` | | List all available templates |
| `--help` | `-h` | Show help |
| `--version` | `-v` | Show version |

## Themes

```sh
shellfie --list-themes
```

Available themes:

| Theme | Description |
|-------|-------------|
| `dracula` | Dark, vibrant purple |
| `nord` | Arctic, bluish colors |
| `tokyoNight` | Dark, moody |
| `oneDark` | VS Code One Dark |
| `monokai` | Classic dark |
| `catppuccinMocha` | Warm, cozy dark |
| `githubDark` | GitHub dark mode |
| `githubLight` | GitHub light mode |
| `gruvboxDark` | Retro dark |
| `gruvboxLight` | Retro light |
| `solarizedDark` | Solarized dark |
| `solarizedLight` | Solarized light |

## Templates

```sh
shellfie --list-templates
```

| Template | Description |
|----------|-------------|
| `macos` | macOS-style with traffic light buttons (default) |
| `windows` | Windows-style with square buttons |
| `minimal` | Clean, no window chrome |

## Examples

### Capture test results with a theme

```sh
npm test 2>&1 | shellfie --theme dracula --title "Unit Tests" -o tests.svg
```
![tests dracula](https://raw.githubusercontent.com/tool3/shellfie-cli/refs/heads/master/examples/tests-dracula.svg)

### Git log with minimal template

```sh
git log --oneline --graph --color=always | shellfie -t minimal --theme githubDark -o git-log.svg
```
![git log](https://raw.githubusercontent.com/tool3/shellfie-cli/refs/heads/master/examples/git-log.svg)

### Custom padding and font size

```sh
cat script.sh | shellfie --padding "20,30" --font-size 30 -o script.svg
```
![script](https://raw.githubusercontent.com/tool3/shellfie-cli/refs/heads/master/examples/script.svg)

### Embed font for sharing

```sh
ls -l | lolcat -f | shellfie --embed-font -o portable.svg
```
![portable](https://raw.githubusercontent.com/tool3/shellfie-cli/refs/heads/master/examples/portable.svg)

### Add watermark

```sh
ifconfig | grep inet | shellfie --watermark "@$USER" --theme monokai
```
![watermark](https://raw.githubusercontent.com/tool3/shellfie-cli/refs/heads/master/examples/watermark.svg)

### Colored watermark

Watermarks support ANSI escape sequences for colors and styles:

```sh
# Red watermark using octal notation
echo "test" | shellfie --watermark '\033[31m@username\033[0m'

# Green watermark using hex notation
echo "test" | shellfie --watermark '\x1b[32m@username\x1b[0m'

# Bold blue watermark using shorthand notation
echo "test" | shellfie --watermark '\e[1;34m@username\e[0m'

# Works with bash variables
echo "test" | shellfie --watermark '\e[1;32m@$USER\e[0m'
```

### With header and footer bars

```sh
htop -n 1 | shellfie --header-height 30 --footer-height 20 -o system.svg
```

## Tips

### Preserve colors

Many commands disable colors when piped. Force them with:

```sh
# ls
ls -la --color=always | shellfie

# grep
grep --color=always pattern file | shellfie

# git
git -c color.ui=always log | shellfie

# npm
npm test --color | shellfie
```

### Capture stderr too

Include error output with `2>&1`:

```sh
npm test 2>&1 | shellfie -o output.svg
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Generate test screenshot
  run: npm test 2>&1 | npx shellfie-cli --theme githubDark -o test-output.svg

- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    name: test-screenshot
    path: test-output.svg
```

### npm scripts

```json
{
  "scripts": {
    "test:screenshot": "npm test 2>&1 | shellfie --theme dracula -o tests.svg"
  }
}
```

## Related

- [shellfie](https://github.com/tool3/shellfie) - the core library for programmatic use.   
- [shellfied](https://github.com/tool3/shellfied) - the shellfie web app!

## License

MIT
