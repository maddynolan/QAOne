import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { TestCaseTreeProvider, TestCaseItem } from '../providers/TestCaseTreeProvider';
import { ResultsWebviewPanel } from '../panels/ResultsWebviewPanel';
import { TestCase } from '../types';

export function registerRunTestCommand(
  context: vscode.ExtensionContext,
  client: FlowstralApiClient,
  testCaseProvider: TestCaseTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'flowstral.runTest',
    async (item?: TestCaseItem) => {
      let testCase: TestCase | undefined;

      if (item?.testCase) {
        // Called from tree item context menu
        testCase = item.testCase;
      } else {
        // Called from command palette — show QuickPick
        const testCases = testCaseProvider.getTestCases();
        if (testCases.length === 0) {
          // Try fetching fresh
          try {
            const config = vscode.workspace.getConfiguration('flowstral');
            const projectId = config.get<string>('projectId') || undefined;
            const freshCases = await client.listTestCases(projectId);
            if (freshCases.length === 0) {
              vscode.window.showInformationMessage(
                'No test cases found. Create test cases in Flowstral first.'
              );
              return;
            }
            testCase = await pickTestCase(freshCases);
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            const action = await vscode.window.showErrorMessage(
              `Failed to load test cases: ${msg}`,
              'Configure Flowstral'
            );
            if (action === 'Configure Flowstral') {
              vscode.commands.executeCommand('flowstral.configure');
            }
            return;
          }
        } else {
          testCase = await pickTestCase(testCases);
        }
      }

      if (!testCase) {
        return;
      }

      // Execute the test
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Running test: ${testCase.name}`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Starting test execution...' });

          try {
            const result = await client.runTestCase(testCase!.id);

            // If the initial response is "running", poll for completion
            if (result.status === 'running' && result.id) {
              progress.report({ message: 'Test is running...' });
              const finalResult = await pollTestRun(client, result.id);
              showTestResult(context, finalResult.test_name || testCase!.name, finalResult);
            } else {
              showTestResult(context, testCase!.name, result);
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Test execution failed: ${msg}`);
          }
        }
      );
    }
  );
}

async function pickTestCase(testCases: TestCase[]): Promise<TestCase | undefined> {
  const items = testCases.map((tc) => ({
    label: tc.name,
    description: tc.status || '',
    detail: tc.folder_name ? `Folder: ${tc.folder_name}` : undefined,
    testCase: tc,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a test case to run',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  return selected?.testCase;
}

async function pollTestRun(
  client: FlowstralApiClient,
  runId: string,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<import('../types').TestRun> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const run = await client.getTestRun(runId);
    if (run.status !== 'running') {
      return run;
    }
  }
  throw new Error('Test run timed out after 2 minutes');
}

function showTestResult(
  context: vscode.ExtensionContext,
  testName: string,
  result: import('../types').TestRun
): void {
  // Show info message
  if (result.status === 'passed') {
    vscode.window.showInformationMessage(
      `Test "${testName}" PASSED (${result.steps_passed || 0}/${result.steps_total || 0} steps)`
    );
  } else {
    vscode.window.showWarningMessage(
      `Test "${testName}" FAILED (${result.steps_failed || 0} steps failed)`
    );
  }

  // Open results webview
  ResultsWebviewPanel.createOrShow(context, result, 'test-run');
}
