/**
 * IPC Handlers for AI Explorer Agent
 * 
 * Handles communication between renderer and the autonomous AI explorer
 */

const { ipcMain } = require('electron');
const { AIExplorerAgent } = require('../lib/ai-explorer-agent');

let currentAgent = null;

function registerAIExplorerHandlers(context) {
  console.log('[IPC] Registering AI Explorer handlers...');
  
  /**
   * Start autonomous exploration
   */
  ipcMain.handle('ai-explorer-start', async (event, options) => {
    try {
      const { startUrl, maxActions, maxPages, apiKey, model } = options;
      
      if (!context.page) {
        throw new Error('No browser page available. Start recording first.');
      }
      
      // API key should be passed from UI (loaded from settings there)
      if (!apiKey) {
        throw new Error('No AI API key provided. Configure it in Settings > AI.');
      }
      
      // Create agent
      currentAgent = new AIExplorerAgent(context.page, {
        apiKey: apiKey,
        model: model || 'gpt-4o-mini',
        maxActions: maxActions || 50,
        maxPages: maxPages || 5,
        debug: true,
        
        // Progress callbacks - send to renderer
        onProgress: (progress) => {
          event.sender.send('ai-explorer-progress', progress);
        },
        
        onAction: (action) => {
          event.sender.send('ai-explorer-action', action);
        },
        
        onTestDiscovered: (test) => {
          event.sender.send('ai-explorer-test-discovered', test);
        },
        
        onError: (error) => {
          event.sender.send('ai-explorer-error', error);
        },
        
        onStateChange: (state) => {
          event.sender.send('ai-explorer-state-change', state);
        }
      });
      
      // Start exploration
      const result = await currentAgent.explore(startUrl);
      
      currentAgent = null;
      return result;
      
    } catch (error) {
      console.error('[AIExplorer] Start error:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Stop current exploration
   */
  ipcMain.handle('ai-explorer-stop', async (event) => {
    try {
      if (currentAgent) {
        currentAgent.stop();
        return { success: true };
      }
      return { success: false, error: 'No exploration running' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Get exploration status
   */
  ipcMain.handle('ai-explorer-status', async (event) => {
    return {
      running: !!currentAgent,
      actionCount: currentAgent?.actionCount || 0,
      testsDiscovered: currentAgent?.discoveredTests?.length || 0
    };
  });
  
  console.log('[IPC] AI Explorer handlers registered');
}

module.exports = { registerAIExplorerHandlers };
