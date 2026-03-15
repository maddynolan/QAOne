import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { ResultsWebviewPanel } from '../panels/ResultsWebviewPanel';

export function registerAiGenerateTestCommand(
  context: vscode.ExtensionContext,
  client: FlowstralApiClient
): vscode.Disposable {
  return vscode.commands.registerCommand('flowstral.aiGenerateTest', async () => {
    // Step 1: Get test description
    const description = await vscode.window.showInputBox({
      prompt: 'Describe what to test',
      placeHolder: 'e.g., Test login with valid credentials on example.com',
      ignoreFocusOut: true,
    });

    if (!description) {
      return;
    }

    // Step 2: Get target URL
    const targetUrl = await vscode.window.showInputBox({
      prompt: 'Enter the target URL to test',
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

    if (!targetUrl) {
      return;
    }

    // Step 3: Execute with progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Flowstral AI Test Generation',
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ message: 'Starting AI test generation...' });

        const events: Array<{ type: string; data: unknown }> = [];

        try {
          const result = await client.aiGenerateTest(
            description,
            targetUrl,
            (event) => {
              events.push(event);

              // Update progress based on event type
              if (token.isCancellationRequested) {
                return;
              }

              const eventData = event.data as Record<string, unknown>;
              switch (event.type) {
                case 'phase':
                  progress.report({
                    message: `Phase: ${eventData.phase || eventData.message || 'Processing...'}`,
                  });
                  break;
                case 'intent':
                  progress.report({
                    message: `Understanding: ${eventData.intent || 'Analyzing...'}`,
                  });
                  break;
                case 'plan':
                  progress.report({
                    message: `Planning: ${eventData.steps || 'Building test plan...'}`,
                  });
                  break;
                case 'step':
                  progress.report({
                    message: `Executing: ${eventData.action || eventData.description || 'Running step...'}`,
                  });
                  break;
                case 'screenshot':
                  progress.report({ message: 'Capturing screenshot...' });
                  break;
              }
            }
          );

          if (token.isCancellationRequested) {
            return;
          }

          // Show results
          progress.report({ message: 'Preparing results...' });

          const displayData = {
            description,
            targetUrl,
            events,
            ...result,
          };

          ResultsWebviewPanel.createOrShow(context, displayData, 'ai-test');

          vscode.window.showInformationMessage(
            `AI test generation complete for "${description}"`
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          const action = await vscode.window.showErrorMessage(
            `AI test generation failed: ${msg}`,
            'Configure Flowstral',
            'Try Again'
          );
          if (action === 'Configure Flowstral') {
            vscode.commands.executeCommand('flowstral.configure');
          } else if (action === 'Try Again') {
            vscode.commands.executeCommand('flowstral.aiGenerateTest');
          }
        }
      }
    );
  });
}
