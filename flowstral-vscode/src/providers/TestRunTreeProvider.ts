import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { TestRun } from '../types';

export class TestRunItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly testRun?: TestRun
  ) {
    super(label, collapsibleState);

    if (testRun) {
      this.contextValue = 'testRun';

      // Status icon
      if (testRun.status === 'passed') {
        this.iconPath = new vscode.ThemeIcon('testing-passed-icon', new vscode.ThemeColor('testing.iconPassed'));
      } else if (testRun.status === 'failed') {
        this.iconPath = new vscode.ThemeIcon('testing-failed-icon', new vscode.ThemeColor('testing.iconFailed'));
      } else if (testRun.status === 'running') {
        this.iconPath = new vscode.ThemeIcon('loading~spin');
      } else {
        this.iconPath = new vscode.ThemeIcon('testing-error-icon', new vscode.ThemeColor('testing.iconErrored'));
      }

      // Description: duration + timestamp
      const parts: string[] = [];
      if (testRun.duration_ms) {
        parts.push(this.formatDuration(testRun.duration_ms));
      }
      if (testRun.started_at) {
        parts.push(this.formatTimestamp(testRun.started_at));
      }
      this.description = parts.join(' - ');

      // Tooltip
      this.tooltip = this.buildTooltip(testRun);

      // Click opens results
      this.command = {
        title: 'View Test Run',
        command: 'flowstral.viewTestRun',
        arguments: [testRun],
      };
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) {
      return 'just now';
    }
    if (diffMin < 60) {
      return `${diffMin}m ago`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString();
  }

  private buildTooltip(run: TestRun): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${run.test_name || run.test_case_id}**\n\n`);
    md.appendMarkdown(`Status: ${run.status}\n\n`);
    if (run.duration_ms) {
      md.appendMarkdown(`Duration: ${this.formatDuration(run.duration_ms)}\n\n`);
    }
    if (run.steps_total !== undefined) {
      md.appendMarkdown(`Steps: ${run.steps_passed || 0}/${run.steps_total} passed`);
      if (run.steps_failed) {
        md.appendMarkdown(` (${run.steps_failed} failed)`);
      }
      md.appendMarkdown('\n\n');
    }
    if (run.started_at) {
      md.appendMarkdown(`Started: ${new Date(run.started_at).toLocaleString()}`);
    }
    return md;
  }
}

export class TestRunTreeProvider implements vscode.TreeDataProvider<TestRunItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TestRunItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private testRuns: TestRun[] = [];
  private isLoading = false;
  private loadError: string | undefined;

  constructor(private client: FlowstralApiClient) {}

  refresh(): void {
    this.testRuns = [];
    this.loadError = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TestRunItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TestRunItem): Promise<TestRunItem[]> {
    if (element) {
      return [];
    }

    if (this.isLoading) {
      return [new TestRunItem('Loading...', vscode.TreeItemCollapsibleState.None)];
    }

    if (this.testRuns.length === 0 && !this.loadError) {
      this.isLoading = true;
      try {
        this.testRuns = await this.client.listTestRuns(20);
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : 'Unknown error';
        this.isLoading = false;
        const errorItem = new TestRunItem(
          'Failed to load test runs',
          vscode.TreeItemCollapsibleState.None
        );
        errorItem.description = 'Click Refresh to retry';
        errorItem.iconPath = new vscode.ThemeIcon('warning');
        return [errorItem];
      }
      this.isLoading = false;
    }

    if (this.loadError) {
      const errorItem = new TestRunItem(
        'Failed to load test runs',
        vscode.TreeItemCollapsibleState.None
      );
      errorItem.description = 'Click Refresh to retry';
      errorItem.iconPath = new vscode.ThemeIcon('warning');
      return [errorItem];
    }

    if (this.testRuns.length === 0) {
      const emptyItem = new TestRunItem(
        'No recent runs',
        vscode.TreeItemCollapsibleState.None
      );
      emptyItem.iconPath = new vscode.ThemeIcon('info');
      return [emptyItem];
    }

    // Sort by most recent first
    const sorted = [...this.testRuns].sort((a, b) => {
      const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
      const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
      return bTime - aTime;
    });

    return sorted.map(
      (run) =>
        new TestRunItem(
          run.test_name || `Run ${run.id.slice(0, 8)}`,
          vscode.TreeItemCollapsibleState.None,
          run
        )
    );
  }
}
