/**
 * AI Test Generator IPC Handlers
 * 
 * Handles communication between renderer and AI Test Generator agent.
 * Uses the existing OpenAI configuration from Flowstral settings.
 */

const { ipcMain } = require('electron');
const { AITestGenerator } = require('../lib/ai-test-generator');

// Store active generator instance
let activeGenerator = null;
let generatorPage = null;

/**
 * Register AI Test Generator IPC handlers
 * @param {Object} context - Application context
 */
function registerAIGeneratorHandlers(context) {
  const { getPlaywrightRecorder, getMainWindow } = context;

  // ============================================================================
  // AI TEST GENERATION
  // ============================================================================

  /**
   * Start AI test generation for a URL
   * Options:
   * - url: Starting URL
   * - apiKey: OpenAI API key
   * - model: Model to use (default: gpt-4o-mini)
   * - maxPages: Maximum pages to crawl (default: 10)
   * - crawl: Whether to crawl multiple pages (default: false)
   */
  ipcMain.handle('ai-generate-tests', async (event, options = {}) => {
    const mainWindow = getMainWindow();
    
    try {
      const { url, apiKey, model, maxPages, crawl } = options;
      
      if (!url) {
        return { success: false, error: 'URL is required' };
      }
      
      if (!apiKey) {
        return { success: false, error: 'OpenAI API key is required. Configure it in Settings.' };
      }
      
      // Get or create a Playwright page
      const recorder = getPlaywrightRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'Playwright browser not initialized. Start a recording first.' };
      }
      
      generatorPage = recorder.page;
      
      // Create generator with progress callbacks
      activeGenerator = new AITestGenerator(generatorPage, {
        apiKey,
        model: model || 'gpt-4o-mini',
        maxPages: maxPages || 10,
        debug: true,
        
        // Progress callbacks - send to renderer
        onProgress: (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai-generator-progress', progress);
          }
        },
        
        onTestGenerated: (test) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai-generator-test', test);
          }
        },
        
        onError: (error) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai-generator-error', error);
          }
        }
      });
      
      // Generate tests
      let result;
      if (crawl) {
        result = await activeGenerator.crawlAndGenerate(url);
      } else {
        // Navigate first, then generate for current page
        await generatorPage.goto(url, { waitUntil: 'domcontentloaded' });
        result = await activeGenerator.generateForCurrentPage();
      }
      
      return { 
        success: true, 
        tests: result.tests || [],
        pagesVisited: result.pagesVisited || [url],
        errors: result.errors || []
      };
      
    } catch (error) {
      console.error('[AIGenerator] Error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Generate tests for the currently visible page in recorder
   */
  ipcMain.handle('ai-generate-current-page', async (event, options = {}) => {
    const mainWindow = getMainWindow();
    
    try {
      const { apiKey, model } = options;
      
      if (!apiKey) {
        return { success: false, error: 'OpenAI API key is required' };
      }
      
      const recorder = getPlaywrightRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No active recording session' };
      }
      
      const url = recorder.page.url();
      
      activeGenerator = new AITestGenerator(recorder.page, {
        apiKey,
        model: model || 'gpt-4o-mini',
        debug: true,
        
        onProgress: (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai-generator-progress', progress);
          }
        },
        
        onTestGenerated: (test) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai-generator-test', test);
          }
        }
      });
      
      const result = await activeGenerator.generateForCurrentPage();
      
      return {
        success: true,
        url,
        analysis: result.analysis,
        tests: result.tests || []
      };
      
    } catch (error) {
      console.error('[AIGenerator] Error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get page analysis without generating tests
   * Useful for showing what the AI sees on the page
   */
  ipcMain.handle('ai-analyze-page', async (event, options = {}) => {
    try {
      const { apiKey, model } = options;
      
      if (!apiKey) {
        return { success: false, error: 'OpenAI API key is required' };
      }
      
      const recorder = getPlaywrightRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No active recording session' };
      }
      
      const generator = new AITestGenerator(recorder.page, {
        apiKey,
        model: model || 'gpt-4o-mini',
        debug: true
      });
      
      const snapshot = await generator.getAccessibilitySnapshot();
      const url = recorder.page.url();
      const analysis = await generator.analyzePage(snapshot, url);
      
      return {
        success: true,
        url,
        snapshot,
        analysis
      };
      
    } catch (error) {
      console.error('[AIGenerator] Analysis error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Verify a generated test by executing it
   */
  ipcMain.handle('ai-verify-test', async (event, options = {}) => {
    try {
      const { test, apiKey } = options;
      
      if (!test) {
        return { success: false, error: 'Test is required' };
      }
      
      const recorder = getPlaywrightRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No active recording session' };
      }
      
      const generator = new AITestGenerator(recorder.page, {
        apiKey,
        debug: true
      });
      
      const result = await generator.verifyTest(test);
      
      return {
        success: true,
        ...result
      };
      
    } catch (error) {
      console.error('[AIGenerator] Verification error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Stop active generation
   */
  ipcMain.handle('ai-generator-stop', async () => {
    if (activeGenerator) {
      activeGenerator = null;
    }
    return { success: true };
  });

  console.log('[IPC] AI Generator handlers registered');
}

module.exports = { registerAIGeneratorHandlers };
