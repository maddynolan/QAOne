import * as vscode from 'vscode';
import { FlowstralApiClient } from '../client';
import { Defect } from '../types';

export class DefectItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly defect?: Defect,
    public readonly severityGroup?: string
  ) {
    super(label, collapsibleState);

    if (defect) {
      this.contextValue = 'defect';
      this.description = defect.status;
      this.tooltip = this.buildTooltip(defect);

      // Severity-based icon
      switch (defect.severity) {
        case 'critical':
          this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
          break;
        case 'high':
          this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
          break;
        case 'medium':
          this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('list.deemphasizedForeground'));
          break;
        case 'low':
          this.iconPath = new vscode.ThemeIcon('circle-outline');
          break;
        default:
          this.iconPath = new vscode.ThemeIcon('bug');
      }
    } else if (severityGroup) {
      // Severity group header
      this.contextValue = 'severityGroup';
      switch (severityGroup) {
        case 'critical':
          this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
          break;
        case 'high':
          this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
          break;
        case 'medium':
          this.iconPath = new vscode.ThemeIcon('info');
          break;
        case 'low':
          this.iconPath = new vscode.ThemeIcon('circle-outline');
          break;
      }
    }
  }

  private buildTooltip(defect: Defect): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${defect.title}**\n\n`);
    md.appendMarkdown(`Severity: ${defect.severity}\n\n`);
    md.appendMarkdown(`Status: ${defect.status}\n\n`);
    if (defect.description) {
      md.appendMarkdown(`${defect.description}\n\n`);
    }
    if (defect.assignee) {
      md.appendMarkdown(`Assignee: ${defect.assignee}\n\n`);
    }
    if (defect.created_at) {
      md.appendMarkdown(`Created: ${new Date(defect.created_at).toLocaleDateString()}`);
    }
    return md;
  }
}

export class DefectsTreeProvider implements vscode.TreeDataProvider<DefectItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DefectItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private defects: Defect[] = [];
  private isLoading = false;
  private loadError: string | undefined;

  constructor(private client: FlowstralApiClient) {}

  refresh(): void {
    this.defects = [];
    this.loadError = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DefectItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DefectItem): Promise<DefectItem[]> {
    if (this.isLoading && !element) {
      return [new DefectItem('Loading...', vscode.TreeItemCollapsibleState.None)];
    }

    if (!element) {
      return this.getRootChildren();
    }

    // Children of a severity group
    if (element.severityGroup) {
      return this.getSeverityChildren(element.severityGroup);
    }

    return [];
  }

  private async getRootChildren(): Promise<DefectItem[]> {
    if (this.defects.length === 0 && !this.loadError) {
      this.isLoading = true;
      try {
        const config = vscode.workspace.getConfiguration('flowstral');
        const projectId = config.get<string>('projectId') || undefined;
        this.defects = await this.client.getDefects(projectId);
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : 'Unknown error';
        this.isLoading = false;
        const errorItem = new DefectItem(
          'Failed to load defects',
          vscode.TreeItemCollapsibleState.None
        );
        errorItem.description = 'Click Refresh to retry';
        errorItem.iconPath = new vscode.ThemeIcon('warning');
        return [errorItem];
      }
      this.isLoading = false;
    }

    if (this.loadError) {
      const errorItem = new DefectItem(
        'Failed to load defects',
        vscode.TreeItemCollapsibleState.None
      );
      errorItem.description = 'Click Refresh to retry';
      errorItem.iconPath = new vscode.ThemeIcon('warning');
      return [errorItem];
    }

    if (this.defects.length === 0) {
      const emptyItem = new DefectItem(
        'No defects found',
        vscode.TreeItemCollapsibleState.None
      );
      emptyItem.iconPath = new vscode.ThemeIcon('check');
      return [emptyItem];
    }

    // Group by severity
    const severities: Array<{ key: string; label: string }> = [
      { key: 'critical', label: 'Critical' },
      { key: 'high', label: 'High' },
      { key: 'medium', label: 'Medium' },
      { key: 'low', label: 'Low' },
    ];

    const items: DefectItem[] = [];
    for (const sev of severities) {
      const count = this.defects.filter((d) => d.severity === sev.key).length;
      if (count > 0) {
        const item = new DefectItem(
          `${sev.label} (${count})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          sev.key
        );
        items.push(item);
      }
    }

    // Also include any defects with unrecognized severity
    const knownSeverities = new Set(['critical', 'high', 'medium', 'low']);
    const other = this.defects.filter((d) => !knownSeverities.has(d.severity));
    if (other.length > 0) {
      const item = new DefectItem(
        `Other (${other.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        'other'
      );
      items.push(item);
    }

    return items;
  }

  private getSeverityChildren(severity: string): DefectItem[] {
    const knownSeverities = new Set(['critical', 'high', 'medium', 'low']);
    const filtered =
      severity === 'other'
        ? this.defects.filter((d) => !knownSeverities.has(d.severity))
        : this.defects.filter((d) => d.severity === severity);

    return filtered.map(
      (defect) =>
        new DefectItem(defect.title, vscode.TreeItemCollapsibleState.None, defect)
    );
  }
}
