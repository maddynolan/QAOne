/**
 * Step Metadata System - Main exports
 * 
 * Provides metadata collection, match analysis, and fingerprinting for test steps.
 * 
 * Usage:
 *   const { MetadataCollector, MatchAnalyzer, FingerprintGenerator } = require('./step-metadata');
 *   
 *   const collector = new MetadataCollector({ debug: true });
 *   const metadata = await collector.collect(page, action);
 *   
 *   const analyzer = new MatchAnalyzer();
 *   const matches = await analyzer.analyze(page, recipe);
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

const MetadataCollector = require('./metadata-collector');
const MatchAnalyzer = require('./match-analyzer');
const FingerprintGenerator = require('./fingerprint-generator');

module.exports = {
  MetadataCollector,
  MatchAnalyzer,
  FingerprintGenerator
};
