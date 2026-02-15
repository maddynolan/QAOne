/**
 * Suggestion conversion and grouping helpers for the recorder.
 * Converts raw page element data into the unified SuggestResult format
 * used by the suggestions panel.
 *
 * Extracted from PlaywrightRecorderPage.tsx.
 */

import type { Suggestion, SuggestResult } from '@/modules/recorder/types/recorder.types';

/**
 * Convert analyze() response (from PlaywrightRecorder) to SuggestResult format
 */
export const convertAnalyzeToSuggestResult = (suggestions: any[]): SuggestResult => {
  const result: Suggestion[] = [];
  const counts: Record<string, number> = { buttons: 0, links: 0, inputs: 0, headings: 0 };

  suggestions.forEach((s, idx) => {
    const type = (s.type || '').toLowerCase();
    const label = s.label || s.text || s.description || s.element || '';

    // Categorize based on multiple indicators
    let category = 'button'; // Default
    let qword = 'Click';

    // Input fields
    if (type === 'fill' || type === 'input' || s.isInput || s.tag === 'INPUT' || s.tag === 'TEXTAREA') {
      category = 'input';
      qword = 'Fill';
      counts.inputs++;
    }
    // Links
    else if (type === 'link' || s.isLink || s.tag === 'A' || s.selector?.includes('link') || s.selector?.includes('href')) {
      category = 'link';
      qword = 'Click';
      counts.links++;
    }
    // Headings
    else if (s.tag?.match(/^H[1-6]$/) || s.isHeading || type === 'heading') {
      category = 'heading';
      qword = 'AssertText';
      counts.headings++;
    }
    // Buttons (default for clicks)
    else if (type === 'click' || type === 'button' || s.isButton || s.tag === 'BUTTON') {
      category = 'button';
      qword = 'Click';
      counts.buttons++;
    }
    // Default to button
    else {
      category = 'button';
      qword = 'Click';
      counts.buttons++;
    }

    result.push({
      type: s.type || 'click',
      qword,
      args: [label, s.selector || ''],
      description: s.description || label,
      element: label,
      category, // This is the key field for grouping!
      selector: s.selector,
      // Preserve full selectorObj from analyze (includes text, inputType, placeholder, ariaLabel, name, id)
      selectorObj: s.selectorObj || { selector: s.selector, text: label },
      inputType: s.inputType,
      count: s.duplicateCount || s.count || 1
    });
  });

  return {
    suggestions: result,
    categories: {},
    counts,
    timing: 'now',
    total: result.length
  };
};

/**
 * Convert raw page elements to suggestion format
 */
export const convertElementsToSuggestions = (elements: any): SuggestResult => {
  const suggestions: Suggestion[] = [];
  const counts: Record<string, number> = { buttons: 0, links: 0, inputs: 0, headings: 0 };

  // Process buttons
  if (elements.buttons) {
    elements.buttons.forEach((btn: any) => {
      suggestions.push({
        type: 'click',
        qword: 'Click',
        args: [btn.text || btn.label || 'Button'],
        description: btn.text || btn.label || 'Button',
        element: btn.text || btn.label || 'Button',
        category: 'button',
        selector: btn.selector,
        selectorObj: btn.selectorObj,
        count: btn.count
      });
      counts.buttons++;
    });
  }

  // Process links
  if (elements.links) {
    elements.links.forEach((link: any) => {
      suggestions.push({
        type: 'click',
        qword: 'Click',
        args: [link.text || link.href || 'Link'],
        description: link.text || 'Link',
        element: link.text || link.href || 'Link',
        category: 'link',
        selector: link.selector,
        selectorObj: link.selectorObj,
        count: link.count
      });
      counts.links++;
    });
  }

  // Process inputs
  if (elements.inputs) {
    elements.inputs.forEach((input: any) => {
      suggestions.push({
        type: 'fill',
        qword: 'Fill',
        args: [input.name || input.placeholder || input.label || 'Input', ''],
        description: input.name || input.placeholder || input.label || 'Input field',
        element: input.name || input.placeholder || input.label || 'Input',
        category: 'input',
        selector: input.selector,
        selectorObj: input.selectorObj,
        count: input.count
      });
      counts.inputs++;
    });
  }

  // Process headings
  if (elements.headings) {
    elements.headings.forEach((h: any) => {
      suggestions.push({
        type: 'assertText',
        qword: 'AssertText',
        args: [h.text || 'Heading'],
        description: h.text || 'Heading',
        element: h.text || 'Heading',
        category: 'heading',
        selector: h.selector,
        selectorObj: h.selectorObj,
        count: h.count
      });
      counts.headings++;
    });
  }

  return {
    suggestions,
    categories: {},
    counts,
    timing: 'now',
    total: suggestions.length
  };
};

/**
 * Group suggestions by type for the suggestions panel display
 */
export const groupSuggestions = (
  suggestResult: SuggestResult | null,
  searchQuery: string
): Record<string, Suggestion[]> => {
  if (!suggestResult?.suggestions || suggestResult.suggestions.length === 0) {
    return { fill: [], click: [], link: [], heading: [], other: [] };
  }

  const groups: Record<string, Suggestion[]> = {
    fill: [],
    click: [],
    link: [],
    heading: [],
    other: []
  };

  suggestResult.suggestions.forEach(s => {
    const qword = (s.qword || s.type || '').toLowerCase();
    const category = (s.category || '').toLowerCase();
    const type = (s.type || '').toLowerCase();

    // More flexible grouping logic
    if (qword === 'fill' || type === 'fill' || category === 'input' || category.includes('input')) {
      groups.fill.push(s);
    } else if (category === 'button' || category.includes('button') || type === 'button') {
      groups.click.push(s);
    } else if (category === 'link' || category.includes('link') || type === 'link') {
      groups.link.push(s);
    } else if (category === 'heading' || category.includes('heading') || type === 'heading') {
      groups.heading.push(s);
    } else if (qword.includes('click') || type === 'click') {
      // Default clicks to buttons
      groups.click.push(s);
    } else {
      groups.other.push(s);
    }
  });

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    Object.keys(groups).forEach(key => {
      groups[key] = groups[key].filter(s =>
        s.description?.toLowerCase().includes(query) ||
        s.element?.toLowerCase().includes(query) ||
        s.args?.some(a => a?.toLowerCase().includes(query))
      );
    });
  }

  return groups;
};

/**
 * Calculate category counts from suggestions
 */
export const getCategoryCounts = (
  suggestResult: SuggestResult | null,
  groupedSuggestions: Record<string, Suggestion[]>
): { buttons: number; links: number; inputs: number; headings: number } => {
  if (suggestResult?.counts) {
    return {
      buttons: suggestResult.counts.buttons || suggestResult.counts.button || groupedSuggestions.click?.length || 0,
      links: suggestResult.counts.links || suggestResult.counts.link || groupedSuggestions.link?.length || 0,
      inputs: suggestResult.counts.inputs || suggestResult.counts.input || groupedSuggestions.fill?.length || 0,
      headings: suggestResult.counts.headings || suggestResult.counts.heading || groupedSuggestions.heading?.length || 0,
    };
  }
  return {
    buttons: groupedSuggestions.click?.length || 0,
    links: groupedSuggestions.link?.length || 0,
    inputs: groupedSuggestions.fill?.length || 0,
    headings: groupedSuggestions.heading?.length || 0,
  };
};
