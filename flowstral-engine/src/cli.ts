#!/usr/bin/env node
/**
 * Flowstral CLI - Command line interface for the Flowstral recorder
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FlowstralEngine } from './core/FlowstralEngine';
import { SessionManager, FileSessionStorage } from './core/SessionManager';
import { PlaywrightScriptGenerator, PageObjectGenerator } from './generator/PlaywrightScriptGenerator';
import { ApplicationDetector } from './detection/ApplicationDetector';
import { ApplicationFingerprint } from './types';
import { VERSION, SUPPORTED_APPLICATIONS } from './index';

const program = new Command();

program
  .name('flowstral')
  .description('Enterprise application test recorder with auto-healing locators')
  .version(VERSION);

/**
 * Generate script from session file
 */
program
  .command('generate')
  .description('Generate Playwright script from a session file')
  .argument('<session-file>', 'Path to session JSON file')
  .option('-o, --output <path>', 'Output file path')
  .option('-p, --page-object', 'Generate Page Object Model')
  .option('--no-healing', 'Disable auto-healing locators')
  .action(async (sessionFile: string, options) => {
    try {
      console.log(`\n🎬 Flowstral v${VERSION}\n`);
      console.log(`Loading session from: ${sessionFile}`);
      
      const sessionData = await fs.readFile(sessionFile, 'utf-8');
      const session = JSON.parse(sessionData);
      
      const defaultFingerprint: ApplicationFingerprint = {
        application: session.application?.application || 'unknown',
        confidence: session.application?.confidence || 0,
        detectionMethod: session.application?.detectionMethod || 'dom-signature',
        shadowDomEnabled: session.application?.shadowDomEnabled || false
      };
      const generator = new PlaywrightScriptGenerator(defaultFingerprint);
      const generatedScript = generator.generateScript(session);
      const script = generatedScript.code;
      
      const outputPath = options.output || sessionFile.replace('.json', '.spec.ts');
      await fs.writeFile(outputPath, script);
      console.log(`✅ Generated script: ${outputPath}`);
      
      if (options.pageObject) {
        const poGenerator = new PageObjectGenerator(defaultFingerprint);
        const pageObject = poGenerator.generatePageObject(session);
        const poPath = outputPath.replace('.spec.ts', '.page.ts');
        await fs.writeFile(poPath, pageObject);
        console.log(`✅ Generated Page Object: ${poPath}`);
      }
      
      console.log(`\n📊 Statistics:`);
      console.log(`   - Actions: ${session.actions?.length || 0}`);
      console.log(`   - Actions: ${session.actions?.length || 0}`);
      console.log(`   - Application: ${session.application || 'unknown'}`);
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * List supported applications
 */
program
  .command('apps')
  .description('List all supported enterprise applications')
  .action(() => {
    console.log(`\n🎬 Flowstral v${VERSION}`);
    console.log(`\n📋 Supported Applications (${SUPPORTED_APPLICATIONS.length}):\n`);
    
    const categories: Record<string, string[]> = {
      'CRM & Sales': ['salesforce', 'dynamics-365', 'hubspot', 'zoho', 'veeva'],
      'HR & Workforce': ['workday', 'successfactors'],
      'IT Service Management': ['servicenow', 'zendesk', 'freshworks', 'jira'],
      'ERP & Finance': ['sap', 'oracle-fusion', 'netsuite'],
      'BPM & Low-Code': ['pega'],
      'Procurement': ['coupa', 'ariba', 'concur'],
      'Analytics & BI': ['tableau', 'powerbi', 'snowflake', 'anaplan'],
      'Collaboration': ['confluence', 'monday', 'asana']
    };
    
    for (const [category, apps] of Object.entries(categories)) {
      console.log(`  ${category}:`);
      apps.forEach(app => {
        const supported = SUPPORTED_APPLICATIONS.includes(app as any);
        console.log(`    ${supported ? '✅' : '❌'} ${app}`);
      });
      console.log();
    }
  });

/**
 * Analyze a session file
 */
program
  .command('analyze')
  .description('Analyze a recording session')
  .argument('<session-file>', 'Path to session JSON file')
  .action(async (sessionFile: string) => {
    try {
      console.log(`\n🎬 Flowstral v${VERSION}\n`);
      console.log(`Analyzing: ${sessionFile}\n`);
      
      const sessionData = await fs.readFile(sessionFile, 'utf-8');
      const session = JSON.parse(sessionData);
      
      console.log('📊 Session Analysis:');
      console.log('━'.repeat(50));
      console.log(`  Name: ${session.name}`);
      console.log(`  Application: ${session.application}`);
      console.log(`  Base URL: ${session.baseUrl}`);
      console.log(`  Duration: ${session.endTime ? Math.round((session.endTime - session.startTime) / 1000) : 'N/A'}s`);
      console.log(`  Status: ${session.status}`);
      console.log();
      
      // Action breakdown
      const actionTypes: Record<string, number> = {};
      (session.actions || []).forEach((action: any) => {
        actionTypes[action.type] = (actionTypes[action.type] || 0) + 1;
      });
      
      console.log('📋 Action Breakdown:');
      console.log('━'.repeat(50));
      Object.entries(actionTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type.padEnd(15)} ${count}`);
        });
      console.log(`  ${'TOTAL'.padEnd(15)} ${session.actions?.length || 0}`);
      console.log();
      
      // Element analysis
      if (session.elements?.length > 0) {
        console.log('🎯 Element Analysis:');
        console.log('━'.repeat(50));
        
        const shadowElements = session.elements.filter((e: any) => e.shadowPath);
        const withTestId = session.elements.filter((e: any) => 
          e.dataAttributes?.['data-testid'] || e.dataAttributes?.['data-automation-id']
        );
        
        console.log(`  Total elements: ${session.elements.length}`);
        console.log(`  Shadow DOM elements: ${shadowElements.length}`);
        console.log(`  With test IDs: ${withTestId.length}`);
        console.log();
        
        // Locator quality
        const locatorQuality = session.elements.reduce((acc: any, el: any) => {
          if (el.locator?.strategies?.length >= 3) acc.excellent++;
          else if (el.locator?.strategies?.length >= 2) acc.good++;
          else acc.poor++;
          return acc;
        }, { excellent: 0, good: 0, poor: 0 });
        
        console.log('🎯 Locator Quality:');
        console.log('━'.repeat(50));
        console.log(`  Excellent (3+ strategies): ${locatorQuality.excellent}`);
        console.log(`  Good (2 strategies): ${locatorQuality.good}`);
        console.log(`  Poor (1 strategy): ${locatorQuality.poor}`);
      }
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Convert between formats
 */
program
  .command('convert')
  .description('Convert session between formats')
  .argument('<input-file>', 'Input file path')
  .option('-f, --format <format>', 'Output format (json, har, side)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .action(async (inputFile: string, options) => {
    try {
      console.log(`\n🎬 Flowstral v${VERSION}\n`);
      
      const inputData = await fs.readFile(inputFile, 'utf-8');
      const session = JSON.parse(inputData);
      
      const storage = new FileSessionStorage();
      const manager = new SessionManager(storage);
      
      // Save to storage first
      await storage.save(session);
      
      const exported = await manager.exportSession(session.id, options.format);
      const outputPath = options.output || inputFile.replace(/\.\w+$/, `.${options.format}`);
      
      await fs.writeFile(outputPath, exported);
      console.log(`✅ Converted to ${options.format}: ${outputPath}`);
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Merge multiple sessions
 */
program
  .command('merge')
  .description('Merge multiple session files')
  .argument('<sessions...>', 'Session files to merge')
  .option('-n, --name <name>', 'Name for merged session', 'Merged Session')
  .option('-o, --output <path>', 'Output file path')
  .action(async (sessions: string[], options) => {
    try {
      console.log(`\n🎬 Flowstral v${VERSION}\n`);
      console.log(`Merging ${sessions.length} sessions...\n`);
      
      const storage = new FileSessionStorage();
      const manager = new SessionManager(storage);
      
      // Load all sessions
      const loadedSessions = [];
      for (const sessionFile of sessions) {
        const data = await fs.readFile(sessionFile, 'utf-8');
        const session = JSON.parse(data);
        await storage.save(session);
        loadedSessions.push(session);
      }
      
      // Merge
      const merged = await manager.mergeSessions(
        loadedSessions.map(s => s.id),
        options.name
      );
      
      if (merged) {
        const outputPath = options.output || 'merged-session.json';
        await fs.writeFile(outputPath, JSON.stringify(merged, null, 2));
        console.log(`✅ Merged session saved: ${outputPath}`);
        console.log(`   Total actions: ${merged.actions.length}`);
        console.log(`   Total actions: ${merged.actions.length}`);
      }
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Validate session file
 */
program
  .command('validate')
  .description('Validate a session file')
  .argument('<session-file>', 'Path to session JSON file')
  .action(async (sessionFile: string) => {
    try {
      console.log(`\n🎬 Flowstral v${VERSION}\n`);
      console.log(`Validating: ${sessionFile}\n`);
      
      const sessionData = await fs.readFile(sessionFile, 'utf-8');
      const session = JSON.parse(sessionData);
      
      const issues: string[] = [];
      const warnings: string[] = [];
      
      // Check required fields
      if (!session.id) issues.push('Missing session ID');
      // Name is not part of RecordingSession interface
      if (!session.actions || !Array.isArray(session.actions)) {
        issues.push('Missing or invalid actions array');
      }
      // Elements are not part of RecordingSession - they're in context
      
      // Check actions
      session.actions?.forEach((action: any, index: number) => {
        if (!action.id) issues.push(`Action ${index}: Missing ID`);
        if (!action.type) issues.push(`Action ${index}: Missing type`);
        if (!action.timestamp) warnings.push(`Action ${index}: Missing timestamp`);
      });
      
      // Report
      if (issues.length === 0 && warnings.length === 0) {
        console.log('✅ Session is valid!\n');
      } else {
        if (issues.length > 0) {
          console.log('❌ Issues (must fix):');
          issues.forEach(i => console.log(`   - ${i}`));
          console.log();
        }
        if (warnings.length > 0) {
          console.log('⚠️  Warnings:');
          warnings.forEach(w => console.log(`   - ${w}`));
          console.log();
        }
      }
      
      process.exit(issues.length > 0 ? 1 : 0);
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Generate injection scripts
 */
program
  .command('scripts')
  .description('Generate browser injection scripts')
  .option('-o, --output <dir>', 'Output directory', './flowstral-scripts')
  .action(async (options) => {
    try {
      console.log(`\n🎬 Flowstral v${VERSION}\n`);
      
      const engine = new FlowstralEngine();
      const scripts = engine.getInjectionScripts();
      
      await fs.mkdir(options.output, { recursive: true });
      
      await fs.writeFile(
        path.join(options.output, 'detector.js'),
        scripts.detector
      );
      await fs.writeFile(
        path.join(options.output, 'collector.js'),
        scripts.collector
      );
      await fs.writeFile(
        path.join(options.output, 'recorder.js'),
        scripts.recorder
      );
      
      // Create combined script
      const combined = `
// Flowstral Combined Injection Script v${VERSION}
// Generated: ${new Date().toISOString()}

${scripts.detector}

${scripts.collector}

${scripts.recorder}

console.log('[Flowstral] All scripts loaded');
`;
      
      await fs.writeFile(
        path.join(options.output, 'flowstral-all.js'),
        combined
      );
      
      console.log(`✅ Generated scripts in: ${options.output}`);
      console.log('   - detector.js');
      console.log('   - collector.js');
      console.log('   - recorder.js');
      console.log('   - flowstral-all.js (combined)');
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Show application detection info
 */
program
  .command('detect-info')
  .description('Show detection patterns for an application')
  .argument('<app>', 'Application name')
  .action((app: string) => {
    console.log(`\n🎬 Flowstral v${VERSION}\n`);
    
    const detector = new ApplicationDetector();
    const rules = (detector as any).detectionRules;
    
    const appRule = rules.find((r: any) => r.application === app);
    
    if (!appRule) {
      console.log(`❌ Unknown application: ${app}`);
      console.log(`\nAvailable applications:`);
      SUPPORTED_APPLICATIONS.forEach(a => console.log(`  - ${a}`));
      process.exit(1);
    }
    
    console.log(`📋 Detection Patterns for: ${app}\n`);
    console.log('URL Patterns:');
    appRule.urlPatterns?.forEach((p: RegExp) => console.log(`  - ${p}`));
    
    console.log('\nDOM Signatures:');
    appRule.domSignatures?.forEach((s: string) => console.log(`  - ${s}`));
    
    console.log('\nGlobal Objects:');
    appRule.globalObjects?.forEach((o: string) => console.log(`  - ${o}`));
    
    if (appRule.customElements?.length) {
      console.log('\nCustom Elements:');
      appRule.customElements.forEach((e: string) => console.log(`  - ${e}`));
    }
    
    if (appRule.cssVariables?.length) {
      console.log('\nCSS Variables:');
      appRule.cssVariables.forEach((v: string) => console.log(`  - ${v}`));
    }
  });

program.parse();
