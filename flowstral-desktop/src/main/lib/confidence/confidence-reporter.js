/**
 * Confidence Reporter
 * 
 * Generates reports from test execution with confidence data.
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

const THRESHOLDS = require('./confidence-thresholds');

class ConfidenceReporter {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[ConfidenceReporter]') : () => {};
  }

  /**
   * Generate a test report with confidence analysis
   * 
   * @param {Array} actions - The test actions
   * @param {Array} stepResults - Results from executing each step
   * @returns {Object} Complete test report
   */
  generateReport(actions, stepResults) {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this._calculateDuration(stepResults),
      summary: this._generateSummary(stepResults),
      confidence: this._analyzeConfidence(stepResults),
      steps: this._formatStepResults(actions, stepResults),
      recommendations: this._generateRecommendations(stepResults),
      screenshots: this._collectScreenshots(stepResults)
    };

    // Determine overall status
    const hasFailures = stepResults.some(r => r.status === 'FAILED');
    const hasWarnings = stepResults.some(r => 
      r.status === 'PASSED' && r.confidence?.level !== THRESHOLDS.LEVELS.HIGH
    );

    report.status = hasFailures ? 'FAILED' : 
                    hasWarnings ? 'PASSED_WITH_WARNINGS' : 
                    'PASSED';

    this.log('Generated report:', report.status, 'with', report.steps.length, 'steps');
    return report;
  }

  /**
   * Generate a recording summary (before playback)
   */
  generateRecordingSummary(actions, stepMetadata) {
    const confidences = Object.values(stepMetadata).map(m => m?.confidence).filter(Boolean);
    
    return {
      totalSteps: actions.length,
      confidence: {
        high: confidences.filter(c => c.level === THRESHOLDS.LEVELS.HIGH).length,
        medium: confidences.filter(c => c.level === THRESHOLDS.LEVELS.MEDIUM).length,
        low: confidences.filter(c => c.level === THRESHOLDS.LEVELS.LOW).length,
        overall: confidences.length > 0 
          ? Math.round(confidences.reduce((sum, c) => sum + c.score, 0) / confidences.length)
          : 100
      },
      screenshotsCaptured: Object.values(stepMetadata).filter(m => m?.screenshot).length,
      warnings: confidences
        .map((c, i) => ({ step: i + 1, ...c }))
        .filter(c => c.level !== THRESHOLDS.LEVELS.HIGH)
        .map(c => ({
          step: c.step,
          score: c.score,
          reason: c.deductions?.[0] || 'Needs attention'
        }))
    };
  }

  _calculateDuration(stepResults) {
    return stepResults.reduce((sum, r) => sum + (r.duration || 0), 0);
  }

  _generateSummary(stepResults) {
    return {
      total: stepResults.length,
      passed: stepResults.filter(r => r.status === 'PASSED').length,
      failed: stepResults.filter(r => r.status === 'FAILED').length,
      skipped: stepResults.filter(r => r.status === 'SKIPPED').length
    };
  }

  _analyzeConfidence(stepResults) {
    const confidences = stepResults.map(r => r.confidence).filter(Boolean);
    
    return {
      high: confidences.filter(c => c.level === THRESHOLDS.LEVELS.HIGH).length,
      medium: confidences.filter(c => c.level === THRESHOLDS.LEVELS.MEDIUM).length,
      low: confidences.filter(c => c.level === THRESHOLDS.LEVELS.LOW).length,
      overall: confidences.length > 0 
        ? Math.round(confidences.reduce((sum, c) => sum + c.score, 0) / confidences.length)
        : 0
    };
  }

  _formatStepResults(actions, stepResults) {
    return stepResults.map((result, index) => ({
      index: index + 1,
      action: actions[index]?.description || actions[index]?.qword || 'Unknown',
      type: actions[index]?.qword || actions[index]?.type || 'unknown',
      status: result.status,
      confidence: result.confidence,
      matchAnalysis: result.matchAnalysis,
      warnings: result.warnings || [],
      screenshot: result.screenshot?.id || null,
      duration: result.duration || null,
      error: result.error || null,
      visualDrift: result.visualDrift || null
    }));
  }

  _generateRecommendations(stepResults) {
    const recs = [];

    stepResults.forEach((result, index) => {
      if (result.status === 'FAILED') {
        recs.push({
          step: index + 1,
          priority: 'high',
          type: 'fix_failure',
          message: `Step ${index + 1} failed: ${result.error || 'Unknown error'}. Use Element Repair to fix.`
        });
      }

      if (result.confidence?.level === THRESHOLDS.LEVELS.MEDIUM) {
        recs.push({
          step: index + 1,
          priority: 'medium',
          type: 'improve_selector',
          message: result.confidence.recommendation || 
                   `Step ${index + 1} has ${result.confidence.score}% confidence. Consider improving selector.`
        });
      }

      if (result.confidence?.level === THRESHOLDS.LEVELS.LOW) {
        recs.push({
          step: index + 1,
          priority: 'high',
          type: 'fix_selector',
          message: `Step ${index + 1} has LOW confidence (${result.confidence.score}%). Requires immediate attention.`
        });
      }

      if (result.visualDrift && result.visualDrift > 50) {
        recs.push({
          step: index + 1,
          priority: 'medium',
          type: 'element_moved',
          message: `Step ${index + 1}: Element moved ${result.visualDrift}px since recording. Verify correct element.`
        });
      }

      // Multiple matches warning
      if (result.confidence?.matchCount > 1) {
        recs.push({
          step: index + 1,
          priority: result.confidence.matchCount > 3 ? 'high' : 'medium',
          type: 'multiple_matches',
          message: `Step ${index + 1}: ${result.confidence.matchCount} elements match. Position ${result.confidence.usedPosition} was used.`
        });
      }
    });

    // Sort by priority
    return recs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  _collectScreenshots(stepResults) {
    return stepResults
      .map((r, index) => r.screenshot ? {
        stepIndex: index + 1,
        id: r.screenshot.id,
        type: r.screenshot.type,
        reason: r.screenshot.reason,
        timestamp: r.screenshot.timestamp
      } : null)
      .filter(Boolean);
  }

  /**
   * Format report as plain text (for console/logs)
   */
  formatAsText(report) {
    const lines = [
      `\n${'='.repeat(60)}`,
      `TEST REPORT: ${report.status}`,
      `${'='.repeat(60)}`,
      ``,
      `Summary:`,
      `  Total Steps: ${report.summary.total}`,
      `  Passed: ${report.summary.passed}`,
      `  Failed: ${report.summary.failed}`,
      `  Duration: ${(report.duration / 1000).toFixed(2)}s`,
      ``,
      `Confidence:`,
      `  Overall: ${report.confidence.overall}%`,
      `  High: ${report.confidence.high}`,
      `  Medium: ${report.confidence.medium}`,
      `  Low: ${report.confidence.low}`,
      ``
    ];

    if (report.recommendations.length > 0) {
      lines.push(`Recommendations:`);
      report.recommendations.forEach(rec => {
        const icon = rec.priority === 'high' ? '❌' : '⚠️';
        lines.push(`  ${icon} Step ${rec.step}: ${rec.message}`);
      });
      lines.push(``);
    }

    lines.push(`${'='.repeat(60)}\n`);
    return lines.join('\n');
  }
}

module.exports = ConfidenceReporter;
