import * as vscode from 'vscode';
import { FormatterService } from './formatter-service';
import { FormatterConfigManager } from './config';

/**
 * Provides formatting functionality to VS Code
 */
export class FormatterProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  private formatterService: FormatterService;
  private configManager: FormatterConfigManager;

  constructor(formatterService: FormatterService, extensionId: string) {
    this.formatterService = formatterService;
    this.configManager = new FormatterConfigManager(extensionId);
  }

  /**
   * Provides edits for formatting the entire document
   * @param document The document to format
   * @param options The formatting options
   * @param token A cancellation token
   * @returns An array of text edits to apply
   */
  public async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    // Validate the configuration
    const validationError = this.configManager.validateConfig(document);
    if (validationError) {
      vscode.window.showWarningMessage(validationError);
      return [];
    }

    // Format the document - pass only document and options, token is no longer used
    return this.formatterService.formatDocument(document, options);
  }

  /**
   * Provides edits for formatting a range of the document
   * @param document The document to format
   * @param range The range to format
   * @param options The formatting options
   * @param token A cancellation token
   * @returns An array of text edits to apply
   */
  public async provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    // TODO: Implement range formatting
    // This is more complex as we need to:
    // 1. Check which formatters support range formatting
    // 2. For those that don't, potentially format the whole document and extract the relevant changes

    // For now, we'll just format the whole document
    vscode.window.showInformationMessage(
      'Range formatting not fully implemented yet. Formatting entire document instead.'
    );

    return this.provideDocumentFormattingEdits(document, options, token);
  }

  /**
   * Registers the formatter provider for supported languages
   * @param context The extension context
   * @param formatterService The formatter service instance
   */
  public static register(context: vscode.ExtensionContext, formatterService: FormatterService): void {
    const extensionId = context.extension.id;
    const provider = new FormatterProvider(formatterService, extensionId);
    const configManager = new FormatterConfigManager(extensionId);

    // Get the list of languages from configuration
    const supportedLanguages = configManager.getSupportedLanguages();

    // If no languages are specified, use a default list
    const languagesToRegister = supportedLanguages.length > 0 ? supportedLanguages : [
      'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'json', 'html', 'css',
      'scss', 'less', 'php', 'ruby', 'erb', 'python'
    ];

    // Register as a document formatter for each language
    for (const language of languagesToRegister) {
      context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
          { language, scheme: '*' },
          provider
        )
      );

      // Register as a range formatter for each language
      context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider(
          { language, scheme: '*' },
          provider
        )
      );
    }
  }
}