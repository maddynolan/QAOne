/**
 * Confidence System - Main exports
 * 
 * Provides confidence scoring, calculation, and reporting for test automation.
 * 
 * Usage:
 *   const { ConfidenceCalculator, ConfidenceReporter, THRESHOLDS } = require('./confidence');
 *   
 *   const calculator = new ConfidenceCalculator({ debug: true });
 *   const confidence = calculator.calculate(recipe, matchAnalysis, findResult);
 *   
 *   const reporter = new ConfidenceReporter();
 *   const report = reporter.generateReport(actions, stepResults);
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

const ConfidenceCalculator = require('./confidence-calculator');
const ConfidenceReporter = require('./confidence-reporter');
const THRESHOLDS = require('./confidence-thresholds');

module.exports = {
  ConfidenceCalculator,
  ConfidenceReporter,
  THRESHOLDS
};
