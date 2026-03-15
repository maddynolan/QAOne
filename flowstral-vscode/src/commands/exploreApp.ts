import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { ResultsWebviewPanel } from '../panels/ResultsWebviewPanel';

export function registerExploreAppCommand(
  context: vscode.ExtensionContext,
  client: FlowstralApiClient
): vscode.Disposable {
  return vscode.commands.registerCommand('flowstral.exploreApp', async () => {
    // Step 1: Get URL
    const url = await vscode.window.showInputBox({
      prompt: 'Enter the URL to explore',
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

    // Step 2: Select max pages
    const maxPagesChoice = await vscode.window.showQuickPick(
      [
        { label: '25 pages', description: 'Quick exploration', value: 25 },
        { label: '50 pages', description: 'Standard exploration (default)', value: 50 },
        { label: '100 pages', description: 'Thorough exploration', value: 100 },
        { label: '200 pages', description: 'Deep exploration', value: 200 },
      ],
      {
        placeHolder: 'How many pages should be explored?',
      }
    );

    const maxPages = maxPagesChoice?.value || 50;

    // Step 3: Execute exploration
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Flowstral App Exploration',
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          message: `Exploring ${url} (up to ${maxPages} pages)...`,
        });

        try {
          const result = await client.exploreApp(url, maxPages);

          // Show summary
          const pagesFound = result.pages_discovered || result.pages?.length || 0;
          const defectsFound = result.defects?.length || 0;
          const formsFound = result.forms?.length || 0;

          const parts: string[] = [`${pagesFound} pages discovered`];
          if (defectsFound > 0) {
            parts.push(`${defectsFound} defects found`);
          }
          if (formsFound > 0) {
            parts.push(`${formsFound} forms found`);
          }

          if (defectsFound > 0) {
            vscode.window.showWarningMessage(
              `Exploration complete: ${parts.join(', ')}`
            );
          } else {
            vscode.window.showInformationMessage(
              `Exploration complete: ${parts.join(', ')}`
            );
          }

          // Open results panel
          ResultsWebviewPanel.createOrShow(context, result, 'exploration');
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          const action = await vscode.window.showErrorMessage(
            `App exploration failed: ${msg}`,
            'Configure Flowstral',
            'Try Again'
          );
          if (action === 'Configure Flowstral') {
            vscode.commands.executeCommand('flowstral.configure');
          } else if (action === 'Try Again') {
            vscode.commands.executeCommand('flowstral.exploreApp');
          }
        }
      }
    );
  });
}
