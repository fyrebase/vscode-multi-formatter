# Multi Formatter

A VSCode extension that allows you to run multiple formatters on your code in sequence.

## Installation

### From VSIX File
1. Download the `.vsix` file from the `dist` directory
2. Open VSCode
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu (top-right of Extensions view)
5. Select "Install from VSIX..." 
6. Choose the downloaded `.vsix` file

Alternatively, you can install from the command line:
```
code --install-extension dist/multi-formatter-0.1.0.vsix
```

Or use the provided npm script:
```
npm run install-ext
```

## Features

- Configure and run multiple formatters for each language
- Progress indicator shows formatting status
- Supports both built-in VSCode formatters and extension commands
- Control whether to save after each formatter or only at the end
- Language-specific commands for targeted formatting
- Clean and simple configuration format
- Automatic detection of potential formatting conflicts

## Usage

1. Install the extension
2. Configure your formatters in `settings.json`:

```json
"multiFormatter.formatters": [
  {
    "language": "javascriptreact",
    "formatters": ["esbenp.prettier-vscode", "biomejs.biome"]
  },
  {
    "language": "typescriptreact",
    "formatters": ["esbenp.prettier-vscode", "biomejs.biome"]
  }
]
```

3. Use the command palette (Ctrl+Shift+P) and run "Format with Multiple Formatters"
4. Alternatively, use the default keyboard shortcut `Ctrl+Alt+F` (`Cmd+Alt+F` on Mac)

## Configuration Options

### Formatters Array

Configure which formatters to run and in what sequence:

```json
"multiFormatter.formatters": [
  {
    "language": "javascript", 
    "formatters": ["prettier.formatDocument", "eslint.executeAutofix"]
  }
]
```

### Save Behavior

Control whether to save the document after each formatter runs:

```json
"multiFormatter.saveAfterEachFormatter": true
```

- When `true` (default): The document is saved after each formatter runs, ensuring each formatter works on the results of the previous one
- When `false`: The document is only saved at the end of the formatting sequence

### Conflict Detection

The extension can detect potential conflicts with VS Code's built-in formatting features:

```json
"multiFormatter.showFormattingConflictWarnings": true
```

- When `true` (default): The extension warns you if it detects conflicts with default formatters or format-on-save settings
- When `false`: No warnings are shown about potential conflicts

Conflicts may occur when:
- A default formatter is set for a language you're using with Multi Formatter
- Format on Save is enabled for languages configured in Multi Formatter

When a conflict is detected, you can:
- Open the relevant settings to resolve the conflict
- Disable conflict detection if you understand the setup

## Language-Specific Commands

For each language you configure, the extension automatically creates a dedicated command:

- `multiFormatter.format.javascript` - Format only JavaScript files
- `multiFormatter.format.typescript` - Format only TypeScript files
- etc.

You can bind these commands to specific keyboard shortcuts:

```json
{
  "key": "ctrl+shift+j",
  "command": "multiFormatter.format.javascript",
  "when": "editorTextFocus && editorLangId == 'javascript'"
}
```

## How It Works

When you run the command, the extension:

1. Identifies the language of your current file
2. Finds all configured formatters for that language
3. Runs each formatter in sequence, saving in between (if configured)
4. Displays progress and notifications

## Example Configuration

### Running Prettier then ESLint on JavaScript files:
```json
"multiFormatter.formatters": [
  {
    "language": "javascript",
    "formatters": ["prettier.formatDocument", "eslint.executeAutofix"]
  }
]
```

### Multiple languages configuration:
```json
"multiFormatter.formatters": [
  {
    "language": "javascript",
    "formatters": ["prettier.formatDocument", "eslint.executeAutofix"]
  },
  {
    "language": "typescript",
    "formatters": ["prettier.formatDocument", "eslint.executeAutofix"]
  },
  {
    "language": "css",
    "formatters": ["stylelint.executeAutofix"]
  }
]
```

## Known Formatter Command IDs

- VSCode built-in: `editor.action.formatDocument`
- Prettier: `prettier.formatDocument` or `prettier.forceFormatDocument`
- ESLint: `eslint.executeAutofix`
- Stylelint: `stylelint.executeAutofix`
- Biome: `biomejs.biome`

## License

MIT 