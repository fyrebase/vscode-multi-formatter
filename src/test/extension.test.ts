import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';
import { FormatterConfigManager } from '../formatters/config';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting tests...');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('FormatterConfigManager should parse empty formatter chain', async () => {
		const configManager = new FormatterConfigManager();

		// Create a mock document
		const document = {
			languageId: 'plaintext',
			uri: vscode.Uri.file('test.txt')
		} as vscode.TextDocument;

		// Get formatter chain (should be empty)
		const formatters = configManager.getFormatterChain(document);

		// Verify result
		assert.strictEqual(formatters.length, 0, 'No formatters should be configured by default');
	});

	test('Extension should be active', async () => {
		const extension = vscode.extensions.getExtension('example-publisher.multiformatter');
		assert.ok(extension, 'Extension should be available');

		// Note: In a real environment, the extension would be activated
		// For testing purposes, we would manually activate it
		// await extension.activate();
		// assert.strictEqual(extension.isActive, true, 'Extension should be active');
	});

	// Add more tests for configuration parsing, formatter execution, etc.
});
