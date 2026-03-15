import * as vscode from 'vscode';
import { FlowstralApiClient } from './client';
import { TestCaseTreeProvider } from './providers/TestCaseTreeProvider';
import { TestRunTreeProvider } from './providers/TestRunTreeProvider';
import { DefectsTreeProvider } from './providers/DefectsTreeProvider';
import { registerRunTestCommand } from './commands/runTest';
import { registerAiGenerateTestCommand } from './commands/aiGenerateTest';
import { registerScanAccessibilityCommand } from './commands/scanAccessibility';
import { registerExploreAppCommand } from './commands/exploreApp';
import { registerRunApiTestCommand } from './commands/runApiTest';
import { ResultsWebviewPanel } from './panels/ResultsWebviewPanel';
import { FlowstralStatusBar } from './statusBar';

let autoRefreshTimer: ReturnType<typeof setInterval> | undefined;
let statusBar: FlowstralStatusBar | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 1. Read configuration
  const config = vscode.workspace.getConfiguration('flowstral');
  const apiUrl = config.get<string>('apiUrl') || 'https://api.flowstral.com';
  const autoRefresh = config.get<boolean>('autoRefresh') ?? true;
  const refreshInterval = config.get<number>('refreshInterval') || 30;

  // 2. Get or prompt for API key
  let apiKey = await context.secrets.get('flowstral.apiKey');

  // Create client
  const client = new FlowstralApiClient(apiUrl, apiKey || undefined);

  // Prompt for API key if not configured
  if (!apiKey) {
    const action = await vscode.window.showInformationMessage(
      'Flowstral: No API key configured. Set up your API key to connect to Flowstral.',
      'Configure Now',
      'Later'
    );
    if (action === 'Configure Now') {
      apiKey = await promptForApiKey(context, client);
    }
  }

  // 3. Register Tree Data Providers
  const testCaseProvider = new TestCaseTreeProvider(client);
  const testRunProvider = new TestRunTreeProvider(client);
  const defectsProvider = new DefectsTreeProvider(client);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('flowstralTestCases', testCaseProvider),
    vscode.window.registerTreeDataProvider('flowstralTestRuns', testRunProvider),
    vscode.window.registerTreeDataProvider('flowstralDefects', defectsProvider)
  );

  // 4. Register Commands
  context.subscriptions.push(
    registerRunTestCommand(context, client, testCaseProvider),
    registerAiGenerateTestCommand(context, client),
    registerScanAccessibilityCommand(context, client),
    registerExploreAppCommand(context, client),
    registerRunApiTestCommand(context, client)
  );

  // Refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('flowstral.refresh', () => {
      testCaseProvider.refresh();
      testRunProvider.refresh();
      defectsProvider.refresh();
      statusBar?.update();
      vscode.window.showInformationMessage('Flowstral: Refreshed all data');
    })
  );

  // Open Dashboard command
  context.subscriptions.push(
    vscode.commands.registerCommand('flowstral.openDashboard', () => {
      const baseUrl = vscode.workspace
        .getConfiguration('flowstral')
        .get<string>('apiUrl') || 'https://api.flowstral.com';
      // Navigate to the web UI (strip /api if present, navigate to dashboard)
      const webUrl = baseUrl
        .replace(/\/api\/?$/, '')
        .replace(/:\d+$/, ':8080');
      vscode.env.openExternal(vscode.Uri.parse(`${webUrl}/dashboard`));
    })
  );

  // View Test Run command (from tree item click)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'flowstral.viewTestRun',
      async (testRun: import('./types').TestRun) => {
        try {
          // Fetch full details
          const fullRun = await client.getTestRun(testRun.id);
          ResultsWebviewPanel.createOrShow(context, fullRun, 'test-run');
        } catch {
          // Use what we have
          ResultsWebviewPanel.createOrShow(context, testRun, 'test-run');
        }
      }
    )
  );

  // Configure command
  context.subscriptions.push(
    vscode.commands.registerCommand('flowstral.configure', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: '$(key) Set API Key',
            description: 'Store your Flowstral API key',
            value: 'apiKey',
          },
          {
            label: '$(gear) Open Settings',
            description: 'Configure API URL, project ID, and more',
            value: 'settings',
          },
          {
            label: '$(plug) Test Connection',
            description: 'Verify connectivity to Flowstral server',
            value: 'test',
          },
        ],
        { placeHolder: 'Configure Flowstral' }
      );

      if (!choice) {
        return;
      }

      switch (choice.value) {
        case 'apiKey':
          await promptForApiKey(context, client);
          // Refresh after key change
          testCaseProvider.refresh();
          testRunProvider.refresh();
          defectsProvider.refresh();
          statusBar?.update();
          break;

        case 'settings':
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'flowstral'
          );
          break;

        case 'test':
          await testConnection(client);
          break;
      }
    })
  );

  // 5. Create Status Bar
  statusBar = new FlowstralStatusBar(client);
  context.subscriptions.push({ dispose: () => statusBar?.dispose() });

  // 6. Auto-refresh
  if (autoRefresh) {
    statusBar.startAutoRefresh(refreshInterval);

    autoRefreshTimer = setInterval(() => {
      testCaseProvider.refresh();
      testRunProvider.refresh();
      defectsProvider.refresh();
    }, refreshInterval * 1000);
  }

  // 7. Listen for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('flowstral')) {
        const newConfig = vscode.workspace.getConfiguration('flowstral');
        const newApiUrl = newConfig.get<string>('apiUrl') || 'https://api.flowstral.com';
        const newAutoRefresh = newConfig.get<boolean>('autoRefresh') ?? true;
        const newRefreshInterval = newConfig.get<number>('refreshInterval') || 30;

        client.setBaseUrl(newApiUrl);

        // Update auto-refresh
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
          autoRefreshTimer = undefined;
        }
        statusBar?.stopAutoRefresh();

        if (newAutoRefresh) {
          statusBar?.startAutoRefresh(newRefreshInterval);
          autoRefreshTimer = setInterval(() => {
            testCaseProvider.refresh();
            testRunProvider.refresh();
            defectsProvider.refresh();
          }, newRefreshInterval * 1000);
        }

        // Refresh immediately
        testCaseProvider.refresh();
        testRunProvider.refresh();
        defectsProvider.refresh();
      }
    })
  );

  // Log activation
  const outputChannel = vscode.window.createOutputChannel('Flowstral');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine(`Flowstral extension activated. API URL: ${apiUrl}`);
}

export function deactivate(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = undefined;
  }
  statusBar?.dispose();
  statusBar = undefined;
}

async function promptForApiKey(
  context: vscode.ExtensionContext,
  client: FlowstralApiClient
): Promise<string | undefined> {
  const key = await vscode.window.showInputBox({
    prompt: 'Enter your Flowstral API key',
    placeHolder: 'fls_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'API key is required';
      }
      return null;
    },
  });

  if (key) {
    await context.secrets.store('flowstral.apiKey', key);
    client.setApiKey(key);
    vscode.window.showInformationMessage('Flowstral: API key saved securely');
    return key;
  }

  return undefined;
}

async function testConnection(client: FlowstralApiClient): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Flowstral: Testing connection...',
    },
    async () => {
      const ok = await client.healthCheck();
      if (ok) {
        vscode.window.showInformationMessage(
          'Flowstral: Connection successful!'
        );
      } else {
        const action = await vscode.window.showErrorMessage(
          'Flowstral: Cannot connect to server. Check your API URL and network.',
          'Open Settings'
        );
        if (action === 'Open Settings') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'flowstral.apiUrl'
          );
        }
      }
    }
  );
}
