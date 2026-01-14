/**
 * IPC Handlers for AI Flow Explorer
 * 
 * Handles communication between renderer and the AI Flow Explorer engine
 */

const { ipcMain } = require('electron');
const { AIFlowExplorer } = require('../lib/ai-flow-explorer');

let currentFlowExplorer = null;

function registerFlowExplorerHandlers(context) {
  console.log('[IPC] Registering Flow Explorer handlers...');
  
  /**
   * Start full flow exploration
   */
  ipcMain.handle('flow-explorer-start', async (event, options) => {
    try {
      const { startUrl, maxPages, apiKey, model, testData } = options;
      
      if (!context.page) {
        throw new Error('No browser page available. Start recording first.');
      }
      
      // Get the actual API key - if '***env***' marker, fetch from backend
      let actualApiKey = apiKey ? apiKey.trim() : '';
      
      if (actualApiKey === '***env***' || actualApiKey.includes('***env') || !actualApiKey) {
        // Key is stored on backend server - fetch it
        console.log('[FlowExplorer] Fetching API key from backend...');
        try {
          const axios = require('axios');
          const response = await axios.get('http://127.0.0.1:8000/api/ai/vision/config/internal-key');
          if (response.data && response.data.key) {
            actualApiKey = response.data.key;
            console.log('[FlowExplorer] Got API key from backend');
          } else if (process.env.OPENAI_API_KEY) {
            actualApiKey = process.env.OPENAI_API_KEY;
            console.log('[FlowExplorer] Using API key from environment variable');
          }
        } catch (err) {
          console.log('[FlowExplorer] Could not fetch from backend, trying env:', err.message);
          actualApiKey = process.env.OPENAI_API_KEY || '';
        }
      }
      
      if (!actualApiKey) {
        throw new Error('No AI API key found. Make sure the backend is running at localhost:8000 with OPENAI_API_KEY configured.');
      }
      
      // Create explorer
      currentFlowExplorer = new AIFlowExplorer(context.page, {
        apiKey: actualApiKey,
        model: model || 'gpt-4o-mini',
        maxPages: maxPages || 50,
        testData: testData || {},
        debug: true,
        
        // Progress callbacks
        onProgress: (progress) => {
          event.sender.send('flow-explorer-progress', progress);
        },
        
        onPageDiscovered: (page) => {
          event.sender.send('flow-explorer-page-discovered', page);
        },
        
        onElementDiscovered: (element) => {
          event.sender.send('flow-explorer-element-discovered', element);
        },
        
        onFlowComplete: (flow) => {
          event.sender.send('flow-explorer-flow-complete', flow);
        },
        
        onTestGenerated: (test) => {
          event.sender.send('flow-explorer-test-generated', test);
        },
        
        onError: (error) => {
          event.sender.send('flow-explorer-error', error);
        }
      });
      
      // Start exploration
      const result = await currentFlowExplorer.explore(startUrl);
      
      currentFlowExplorer = null;
      return result;
      
    } catch (error) {
      console.error('[FlowExplorer] Start error:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Stop flow exploration
   */
  ipcMain.handle('flow-explorer-stop', async (event) => {
    if (currentFlowExplorer) {
      currentFlowExplorer.stop();
      currentFlowExplorer = null;
    }
    return { success: true };
  });
  
  /**
   * Get current exploration status
   */
  ipcMain.handle('flow-explorer-status', async (event) => {
    return {
      running: !!currentFlowExplorer,
      coverage: currentFlowExplorer?.coverage || null,
      pagesDiscovered: currentFlowExplorer?.pageGraph?.size || 0,
      testCasesGenerated: currentFlowExplorer?.testCases?.length || 0
    };
  });
  
  /**
   * Automate a manual test case
   */
  ipcMain.handle('flow-explorer-automate-manual', async (event, options) => {
    try {
      const { description, apiKey, testData } = options;
      
      if (!context.page) {
        throw new Error('No browser page available. Start recording first.');
      }
      
      // Get the actual API key - if '***env***' marker, fetch from backend
      let actualApiKey = apiKey ? apiKey.trim() : '';
      
      if (actualApiKey === '***env***' || actualApiKey.includes('***env') || !actualApiKey) {
        try {
          const axios = require('axios');
          const response = await axios.get('http://127.0.0.1:8000/api/ai/vision/config/internal-key');
          if (response.data && response.data.key) {
            actualApiKey = response.data.key;
          } else if (process.env.OPENAI_API_KEY) {
            actualApiKey = process.env.OPENAI_API_KEY;
          }
        } catch (err) {
          actualApiKey = process.env.OPENAI_API_KEY || '';
        }
      }
      
      // Create temporary explorer for manual test automation
      const explorer = new AIFlowExplorer(context.page, {
        apiKey: actualApiKey,
        testData: testData || {},
        debug: true
      });
      
      // Discover elements on current page
      await explorer.discoverAllElements();
      explorer.currentPage = { elements: await explorer.getVisibleElements() };
      
      // Automate the manual test case
      const result = await explorer.automateManualTestCase(description);
      
      return result;
      
    } catch (error) {
      console.error('[FlowExplorer] Manual automation error:', error);
      return { success: false, error: error.message };
    }
  });
  
  console.log('[IPC] Flow Explorer handlers registered');
}

module.exports = { registerFlowExplorerHandlers };
