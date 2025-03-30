import * as vscode from 'vscode';

/**
 * Represents the configuration for a formatter
 */
export interface FormatterConfig {
  /**
   * The formatter extension ID
   */
  formatterId: string;
}

/**
 * Represents the result of a formatter execution
 */
export interface FormatterResult {
  /**
   * The formatter ID that produced this result
   */
  formatterId: string;

  /**
   * The edits produced by the formatter
   */
  edits: vscode.TextEdit[];

  /**
   * Any error that occurred during formatting
   */
  error?: Error;

  /**
   * Lines that were modified by this formatter
   */
  modifiedLines: Set<number>;
}

/**
 * Represents a conflict between formatters
 */
export interface FormatterConflict {
  /**
   * The ID of the first formatter
   */
  firstFormatterId: string;

  /**
   * The ID of the second formatter
   */
  secondFormatterId: string;

  /**
   * The lines where the conflict occurred
   */
  lines: number[];
}