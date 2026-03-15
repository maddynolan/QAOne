import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { ResultsWebviewPanel } from '../panels/ResultsWebviewPanel';

export function registerRunApiTestCommand(
  context: vscode.ExtensionContext,
  client: FlowstralApiClient
): vscode.Disposable {
  return vscode.commands.registerCommand('flowstral.runApiTest', async () => {
    // Step 1: Get API URL
    const url = await vscode.window.showInputBox({
      prompt: 'Enter the API endpoint URL',
      placeHolder: 'https://api.example.com/users',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'URL is required';
        }
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    });

    if (!url) {
      return;
    }

    // Step 2: Select HTTP method
    const method = await vscode.window.showQuickPick(
      ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      {
        placeHolder: 'Select HTTP method',
      }
    );

    if (!method) {
      return;
    }

    // Step 3: Optional request body for POST/PUT/PATCH
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      body = await vscode.window.showInputBox({
        prompt: 'Enter request body (JSON) — leave empty to skip',
        placeHolder: '{"key": "value"}',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value) {
            return null; // Allow empty
          }
          try {
            JSON.parse(value);
            return null;
          } catch {
            return 'Please enter valid JSON';
          }
        },
      });
    }

    // Step 4: Execute
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Flowstral API Test: ${method} ${url}`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Executing API request...' });

        try {
          const result = await client.executeApiTest(url, method, body);

          // Show summary in notification
          const statusCode = result.status_code;
          const responseTime = result.response_time_ms;

          if (statusCode >= 200 && statusCode < 300) {
            vscode.window.showInformationMessage(
              `API test passed: ${statusCode} (${responseTime}ms)`
            );
          } else if (statusCode >= 400) {
            vscode.window.showWarningMessage(
              `API test returned error: ${statusCode} (${responseTime}ms)`
            );
          } else {
            vscode.window.showInformationMessage(
              `API test completed: ${statusCode} (${responseTime}ms)`
            );
          }

          // Open results panel
          const displayData = {
            url,
            method,
            requestBody: body,
            ...result,
          };

          ResultsWebviewPanel.createOrShow(context, displayData, 'api-test');
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          const action = await vscode.window.showErrorMessage(
            `API test failed: ${msg}`,
            'Configure Flowstral',
            'Try Again'
          );
          if (action === 'Configure Flowstral') {
            vscode.commands.executeCommand('flowstral.configure');
          } else if (action === 'Try Again') {
            vscode.commands.executeCommand('flowstral.runApiTest');
          }
        }
      }
    );
  });
}
