/* eslint-disable */
import * as vscode from 'vscode';
import type { FormatterConfig } from './types';

/**
 * Manages formatter configurations for different languages
 */
export class FormatterConfigManager {
  // The extension's full ID, including publisher
  private readonly EXTENSION_ID: string;

  /**
   * Creates a new formatter config manager
   * @param extensionId The extension ID to use (optional, defaults to 'kroe.multiformatter')
   */
  constructor(extensionId?: string) {
    this.EXTENSION_ID = extensionId || 'kroe.multiformatter';
  }

  /**
   * Gets the formatter chain for a specific document
   * @param document The document to get formatters for
   * @returns Array of formatter configs in the order they should be applied
   */
  public getFormatterChain(document: vscode.TextDocument): FormatterConfig[] {
    const formatters: FormatterConfig[] = [];
    const languageId = document.languageId;

    // For debugging
    console.log(`Getting formatters for language: ${languageId}`);

    // First check if this language is enabled for multi-formatting
    const supportedLanguages = this.getSupportedLanguages();
    console.log(`Supported languages: ${JSON.stringify(supportedLanguages)}`);

    // If we have a supported languages list and the current language isn't in it, return empty
    if (supportedLanguages.length > 0) {
      // Check for exact match as well as type-specific matches (e.g., typescriptreact -> typescript)
      const isSupported = supportedLanguages.some(lang => {
        // Exact match
        if (lang === languageId) return true;

        // Check for language family matches
        if (languageId === 'typescriptreact' && lang === 'typescript') return true;
        if (languageId === 'javascriptreact' && lang === 'javascript') return true;

        return false;
      });

      console.log(`Is language supported: ${isSupported}`);
      if (!isSupported) return [];
    }

    // Get the default formatter ID for this language
    const config = vscode.workspace.getConfiguration('editor', document);
    const defaultFormatterId = config.get<string>('defaultFormatter');
    console.log(`Default formatter: ${defaultFormatterId}`);

    // Only add the default formatter if it's not our extension (to avoid recursion)
    if (defaultFormatterId && defaultFormatterId !== this.EXTENSION_ID) {
      formatters.push({ formatterId: defaultFormatterId });
    }

    // Get language-specific formatters
    // VS Code stores language-specific settings differently than global ones
    let languageFormatters: string[] = [];

    // Method 1: Try direct bracket notation for language-specific settings
    const langSpecificConfig: Record<string, unknown> = vscode.workspace.getConfiguration().get<Record<string, unknown>>(`[${languageId}]`) || {};
    console.log(`Lang-specific config object: ${JSON.stringify(langSpecificConfig)}`);

    if (langSpecificConfig?.['multiformatter.formatters']) {
      languageFormatters = langSpecificConfig['multiformatter.formatters'] as string[];
      console.log(`Found formatters in language config: ${JSON.stringify(languageFormatters)}`);
    } else {
      // Method 2: Try getting from resource-scoped config
      languageFormatters = vscode.workspace.getConfiguration('multiformatter', { languageId }).get<string[]>('formatters') || [];
      console.log(`Formatters from scoped config: ${JSON.stringify(languageFormatters)}`);
    }

    // Fallback to global formatters if no language-specific ones
    if (languageFormatters.length === 0) {
      languageFormatters = vscode.workspace.getConfiguration('multiformatter').get<string[]>('formatters') || [];
      console.log(`Using global formatters: ${JSON.stringify(languageFormatters)}`);
    }

    // Add the additional formatters to the chain
    for (const formatterId of languageFormatters) {
      // Prevent infinite recursion by skipping our own extension ID
      if (formatterId !== this.EXTENSION_ID && formatterId !== 'multiformatter') {
        formatters.push({ formatterId });
      }
    }

    console.log(`Final formatter chain: ${JSON.stringify(formatters)}`);
    return formatters;
  }

  /**
   * Gets supported languages for multi-formatting
   * @returns Array of language IDs that are supported
   */
  public getSupportedLanguages(): string[] {
    return vscode.workspace.getConfiguration('multiformatter')
      .get<string[]>('languages') || [];
  }

  /**
   * Checks if our extension is set as the default formatter for a document
   * @param document The document to check
   * @returns True if this extension is the default formatter
   */
  public isMultiFormatterDefault(document: vscode.TextDocument): boolean {
    const config = vscode.workspace.getConfiguration('editor', document);
    const defaultFormatterId = config.get<string>('defaultFormatter');
    return defaultFormatterId === this.EXTENSION_ID;
  }

  /**
   * Checks if a document has multiple formatters configured
   * @param document The document to check
   * @returns True if multiple formatters are configured
   */
  public hasMultipleFormatters(document: vscode.TextDocument): boolean {
    const formatters = this.getFormatterChain(document);
    return formatters.length > 1;
  }

  /**
   * Validates the formatter configuration for a document
   * @param document The document to validate
   * @returns An error message if invalid, undefined if valid
   */
  public validateConfig(document: vscode.TextDocument): string | undefined {
    const isDefault = this.isMultiFormatterDefault(document);
    const formatters = this.getFormatterChain(document);

    if (isDefault && formatters.length === 0) {
      return 'Multi-Formatter is set as the default formatter, but no formatters are configured.';
    }

    return undefined;
  }
}