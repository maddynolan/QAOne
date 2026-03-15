import * as vscode from 'vscode';
import { FlowstralApiClient } from './client';

export class FlowstralStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;

  constructor(
    private client: FlowstralApiClient
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'flowstral.openDashboard';
    this.statusBarItem.text = '$(beaker) Flowstral';
    this.statusBarItem.tooltip = 'Flowstral QA - Click to open dashboard';
    this.statusBarItem.show();
  }

  async update(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      const metrics = await this.client.getDashboard();

      const passed = metrics.passed_tests || 0;
      const total = metrics.total_tests || 0;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

      this.statusBarItem.text = `$(beaker) Flowstral: ${passed}/${total}`;

      // Color based on pass rate
      if (passRate > 90) {
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = '#22c55e';
      } else if (passRate > 70) {
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = '#f59e0b';
      } else if (total > 0) {
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
        this.statusBarItem.color = undefined;
      }

      const tooltipParts = [
        `Flowstral QA Dashboard`,
        `Pass rate: ${passRate}% (${passed}/${total})`,
        `Failed: ${metrics.failed_tests || 0}`,
        `Open defects: ${metrics.defects_open || 0}`,
        ``,
        `Click to open dashboard`,
      ];
      this.statusBarItem.tooltip = tooltipParts.join('\n');
    } catch {
      // Silently fail — show basic text
      this.statusBarItem.text = '$(beaker) Flowstral';
      this.statusBarItem.tooltip = 'Flowstral QA - Click to open dashboard\n(Could not fetch metrics)';
      this.statusBarItem.color = undefined;
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  startAutoRefresh(intervalSeconds: number): void {
    this.stopAutoRefresh();
    // Initial update
    this.update();
    // Periodic refresh
    this.refreshTimer = setInterval(() => {
      this.update();
    }, intervalSeconds * 1000);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopAutoRefresh();
    this.statusBarItem.dispose();
  }
}
