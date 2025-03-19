import * as vscode from 'vscode';

// Simplified formatter config with only the compact format
interface FormatterConfig {
  language: string;
  formatters: string[];
}

export function activate(context: vscode.ExtensionContext) {
  // Log that the extension is active
  console.log('Multi Formatter extension is now active');

  // Register the main format command
  registerMainCommand(context);

  // Register language-specific commands based on current config
  updateLanguageCommands(context);

  // Listen for configuration changes and update commands as needed
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('multiFormatter.formatters')) {
        updateLanguageCommands(context);
      }
    })
  );
}

function registerMainCommand(context: vscode.ExtensionContext) {
  // Register command to format with multiple formatters
  const formatCommand = vscode.commands.registerCommand('multiFormatter.format', async (args?: { languageId?: string }) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const document = editor.document;
    // Use the language ID from arguments if provided, otherwise use the current document language
    const languageId = args?.languageId || document.languageId;

    // Get formatters configuration
    const config = vscode.workspace.getConfiguration('multiFormatter');
    const formatterConfigs: FormatterConfig[] = config.get('formatters') || [];
    const saveAfterEachFormatter: boolean = config.get('saveAfterEachFormatter') ?? true;

    // Get all formatter commands for this language
    const formatterCommands = getFormattersForLanguage(formatterConfigs, languageId);

    if (formatterCommands.length === 0) {
      vscode.window.showInformationMessage(`No formatters configured for ${languageId}`);
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Running multiple formatters',
      cancellable: true
    }, async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => {
      const totalSteps = formatterCommands.length;
      let currentStep = 0;

      for (const formatterCommand of formatterCommands) {
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          message: `Running formatter: ${formatterCommand} (${++currentStep}/${totalSteps})`,
          increment: 100 / totalSteps
        });

        try {
          await runFormatter(formatterCommand, saveAfterEachFormatter);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Error running formatter ${formatterCommand}: ${errorMessage}`);
          return;
        }
      }

      // Always save at the end if we haven't been saving after each formatter
      if (!saveAfterEachFormatter && editor.document.isDirty) {
        await editor.document.save();
      }

      vscode.window.showInformationMessage('All formatters applied successfully');
    });
  });

  context.subscriptions.push(formatCommand);
}

/**
 * Extract all formatter commands for a specific language
 */
function getFormattersForLanguage(configs: FormatterConfig[], languageId: string): string[] {
  // Find config for the current language
  const config = configs.find(c => c.language === languageId);

  // Return formatters array if found, otherwise empty array
  return config?.formatters || [];
}

/**
 * Store for language-specific command disposables so they can be removed when config changes
 */
let languageCommandDisposables: vscode.Disposable[] = [];

/**
 * Update language-specific commands based on configuration
 */
function updateLanguageCommands(context: vscode.ExtensionContext) {
  // Dispose of any existing language-specific commands
  languageCommandDisposables.forEach(d => d.dispose());
  languageCommandDisposables = [];

  // Get configured languages and register commands
  const languages = getConfiguredLanguages();
  for (const languageId of languages) {
    const commandId = `multiFormatter.format.${languageId}`;

    // Register a command for this specific language
    const languageCommand = vscode.commands.registerCommand(
      commandId,
      () => vscode.commands.executeCommand('multiFormatter.format', { languageId })
    );

    // Store the disposable
    languageCommandDisposables.push(languageCommand);
    context.subscriptions.push(languageCommand);
  }
}

/**
 * Get all unique languages configured in settings
 */
function getConfiguredLanguages(): string[] {
  const config = vscode.workspace.getConfiguration('multiFormatter');
  const formatterConfigs: FormatterConfig[] = config.get('formatters') || [];

  // Get unique language IDs
  const languages = new Set<string>();
  formatterConfigs.forEach(config => {
    languages.add(config.language);
  });

  return Array.from(languages);
}

async function runFormatter(formatter: string, saveAfterEach: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const document = editor.document;

  if (formatter === 'vscode.executeFormatDocumentProvider') {
    // Use VSCode's built-in formatting
    await vscode.commands.executeCommand('editor.action.formatDocument');
  } else {
    // Run a specific formatter command
    await vscode.commands.executeCommand(formatter);
  }

  // Make sure the document is saved before running the next formatter
  if (saveAfterEach && document.isDirty) {
    await document.save();
  }
}

export function deactivate() {
  // Clean up language command disposables
  languageCommandDisposables.forEach(d => d.dispose());
}