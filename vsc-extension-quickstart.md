# Multi Formatter Extension Development

## Development Setup

* Ensure you have Node.js installed
* Run `npm install` in this folder to install dependencies
* Open this folder in VS Code
* Press `F5` to open a new window with your extension loaded
* Run command "Format with Multiple Formatters" in the new window
* Set breakpoints in your code inside `src/extension.ts` to debug
* Find output from your extension in the debug console

## Make changes

* You can relaunch the extension from the debug toolbar after changing code
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window to load your changes

## Package the extension

* Run `npm run package` to create a .vsix file
* Install the extension with `code --install-extension multi-formatter-0.1.0.vsix`

## Testing

* Add tests in the `src/test` folder
* Run tests with `npm test` 