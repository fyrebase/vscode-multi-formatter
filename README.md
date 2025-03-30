# Multi-Formatter for VS Code

Chain multiple formatters to run in sequence on your code files.

## Features

- Run multiple formatters in sequence on a single file
- Support for on-demand formatting and format-on-save
- Skip formatting on files with no unsaved changes
- Works with any existing formatter extensions

## Installation

### From VS Code Marketplace

Coming soon!

### From VSIX File

1. Download the `.vsix` file from the releases
2. Install using one of these methods:
   - Through VS Code UI: Go to Extensions view → Click on "..." menu → "Install from VSIX..." → Select the downloaded file
   - Using command line: `code --install-extension multiformatter-*.vsix` (where * is the version number)
   - Using the extension manager: `Extension: Install from VSIX...` command in the Command Palette

### Building and Installing Locally

1. Clone the repository
2. Run `npm install` or `pnpm install`
3. Choose one of the build methods:

#### Standard Build (Patch Version)

```bash
# Build with patch version increment (x.x.X+1)
npm run version-patch
```

#### Minor Version Build

```bash
# Build with minor version increment (x.X+1.0)
npm run version-minor
```

#### Major Version Build

```bash
# Build with major version increment (X+1.0.0)
npm run version-major
```

#### Custom Version
```bash
# Set a specific version number
npm run version-custom [version]
```

#### Build Without Version Change
```bash
npm run build-quick
```

### Manual Build and Install

1. Run `npm run vsix` to create the VSIX package
2. Uninstall previous version: `npm run uninstall-vsix`
3. Install the new version: `npm run install-vsix` (dynamically finds the latest version)

### Cleaning up

```bash
npm run clean
```

## Problem Solved

VS Code, by default, only runs one formatter on save or via the format command, forcing users to choose a single default formatter. This extension enables running multiple formatters in sequence, addressing common scenarios like:

- Using Prettier + ESLint together
- Running Prettier + Stylelint
- Applying an ERB beautifier followed by Prettier and an ERB linter

## Usage

### Configuration

After installing the extension, you need to configure two things:

1. **Supported Languages**: Define which languages you want to enable multi-formatting for
2. **Formatter Chains**: Configure which formatters to run (and in what order) for each language

#### Step 1: Define Supported Languages

In your `settings.json`, add:

```json
"multiformatter.languages": [
  "javascript", 
  "typescript", 
  "json", 
  "html", 
  "erb"
]
```

#### Step 2: Configure Formatters Per Language

There are two ways to configure formatters:

**Option 1: Language-specific settings (Recommended)**
```json
{
  "[javascript]": {
    "editor.defaultFormatter": "kroe.multiformatter",
    "multiformatter.formatters": [
      "esbenp.prettier-vscode",
      "dbaeumer.vscode-eslint"
    ],
    "editor.formatOnSave": true
  }
}
```

**Option 2: Global formatter settings**
```json
"multiformatter.formatters": [
  "esbenp.prettier-vscode",
  "dbaeumer.vscode-eslint"
]
```

The language-specific settings take precedence over the global settings.

### Example Configurations

#### JavaScript with Prettier + ESLint

```json
{
  "multiformatter.languages": ["javascript", "typescript"],
  
  "[javascript]": {
    "editor.defaultFormatter": "kroe.multiformatter",
    "multiformatter.formatters": [
      "esbenp.prettier-vscode",
      "dbaeumer.vscode-eslint"
    ],
    "editor.formatOnSave": true
  }
}
```

#### ERB Files

```json
{
  "multiformatter.languages": ["erb"],
  
  "[erb]": {
    "editor.defaultFormatter": "kroe.multiformatter",
    "multiformatter.formatters": [
      "aliariff.vscode-erb-beautify",
      "esbenp.prettier-vscode",
      "manuelpuyol.erb-linter"
    ],
    "editor.formatOnSave": true
  }
}
```

#### TypeScript React (TSX) Files

```json
{
  "multiformatter.languages": ["typescript", "typescriptreact"],
  
  "[typescriptreact]": {
    "editor.defaultFormatter": "kroe.multiformatter",
    "multiformatter.formatters": [
      "esbenp.prettier-vscode",
      "dbaeumer.vscode-eslint"
    ],
    "editor.formatOnSave": true
  }
}
```
### How It Works

When you format a document, these formatters will be executed in sequence:

1. First, the default formatter set in `editor.defaultFormatter` will run (if specified)
2. Then, each formatter in the `multiformatter.formatters` array will run in order
3. The output of each formatter becomes the input to the next formatter
4. Formatting is skipped if the document has no unsaved changes

This allows you to combine formatters that handle different aspects of code style.

### Commands

- **Multi-Format Document**: Formats the entire active document with multiple formatters
- **Multi-Format Selection**: Formats the selected text (not fully implemented yet)

## Requirements

- Ensure the formatter extensions you want to chain are installed
- Configure them individually with their own settings

## Extension Settings

* `multiformatter.languages`: Array of language IDs to enable Multi-Formatter for
* `multiformatter.formatters`: Array of formatter extension IDs to run in sequence (can be configured globally or per-language)
* `multiformatter.formatterDelay`: Delay in milliseconds between formatter operations (increase if formatters aren't being applied correctly)

## Known Issues

- Range formatting (selection) is not fully implemented yet
- Some formatters may not work well when chained (if they have conflicting rules)

## Release Notes

### 0.0.1

Initial release of Multi-Formatter with support for:
- Chaining multiple formatters
- Per-language formatter configuration
- Formatting only dirty documents
- Dynamic extension ID detection

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
