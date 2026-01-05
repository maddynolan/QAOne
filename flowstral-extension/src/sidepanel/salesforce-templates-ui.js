/**
 * Salesforce Templates UI Handler
 * 
 * Handles rendering and interaction for Salesforce templates in the browser extension
 */

(function() {
  'use strict';
  
  // State
  let selectedTemplate = null;
  let selectedFields = [];
  let testData = {};
  let categoryFilter = 'all';
  let searchQuery = '';
  
  // DOM Elements
  const elements = {
    templateSearch: document.getElementById('sfTemplateSearch'),
    templatesList: document.getElementById('sfTemplatesList'),
    templateCount: document.getElementById('sfTemplateCount'),
    configSection: document.getElementById('sfConfigSection'),
    selectedTemplateName: document.getElementById('sfSelectedTemplateName'),
    fieldsList: document.getElementById('sfFieldsList'),
    previewSection: document.getElementById('sfPreviewSection'),
    previewList: document.getElementById('sfPreviewList'),
    previewCount: document.getElementById('sfPreviewCount'),
    includeNavigation: document.getElementById('sfIncludeNavigation'),
    includeVerification: document.getElementById('sfIncludeVerification'),
    detectionBanner: document.getElementById('sfDetectionBanner'),
    objectDetected: document.getElementById('sfObjectDetected'),
  };
  
  // Initialize
  function init() {
    if (!window.SalesforceTemplates) {
      console.warn('[SF Templates] Templates not loaded');
      return;
    }
    
    renderTemplatesList();
    bindEvents();
    detectSalesforce();
  }
  
  // Render templates list
  function renderTemplatesList() {
    if (!elements.templatesList) return;
    
    const templates = window.SalesforceTemplates.TEMPLATES || [];
    const filtered = templates.filter(t => {
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      const matchesSearch = !searchQuery || 
        t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
    
    if (elements.templateCount) {
      elements.templateCount.textContent = `${filtered.length} templates`;
    }
    
    if (filtered.length === 0) {
      elements.templatesList.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <div class="icon">🔍</div>
          <p>No templates found</p>
        </div>
      `;
      return;
    }
    
    elements.templatesList.innerHTML = filtered.map(template => {
      const requiredCount = template.fields.filter(f => f.required).length;
      return `
        <div class="suggestion-item sf-template-item" data-api-name="${template.apiName}" style="cursor: pointer;">
          <div class="suggestion-icon" style="font-size: 18px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(139, 92, 246, 0.2));">
            ${template.icon}
          </div>
          <div class="suggestion-details">
            <div class="suggestion-type">${template.category.toUpperCase()}</div>
            <div class="suggestion-text">Create ${template.label}</div>
            <div class="suggestion-selector" style="color: rgba(255,255,255,0.5);">
              ${template.fields.length} fields • ${requiredCount} required
            </div>
          </div>
          <div class="suggestion-actions">
            <button class="btn btn-sm sf-use-template" data-api-name="${template.apiName}" style="font-size: 10px; padding: 4px 8px; background: #8B5CF6;">
              Use
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Select a template
  function selectTemplate(apiName) {
    const template = window.SalesforceTemplates.getTemplate(apiName);
    if (!template) return;
    
    selectedTemplate = template;
    
    // Initialize selected fields (required + first few common ones)
    const required = template.fields.filter(f => f.required).map(f => f.apiName);
    const common = template.fields.slice(0, 6).map(f => f.apiName);
    selectedFields = [...new Set([...required, ...common])];
    
    // Generate test data
    testData = window.SalesforceTemplates.generateTestDataForTemplate(template);
    
    // Show config section
    if (elements.configSection) {
      elements.configSection.style.display = 'block';
    }
    
    if (elements.selectedTemplateName) {
      elements.selectedTemplateName.innerHTML = `${template.icon} ${template.label}`;
    }
    
    renderFieldsList();
    renderPreview();
  }
  
  // Render fields list
  function renderFieldsList() {
    if (!elements.fieldsList || !selectedTemplate) return;
    
    elements.fieldsList.innerHTML = selectedTemplate.fields.map(field => {
      const isSelected = selectedFields.includes(field.apiName);
      const value = testData[field.apiName] || '';
      
      return `
        <div class="toggle-row sf-field-row" style="margin-bottom: 4px; padding: 8px; ${isSelected ? 'border: 1px solid rgba(139, 92, 246, 0.4);' : ''}">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <input type="checkbox" class="sf-field-checkbox" data-api-name="${field.apiName}" 
              ${isSelected ? 'checked' : ''} ${field.required ? 'disabled' : ''}>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 11px; color: #fff; display: flex; align-items: center; gap: 4px;">
                ${field.label}
                ${field.required ? '<span style="color: #ef4444; font-size: 9px;">*</span>' : ''}
              </div>
              ${isSelected ? `
                <input type="text" class="form-control sf-field-value" 
                  data-api-name="${field.apiName}"
                  value="${value.replace(/"/g, '&quot;')}" 
                  placeholder="Enter value..."
                  style="font-size: 10px; padding: 4px 8px; margin-top: 4px;">
              ` : ''}
            </div>
          </div>
          ${isSelected ? `
            <button class="btn btn-sm sf-regenerate-field" data-api-name="${field.apiName}" 
              style="font-size: 10px; padding: 2px 6px;" title="Regenerate">
              🔄
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
    
    // Bind field events
    bindFieldEvents();
  }
  
  // Bind field events
  function bindFieldEvents() {
    // Checkbox changes
    document.querySelectorAll('.sf-field-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const apiName = e.target.dataset.apiName;
        if (e.target.checked) {
          if (!selectedFields.includes(apiName)) {
            selectedFields.push(apiName);
          }
        } else {
          selectedFields = selectedFields.filter(f => f !== apiName);
        }
        renderFieldsList();
        renderPreview();
      });
    });
    
    // Value changes
    document.querySelectorAll('.sf-field-value').forEach(input => {
      input.addEventListener('change', (e) => {
        testData[e.target.dataset.apiName] = e.target.value;
        renderPreview();
      });
    });
    
    // Regenerate field
    document.querySelectorAll('.sf-regenerate-field').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const apiName = e.target.dataset.apiName;
        const field = selectedTemplate.fields.find(f => f.apiName === apiName);
        if (field) {
          testData[apiName] = window.SalesforceTemplates.regenerateFieldValue(field);
          renderFieldsList();
          renderPreview();
        }
      });
    });
  }
  
  // Render preview
  function renderPreview() {
    if (!elements.previewSection || !selectedTemplate) return;
    
    const steps = window.SalesforceTemplates.templateToSteps(selectedTemplate, testData, {
      includeNavigation: elements.includeNavigation?.checked ?? true,
      includeVerification: elements.includeVerification?.checked ?? true,
      selectedFields: selectedFields
    });
    
    elements.previewSection.style.display = 'block';
    
    if (elements.previewCount) {
      elements.previewCount.textContent = `${steps.length} steps`;
    }
    
    if (elements.previewList) {
      elements.previewList.innerHTML = steps.map((step, idx) => {
        const typeColor = step.type === 'click' ? '#8B5CF6' : 
                          step.type === 'fill' ? '#38BDF8' : 
                          step.type === 'assert' ? '#22c55e' : '#fbbf24';
        return `
          <div class="action-item" style="padding: 6px 10px;">
            <div class="action-number">${idx + 1}</div>
            <div class="action-icon" style="background: ${typeColor}20; width: 22px; height: 22px;">
              ${step.type === 'click' ? '👆' : step.type === 'fill' ? '✏️' : step.type === 'assert' ? '✅' : '🔍'}
            </div>
            <div class="action-details">
              <div class="action-type" style="font-size: 10px; color: ${typeColor};">${step.type.toUpperCase()}</div>
              <div class="action-selector" style="color: #fff;">${step.name}</div>
              ${step.value ? `<div style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">→ "${step.value}"</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }
  
  // Bind events
  function bindEvents() {
    // Search
    if (elements.templateSearch) {
      elements.templateSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTemplatesList();
      });
    }
    
    // Category filter buttons
    document.querySelectorAll('.sf-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.sf-category-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        categoryFilter = e.target.dataset.category;
        renderTemplatesList();
      });
    });
    
    // Quick create buttons
    document.querySelectorAll('.sf-quick-create').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectTemplate(e.target.dataset.object);
      });
    });
    
    // Template list item clicks
    document.addEventListener('click', (e) => {
      // Use button
      if (e.target.classList.contains('sf-use-template')) {
        e.stopPropagation();
        selectTemplate(e.target.dataset.apiName);
        return;
      }
      
      // Template item click
      const templateItem = e.target.closest('.sf-template-item');
      if (templateItem) {
        selectTemplate(templateItem.dataset.apiName);
      }
    });
    
    // Insert steps button
    document.getElementById('sfInsertStepsBtn')?.addEventListener('click', () => {
      if (!selectedTemplate) return;
      
      const steps = window.SalesforceTemplates.templateToSteps(selectedTemplate, testData, {
        includeNavigation: elements.includeNavigation?.checked ?? true,
        includeVerification: elements.includeVerification?.checked ?? true,
        selectedFields: selectedFields
      });
      
      // Add to workflow steps
      if (window.workflowSteps && Array.isArray(window.workflowSteps)) {
        steps.forEach(step => {
          window.workflowSteps.push({
            ...step,
            id: `sf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
        });
        
        // Update UI
        if (typeof window.renderWorkflowSteps === 'function') {
          window.renderWorkflowSteps();
        }
        
        showToast(`Inserted ${steps.length} Salesforce steps!`, 'success');
        
        // Switch to Suggest tab to see workflow
        const suggestTab = document.querySelector('[data-tab="suggest"]');
        if (suggestTab) suggestTab.click();
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(JSON.stringify(steps, null, 2));
        showToast('Steps copied to clipboard!', 'success');
      }
    });
    
    // Create test case button
    document.getElementById('sfCreateTestCaseBtn')?.addEventListener('click', () => {
      if (!selectedTemplate) return;
      
      const steps = window.SalesforceTemplates.templateToSteps(selectedTemplate, testData, {
        includeNavigation: elements.includeNavigation?.checked ?? true,
        includeVerification: elements.includeVerification?.checked ?? true,
        selectedFields: selectedFields
      });
      
      const testCase = {
        id: `sf_${selectedTemplate.apiName.toLowerCase()}_${Date.now()}`,
        name: `Create ${selectedTemplate.label}`,
        description: selectedTemplate.description,
        tags: ['salesforce', selectedTemplate.category, selectedTemplate.apiName.toLowerCase()],
        steps: steps,
        category: 'salesforce-template',
        templateSource: selectedTemplate.apiName,
        createdAt: new Date().toISOString()
      };
      
      // Save to localStorage
      localStorage.setItem('unified_test_case', JSON.stringify(testCase));
      
      // Open in builder
      const frontendUrl = localStorage.getItem('frontendUrl') || 'http://localhost:8080';
      window.open(`${frontendUrl}/builder`, '_blank');
      
      showToast(`Created test case: Create ${selectedTemplate.label}`, 'success');
    });
    
    // Copy JSON button
    document.getElementById('sfCopyJSONBtn')?.addEventListener('click', () => {
      if (!selectedTemplate) return;
      
      const steps = window.SalesforceTemplates.templateToSteps(selectedTemplate, testData, {
        includeNavigation: elements.includeNavigation?.checked ?? true,
        includeVerification: elements.includeVerification?.checked ?? true,
        selectedFields: selectedFields
      });
      
      navigator.clipboard.writeText(JSON.stringify(steps, null, 2));
      showToast('Steps copied as JSON!', 'success');
    });
    
    // Cancel button
    document.getElementById('sfCancelBtn')?.addEventListener('click', () => {
      selectedTemplate = null;
      selectedFields = [];
      testData = {};
      
      if (elements.configSection) elements.configSection.style.display = 'none';
      if (elements.previewSection) elements.previewSection.style.display = 'none';
    });
    
    // Regenerate all data button
    document.getElementById('sfRegenerateDataBtn')?.addEventListener('click', () => {
      if (!selectedTemplate) return;
      testData = window.SalesforceTemplates.generateTestDataForTemplate(selectedTemplate);
      renderFieldsList();
      renderPreview();
      showToast('Test data regenerated!', 'success');
    });
    
    // Option toggles
    elements.includeNavigation?.addEventListener('change', () => renderPreview());
    elements.includeVerification?.addEventListener('change', () => renderPreview());
  }
  
  // Detect Salesforce
  function detectSalesforce() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = tabs[0].url || '';
        const isSalesforce = window.SalesforceTemplates.isSalesforceUrl(url);
        const detectedObject = window.SalesforceTemplates.detectSalesforceObject(url);
        
        if (isSalesforce && elements.detectionBanner) {
          elements.detectionBanner.style.display = 'block';
          if (elements.objectDetected) {
            elements.objectDetected.textContent = detectedObject || 'Lightning Experience';
          }
          
          // Pre-select the detected object
          if (detectedObject) {
            selectTemplate(detectedObject);
          }
        }
      }
    });
  }
  
  // Toast notification
  function showToast(message, type = 'info') {
    // Use existing toast if available
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    
    // Simple fallback
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#8B5CF6'};
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 9999;
      animation: fadeIn 0.2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();





