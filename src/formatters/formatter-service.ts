import * as vscode from 'vscode';
import { FormatterConfig } from './types';
import { FormatterConfigManager } from './config';

/**
 * Service for applying multiple formatters to a document
 */
export class FormatterService {
  private outputChannel: vscode.OutputChannel;
  private configManager: FormatterConfigManager;
  private readonly EXTENSION_ID: string;
  private isFormatting = false;
  private readonly DEFAULT_FORMATTER_DELAY = 300; // default ms to wait

  constructor(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Multi-Formatter');

    // Get extension ID from context
    this.EXTENSION_ID = context.extension.id;
    this.log(`Extension ID: ${this.EXTENSION_ID}`);

    // Pass the extension ID to the config manager
    this.configManager = new FormatterConfigManager(this.EXTENSION_ID);
  }

  /**
   * Shows the output channel
   */
  public showOutput(): void {
    this.outputChannel.show();
  }

  /**
   * Logs a message to the output channel
   * @param message The message to log
   */
  private log(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  /**
   * Gets the configured formatter delay in milliseconds
   */
  private getFormatterDelay(): number {
    const config = vscode.workspace.getConfiguration('multiformatter');
    return config.get<number>('formatterDelay') || this.DEFAULT_FORMATTER_DELAY;
  }

  /**
   * Formats a document using multiple formatters
   * @param document The document to format
   * @param options The formatting options
   * @returns An array of text edits to apply
   */
  public async formatDocument(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): Promise<vscode.TextEdit[]> {
    // Prevent recursive formatting
    if (this.isFormatting) {
      this.log('Already formatting, skipping.');
      return [];
    }

    // Skip formatting if document is not dirty
    if (!document.isDirty) {
      this.log('Document is not dirty, skipping formatting.');
      return [];
    }

    this.isFormatting = true;

    try {
      this.log(`Formatting document: ${document.fileName}`);
      this.log(`Language ID: ${document.languageId}`);

      // Get formatters for this document type
      const formatters = this.configManager.getFormatterChain(document);
      this.log(`Found ${formatters.length} formatters to apply`);

      if (formatters.length === 0) {
        this.log('No formatters configured. Skipping formatting.');
        return [];
      }

      // Capture the original content before formatting
      const originalContent = document.getText();

      // Get the original default formatter
      const editorConfig = vscode.workspace.getConfiguration('editor', document);
      const originalDefaultFormatter = editorConfig.get<string>('defaultFormatter');
      this.log(`Original default formatter: ${originalDefaultFormatter || 'none'}`);

      // Find the appropriate settings target
      const target = this.getAppropriateScopeTarget();
      this.log(`Using settings scope: ${this.getScopeTargetName(target)}`);

      // Make sure the document is active before formatting
      const editor = await vscode.window.showTextDocument(document);
      await this.delay("Initial activation");

      // Store document's dirty state
      const wasDirty = document.isDirty;
      this.log(`Document dirty state before formatting: ${wasDirty}`);

      try {
        // Process each formatter
        const formatAction = 'editor.action.formatDocument';
        let lastContentHash = this.hashContent(originalContent);

        for (const formatter of formatters) {
          try {
            this.log(`Running formatter: ${formatter.formatterId}`);

            // Set this formatter as the default (in appropriate scope)
            await editorConfig.update('defaultFormatter', formatter.formatterId, target);
            await this.delay("After setting formatter");

            // Wait for the setting to take effect
            await this.waitForFormatterToActivate(formatter.formatterId, document);

            // Execute the format command
            await vscode.commands.executeCommand(formatAction);
            await this.delay("After formatting");

            // Check if formatting was successful by getting the document content again
            const currentContent = document.getText();
            const currentHash = this.hashContent(currentContent);
            const didFormat = currentHash !== lastContentHash;

            this.log(`Formatter ${formatter.formatterId} applied changes: ${didFormat}`);
            lastContentHash = currentHash;

            this.log(`Applied edits from ${formatter.formatterId}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log(`Error applying formatter ${formatter.formatterId}: ${message}`);
            // Continue with the next formatter
          }
        }
      } finally {
        // Always restore the original default formatter
        await editorConfig.update('defaultFormatter', originalDefaultFormatter, target);
        await this.delay("After restoring formatter");
      }

      // Capture the final content after all formatters ran
      const finalContent = document.getText();
      const hasChanges = originalContent !== finalContent;

      this.log(`Document changed: ${hasChanges}`);
      this.log(`Original length: ${originalContent.length}, Final length: ${finalContent.length}`);

      // If the document was triggered by formatOnSave, save it
      if (document.isDirty) {
        this.log("Document is dirty, saving...");
        await editor.document.save();
      }

      this.log("=== All formatters applied successfully ===");

      // If there were no changes, return empty array
      if (!hasChanges) {
        return [];
      }

      // Create a text edit that replaces the entire document with the formatted version
      return [vscode.TextEdit.replace(
        new vscode.Range(
          new vscode.Position(0, 0),
          document.lineAt(document.lineCount - 1).range.end
        ),
        finalContent
      )];
    } finally {
      this.isFormatting = false;
    }
  }

  /**
   * Creates a hash of the content for quick comparison
   */
  private hashContent(content: string): string {
    // Simple hash function for quick comparison
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Waits for a delay with a description for logging
   */
  private async delay(description: string): Promise<void> {
    const delayMs = this.getFormatterDelay();
    this.log(`Waiting ${delayMs}ms ${description}...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Checks if the formatter has been successfully activated
   */
  private async waitForFormatterToActivate(formatterId: string, document: vscode.TextDocument): Promise<void> {
    // Wait for up to 5 attempts
    for (let i = 0; i < 5; i++) {
      const config = vscode.workspace.getConfiguration('editor', document);
      const current = config.get<string>('defaultFormatter');

      if (current === formatterId) {
        this.log(`Confirmed formatter ${formatterId} is now active`);
        return;
      }

      this.log(`Waiting for formatter ${formatterId} to become active (currently: ${current})`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.log(`Warning: Could not confirm formatter ${formatterId} activation`);
  }

  /**
   * Gets the most appropriate settings scope target
   * Prefers workspace > workspace folder > global
   */
  private getAppropriateScopeTarget(): vscode.ConfigurationTarget {
    // Check if we're in a workspace
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      // If we have multiple workspace folders, use workspace settings
      if (vscode.workspace.workspaceFolders.length > 1) {
        return vscode.ConfigurationTarget.Workspace;
      }
      // Otherwise use the folder settings
      return vscode.ConfigurationTarget.WorkspaceFolder;
    }
    // Fallback to global if no workspace
    return vscode.ConfigurationTarget.Global;
  }

  /**
   * Gets a readable name for the configuration target
   */
  private getScopeTargetName(target: vscode.ConfigurationTarget): string {
    switch (target) {
      case vscode.ConfigurationTarget.Global:
        return 'Global';
      case vscode.ConfigurationTarget.Workspace:
        return 'Workspace';
      case vscode.ConfigurationTarget.WorkspaceFolder:
        return 'Workspace Folder';
      default:
        return 'Unknown';
    }
  }
}
