import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { ResultsWebviewPanel } from '../panels/ResultsWebviewPanel';

export function registerScanAccessibilityCommand(
  context: vscode.ExtensionContext,
  client: FlowstralApiClient
): vscode.Disposable {
  return vscode.commands.registerCommand('flowstral.scanAccessibility', async () => {
    // Step 1: Get URL to scan
    const url = await vscode.window.showInputBox({
      prompt: 'Enter the URL to scan for accessibility issues',
      placeHolder: 'https://example.com',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'URL is required';
        }
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL (e.g., https://example.com)';
        }
      },
    });

    if (!url) {
      return;
    }

    // Step 2: Select WCAG level
    const level = await vscode.window.showQuickPick(
      [
        { label: 'WCAG 2.1 AA', description: 'Recommended — covers most requirements', value: 'AA' },
        { label: 'WCAG 2.1 A', description: 'Minimum compliance level', value: 'A' },
        { label: 'WCAG 2.1 AAA', description: 'Highest compliance level', value: 'AAA' },
      ],
      {
        placeHolder: 'Select WCAG compliance level',
      }
    );

    const wcagLevel = level?.value || 'AA';

    // Step 3: Execute scan
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Flowstral Accessibility Scan',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: `Scanning ${url} (WCAG ${wcagLevel})...` });

        try {
          const result = await client.scanAccessibility(url, wcagLevel);

          // Show summary in notification
          const summary = result.summary;
          const totalIssues = summary.total || 0;

          if (totalIssues === 0) {
            vscode.window.showInformationMessage(
              `Accessibility scan passed! No issues found on ${url}`
            );
          } else {
            const parts: string[] = [];
            if (summary.critical > 0) { parts.push(`${summary.critical} critical`); }
            if (summary.serious > 0) { parts.push(`${summary.serious} serious`); }
            if (summary.moderate > 0) { parts.push(`${summary.moderate} moderate`); }
            if (summary.minor > 0) { parts.push(`${summary.minor} minor`); }

            vscode.window.showWarningMessage(
              `Accessibility scan found ${totalIssues} issues: ${parts.join(', ')}`
            );
          }

          // Open results panel
          ResultsWebviewPanel.createOrShow(context, { ...result, wcagLevel }, 'accessibility');
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          const action = await vscode.window.showErrorMessage(
            `Accessibility scan failed: ${msg}`,
            'Configure Flowstral',
            'Try Again'
          );
          if (action === 'Configure Flowstral') {
            vscode.commands.executeCommand('flowstral.configure');
          } else if (action === 'Try Again') {
            vscode.commands.executeCommand('flowstral.scanAccessibility');
          }
        }
      }
    );
  });
}
