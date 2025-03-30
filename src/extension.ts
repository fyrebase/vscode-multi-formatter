// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FormatterProvider } from './formatters/formatter-provider';
import { FormatterService } from './formatters/formatter-service';
import { FormatterConfigManager } from './formatters/config';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Multi-Formatter extension activated!');

	// Create instances of our services
	const formatterService = new FormatterService(context);
	const configManager = new FormatterConfigManager(context.extension.id);

	// Log the extension ID for debugging
	console.log(`Extension ID: ${context.extension.id}`);

	// Register the formatter providers
	FormatterProvider.register(context, formatterService);

	// Register configuration schema
	registerConfigurationSchema();

	// Register the format document command
	context.subscriptions.push(
		vscode.commands.registerCommand('multiformatter.formatDocument', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showInformationMessage('No active editor to format.');
				return;
			}

			// Skip if document is not dirty
			if (!editor.document.isDirty) {
				vscode.window.showInformationMessage('Document has no unsaved changes, skipping formatting.');
				return;
			}

			// Show output channel to see the formatting process
			formatterService.showOutput();

			// Get formatting options
			const options = {
				tabSize: editor.options.tabSize as number,
				insertSpaces: editor.options.insertSpaces as boolean
			};

			try {
				// Format the document
				const edits = await formatterService.formatDocument(editor.document, options);

				// Apply the edits
				if (edits.length > 0) {
					const workspaceEdit = new vscode.WorkspaceEdit();
					workspaceEdit.set(editor.document.uri, edits);
					await vscode.workspace.applyEdit(workspaceEdit);
					vscode.window.setStatusBarMessage('Document formatted with multiple formatters.', 3000);
				} else {
					vscode.window.setStatusBarMessage('No formatting changes applied.', 3000);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Error formatting document: ${message}`);
			}
		})
	);

	// Register the format selection command
	context.subscriptions.push(
		vscode.commands.registerCommand('multiformatter.formatSelection', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor || editor.selection.isEmpty) {
				vscode.window.showInformationMessage('No selection to format.');
				return;
			}

			// This is a placeholder - we'll eventually need to implement proper range formatting
			vscode.window.showInformationMessage(
				'Range formatting not fully implemented yet. Use format document instead.'
			);

			// For now, trigger the formatDocument command
			await vscode.commands.executeCommand('multiformatter.formatDocument');
		})
	);
}

/**
 * Register configuration schema for the extension
 */
function registerConfigurationSchema() {
	// Note: Configuration schema is defined in package.json in the "contributes.configuration" section.
	// The settings are:
	//
	// multiformatter.languages: array of language IDs to enable Multi-Formatter for
	// multiformatter.formatters: array of formatter extension IDs to run (in order)
	// multiformatter.formatterDelay: delay in ms between formatter operations
	//
	// Example configuration in settings.json:
	//
	// multiformatter.languages: ["javascript", "typescript", "json"]
	// multiformatter.formatters: ["esbenp.prettier-vscode", "vscode.typescript-language-features"]
	//
	// Language-specific configuration:
	// "[javascript]": {
	//   "editor.defaultFormatter": "kroe.multiformatter",
	//   "multiformatter.formatters": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint"]
	// }
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Nothing to clean up
}
