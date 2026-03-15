import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { TestCase } from '../types';

export class TestCaseItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly testCase?: TestCase,
    public readonly folderId?: string,
    public readonly folderName?: string
  ) {
    super(label, collapsibleState);

    if (testCase) {
      // Leaf node — a test case
      this.contextValue = 'testCase';
      this.description = testCase.status || '';
      this.tooltip = this.buildTooltip(testCase);

      // Status icon
      if (testCase.status === 'passed') {
        this.iconPath = new vscode.ThemeIcon('testing-passed-icon', new vscode.ThemeColor('testing.iconPassed'));
      } else if (testCase.status === 'failed') {
        this.iconPath = new vscode.ThemeIcon('testing-failed-icon', new vscode.ThemeColor('testing.iconFailed'));
      } else {
        this.iconPath = new vscode.ThemeIcon('testing-unset-icon');
      }
    } else {
      // Folder node
      this.contextValue = 'folder';
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }

  private buildTooltip(tc: TestCase): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${tc.name}**\n\n`);
    md.appendMarkdown(`Status: ${tc.status || 'unknown'}\n\n`);
    if (tc.steps && tc.steps.length > 0) {
      md.appendMarkdown(`Steps: ${tc.steps.length}\n\n`);
    }
    if (tc.priority) {
      md.appendMarkdown(`Priority: ${tc.priority}\n\n`);
    }
    if (tc.created_at) {
      md.appendMarkdown(`Created: ${new Date(tc.created_at).toLocaleDateString()}`);
    }
    return md;
  }
}

export class TestCaseTreeProvider implements vscode.TreeDataProvider<TestCaseItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TestCaseItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private testCases: TestCase[] = [];
  private isLoading = false;
  private loadError: string | undefined;

  constructor(private client: FlowstralApiClient) {}

  refresh(): void {
    this.testCases = [];
    this.loadError = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TestCaseItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TestCaseItem): Promise<TestCaseItem[]> {
    if (this.isLoading) {
      return [new TestCaseItem('Loading...', vscode.TreeItemCollapsibleState.None)];
    }

    if (!element) {
      // Root level — fetch and group by folder
      return this.getRootChildren();
    }

    // Children of a folder
    if (element.folderId) {
      return this.getFolderChildren(element.folderId);
    }

    return [];
  }

  private async getRootChildren(): Promise<TestCaseItem[]> {
    if (this.testCases.length === 0 && !this.loadError) {
      this.isLoading = true;
      try {
        const config = vscode.workspace.getConfiguration('flowstral');
        const projectId = config.get<string>('projectId') || undefined;
        this.testCases = await this.client.listTestCases(projectId);
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : 'Unknown error';
        this.isLoading = false;
        const errorItem = new TestCaseItem(
          'Failed to load test cases',
          vscode.TreeItemCollapsibleState.None
        );
        errorItem.description = 'Click Refresh to retry';
        errorItem.iconPath = new vscode.ThemeIcon('warning');
        return [errorItem];
      }
      this.isLoading = false;
    }

    if (this.loadError) {
      const errorItem = new TestCaseItem(
        'Failed to load test cases',
        vscode.TreeItemCollapsibleState.None
      );
      errorItem.description = 'Click Refresh to retry';
      errorItem.iconPath = new vscode.ThemeIcon('warning');
      return [errorItem];
    }

    if (this.testCases.length === 0) {
      const emptyItem = new TestCaseItem(
        'No test cases found',
        vscode.TreeItemCollapsibleState.None
      );
      emptyItem.iconPath = new vscode.ThemeIcon('info');
      return [emptyItem];
    }

    // Group test cases by folder
    const folders = new Map<string, { name: string; cases: TestCase[] }>();
    const ungrouped: TestCase[] = [];

    for (const tc of this.testCases) {
      if (tc.folder_id) {
        const existing = folders.get(tc.folder_id);
        if (existing) {
          existing.cases.push(tc);
        } else {
          folders.set(tc.folder_id, {
            name: tc.folder_name || `Folder ${tc.folder_id.slice(0, 8)}`,
            cases: [tc],
          });
        }
      } else {
        ungrouped.push(tc);
      }
    }

    const items: TestCaseItem[] = [];

    // Add folder items
    for (const [folderId, folder] of folders) {
      const folderItem = new TestCaseItem(
        folder.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        folderId,
        folder.name
      );
      folderItem.description = `${folder.cases.length} tests`;
      items.push(folderItem);
    }

    // Add ungrouped test cases
    for (const tc of ungrouped) {
      items.push(
        new TestCaseItem(
          tc.name,
          vscode.TreeItemCollapsibleState.None,
          tc
        )
      );
    }

    return items;
  }

  private getFolderChildren(folderId: string): TestCaseItem[] {
    const folderCases = this.testCases.filter((tc) => tc.folder_id === folderId);
    return folderCases.map(
      (tc) => new TestCaseItem(tc.name, vscode.TreeItemCollapsibleState.None, tc)
    );
  }

  getTestCases(): TestCase[] {
    return this.testCases;
  }
}
