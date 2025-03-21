import * as vscode from 'vscode';

// Create output channel for logging
const outputChannel = vscode.window.createOutputChannel('Multi Formatter');
let isDebugMode = false;

// Helper function for logging
function log(message: string) {
  // Only log when in debug mode
  if (isDebugMode) {
    outputChannel.appendLine(message);
    outputChannel.show(true);
  }
}

// Add a debug log that always logs regardless of debug mode
function debugLog(message: string) {
  outputChannel.appendLine(`[DEBUG] ${message}`);
  if (isDebugMode) {
    outputChannel.show(true);
  }
}

// Simplified formatter config with only the compact format
interface FormatterConfig {
  language: string;
  formatters: string[];
}

export function activate(context: vscode.ExtensionContext) {
  // Read initial debug setting
  isDebugMode = vscode.workspace.getConfiguration('multiFormatter').get('debugMode') ?? false;

  // Log that the extension is active (always show on activation)
  outputChannel.appendLine('=====================================');
  outputChannel.appendLine('Multi Formatter extension is now active');
  outputChannel.appendLine(`Debug mode: ${isDebugMode ? 'enabled' : 'disabled'}`);
  outputChannel.appendLine('=====================================');

  if (isDebugMode) {
    outputChannel.show(true);
  }

  // Register toggle debug command
  const debugCommand = vscode.commands.registerCommand('multiFormatter.toggleDebug', () => {
    isDebugMode = !isDebugMode;

    // Update configuration to persist the setting
    vscode.workspace.getConfiguration('multiFormatter').update('debugMode', isDebugMode, true);

    // Show notification
    vscode.window.showInformationMessage(`Multi Formatter: Debug mode ${isDebugMode ? 'enabled' : 'disabled'}`);

    if (isDebugMode) {
      outputChannel.show(true);
      outputChannel.appendLine('Debug mode enabled');
    } else {
      outputChannel.appendLine('Debug mode disabled');
    }
  });

  context.subscriptions.push(debugCommand);

  // Preload commonly used formatter extensions
  preloadFormatterExtensions();

  // Register the main format command
  registerMainCommand(context);

  // Register language-specific commands based on current config
  updateLanguageCommands(context);

  // Listen for configuration changes and update commands as needed
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('multiFormatter.formatters')) {
        updateLanguageCommands(context);
        preloadFormatterExtensions(); // Reload formatter extensions when config changes
      }

      if (e.affectsConfiguration('multiFormatter.showFormattingConflictWarnings') ||
          e.affectsConfiguration('multiFormatter.formatters') ||
          e.affectsConfiguration('editor.defaultFormatter') ||
          e.affectsConfiguration('editor.formatOnSave')) {
        void checkForFormattingConflicts();
      }

      if (e.affectsConfiguration('multiFormatter.debugMode')) {
        isDebugMode = vscode.workspace.getConfiguration('multiFormatter').get('debugMode') ?? false;
        outputChannel.appendLine(`Debug mode changed to: ${isDebugMode ? 'enabled' : 'disabled'}`);

        if (isDebugMode) {
          outputChannel.show(true);
        }
      }
    })
  );

  // Check for potential formatting conflicts (using void to acknowledge the promise)
  void checkForFormattingConflicts();
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

// Track languages that had conflicts to show resolution messages
const languagesWithConflicts = new Set<string>();

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
  // Use cached result if config hasn't changed
  const config = vscode.workspace.getConfiguration('multiFormatter');
  const formatterConfigs: FormatterConfig[] = config.get('formatters') || [];

  // More efficient to use Set from the start rather than Array
  return [...new Set(formatterConfigs.map(config => config.language))];
}

async function runFormatter(formatter: string, saveAfterEach: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const document = editor.document;

  try {
    // Check if this is a built-in formatter
    if (formatter === 'vscode.executeFormatDocumentProvider' || formatter === 'editor.action.formatDocument') {
      // Use VSCode's built-in formatting
      await vscode.commands.executeCommand('editor.action.formatDocument');
    } else {
      // For non-built-in formatters, check if the extension is available
      const formatterExtensionId = formatter.split('.')[0];
      const extension = vscode.extensions.getExtension(formatterExtensionId);

      if (!extension) {
        throw new Error(`Extension "${formatterExtensionId}" not found. Is it installed and activated?`);
      }

      // Ensure extension is activated before running the command
      if (!extension.isActive) {
        await extension.activate();
      }

      // Run the formatter command
      await vscode.commands.executeCommand(formatter);
    }

    // Make sure the document is saved before running the next formatter
    if (saveAfterEach && document.isDirty) {
      await document.save();
    }
  } catch (error: unknown) {
    // Consistent error handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run formatter "${formatter}": ${errorMessage}`);
  }
}

export function deactivate() {
  // Clean up language command disposables
  languageCommandDisposables.forEach(d => d.dispose());
  // Dispose of the output channel
  outputChannel.dispose();
}

async function preloadFormatterExtensions() {
  const config = vscode.workspace.getConfiguration('multiFormatter');
  const formatterConfigs: FormatterConfig[] = config.get('formatters') || [];

  // Get all formatter commands from all configurations
  const uniqueFormatters = new Set<string>();
  for (const config of formatterConfigs) {
    for (const formatter of config.formatters) {
      uniqueFormatters.add(formatter);
    }
  }

  // Fixed Promise activation handling
  const activationPromises = [];
  for (const formatter of uniqueFormatters) {
    if (formatter === 'vscode.executeFormatDocumentProvider' ||
        formatter === 'editor.action.formatDocument') {
      continue; // Skip built-in formatters
    }

    // Extract extension ID from command (first part before the dot)
    const parts = formatter.split('.');
    if (parts.length > 1) {
      const extensionId = parts[0];
      try {
        const extension = vscode.extensions.getExtension(extensionId);
        if (extension && !extension.isActive) {
          // Modified: Use Promise wrapper to handle errors properly
          activationPromises.push(
            Promise.resolve().then(async () => {
              try {
                await extension.activate();
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log(`[Multi Formatter] Failed to preload extension ${extensionId}: ${errorMessage}`);
              }
            })
          );
        }
      } catch (error) {
        // Silently fail on preloading - we'll properly handle errors when
        // actually running the formatter
        log(`[Multi Formatter] Unable to preload extension for ${formatter}`);
      }
    }
  }
  // Wait for all extensions to activate in parallel
  await Promise.all(activationPromises);
}

/**
 * Checks for potential formatting conflicts with default formatters or format-on-save settings.
 * Displays a warning message if conflicts are detected and provides options to configure settings or disable conflict detection.
 */
async function checkForFormattingConflicts() {
  const config = vscode.workspace.getConfiguration('multiFormatter');
  const showWarnings = config.get('showFormattingConflictWarnings') ?? true;

  log('[Multi Formatter] Checking for formatting conflicts...');
  // Use Set methods instead of creating arrays
  log('[Multi Formatter] Current languages with conflicts: ' + [...languagesWithConflicts].join(', '));

  // Early return pattern
  if (!showWarnings) {
    log('[Multi Formatter] Conflict detection disabled, clearing all conflicts');
    languagesWithConflicts.clear();
    return;
  }

  // Get all configured languages
  const languages = getConfiguredLanguages();
  log('[Multi Formatter] Configured languages: ' + languages.join(', '));

  // Track current conflicts to detect resolutions
  const currentConflicts = new Set<string>();

  // Check each language for conflicts
  for (const languageId of languages) {
    log(`\n[Multi Formatter] Checking language: ${languageId}`);

    // Check if default formatter is configured
    const editorConfig = vscode.workspace.getConfiguration(`[${languageId}]`);
    const defaultFormatterGlobal = editorConfig.inspect('editor.defaultFormatter')?.globalValue;
    const defaultFormatterWorkspace = editorConfig.inspect('editor.defaultFormatter')?.workspaceValue;

    // Try to get language-specific default formatter directly from raw settings
    const rawSettings = vscode.workspace.getConfiguration();
    const rawLanguageSettings = rawSettings.get(`[${languageId}]`) as Record<string, any> | undefined;
    const hasDefaultFormatterInRawSettings = rawLanguageSettings &&
                                           'editor.defaultFormatter' in rawLanguageSettings &&
                                           typeof rawLanguageSettings['editor.defaultFormatter'] === 'string';

    // Check both global and language-specific formatOnSave settings
    const globalFormatOnSave = vscode.workspace.getConfiguration('editor').inspect('formatOnSave');
    const languageFormatOnSave = editorConfig.inspect('editor.formatOnSave');

    // Check direct value for language-specific formatOnSave (this gets settings from .vscode/settings.json)
    const directLanguageFormatOnSave = editorConfig.get('editor.formatOnSave');

    // Check for formatOnSave in raw language settings
    const hasFormatOnSaveInRawLanguageSettings = rawLanguageSettings &&
                                               'editor.formatOnSave' in rawLanguageSettings &&
                                               rawLanguageSettings['editor.formatOnSave'] === true;

    // Consider formatOnSave enabled if:
    // 1. It's enabled globally and not disabled for this language, OR
    // 2. It's explicitly enabled for this language
    const hasDefaultFormatter = defaultFormatterGlobal || defaultFormatterWorkspace || hasDefaultFormatterInRawSettings;
    const formatOnSaveGlobal = globalFormatOnSave?.globalValue === true && languageFormatOnSave?.globalValue !== false;
    const formatOnSaveWorkspace = globalFormatOnSave?.workspaceValue === true && languageFormatOnSave?.workspaceValue !== false;
    const formatOnSaveLanguage = languageFormatOnSave?.globalValue === true ||
                                languageFormatOnSave?.workspaceValue === true ||
                                languageFormatOnSave?.workspaceFolderValue === true ||
                                directLanguageFormatOnSave === true ||
                                hasFormatOnSaveInRawLanguageSettings;
    const formatOnSaveEnabled = formatOnSaveGlobal || formatOnSaveWorkspace || formatOnSaveLanguage;

    // Only show conflict if both conditions are met
    const hasConflict = hasDefaultFormatter && formatOnSaveEnabled;

    log('[Multi Formatter] Settings found: ' + JSON.stringify({
      hasDefaultFormatter,
      defaultFormatterGlobal,
      defaultFormatterWorkspace,
      hasDefaultFormatterInRawSettings,
      rawDefaultFormatter: rawLanguageSettings?.['editor.defaultFormatter'],
      formatOnSaveEnabled,
      formatOnSaveGlobal,
      formatOnSaveWorkspace,
      formatOnSaveLanguage,
      directLanguageFormatOnSave,
      rawLanguageSettings,
      hasFormatOnSaveInRawLanguageSettings,
      languageFormatOnSave: {
        global: languageFormatOnSave?.globalValue,
        workspace: languageFormatOnSave?.workspaceValue,
        workspaceFolder: languageFormatOnSave?.workspaceFolderValue
      },
      hasConflict
    }, null, 2));

    if (hasConflict) {
      log(`[Multi Formatter] Found conflict for ${languageId}`);
      currentConflicts.add(languageId);

      // Only show warning if we haven't warned about this language before
      if (!languagesWithConflicts.has(languageId)) {
        log(`[Multi Formatter] Showing warning for ${languageId} (first time)`);

        // Build a clean, compact message
        const formatterInfo = hasDefaultFormatterInRawSettings
          ? `"${rawLanguageSettings?.['editor.defaultFormatter']}"`
          : "present";

        const warning = `${languageId}: Format-on-save conflict with default formatter ${formatterInfo}`;

        await vscode.window.showWarningMessage(
          warning
        );

        languagesWithConflicts.add(languageId);
      } else {
        log(`[Multi Formatter] Skipping warning for ${languageId} (already shown)`);
      }
    } else {
      log(`[Multi Formatter] No conflicts found for ${languageId}`);
    }
  }

  // Check for resolved conflicts
  log('\n[Multi Formatter] Checking for resolved conflicts...');
  log('[Multi Formatter] Current conflicts: ' + Array.from(currentConflicts).join(', '));
  log('[Multi Formatter] Previous conflicts: ' + Array.from(languagesWithConflicts).join(', '));

  for (const languageId of Array.from(languagesWithConflicts)) {
    if (!currentConflicts.has(languageId)) {
      log(`[Multi Formatter] Conflict resolved for ${languageId}, showing success message`);
      await vscode.window.showInformationMessage(
        `Formatting conflicts resolved for ${languageId}`
      );
      languagesWithConflicts.delete(languageId);
    }
  }
}