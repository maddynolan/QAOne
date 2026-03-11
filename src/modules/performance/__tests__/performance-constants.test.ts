/**
 * Unit Tests — Performance Constants
 * ====================================
 * Validates the shape, data integrity, and business rules of
 * QUICK_START_SCENARIOS and FLOWSTRAL_SCENARIOS constants.
 */

import {
  FLOWSTRAL_WEBSITE_URL,
  FLOWSTRAL_API_URL,
  MAX_BROWSER_VUS,
  QUICK_START_SCENARIOS,
  FLOWSTRAL_SCENARIOS,
} from '../constants/performance-constants';

describe('Performance Constants', () => {
  // ===========================================================================
  // Base URLs
  // ===========================================================================
  describe('Base URLs', () => {
    it('FLOWSTRAL_WEBSITE_URL is HTTPS', () => {
      expect(FLOWSTRAL_WEBSITE_URL).toMatch(/^https:\/\//);
      expect(FLOWSTRAL_WEBSITE_URL).toBe('https://flowstral.com');
    });

    it('FLOWSTRAL_API_URL uses centralized API_BASE_URL', () => {
      expect(typeof FLOWSTRAL_API_URL).toBe('string');
      expect(FLOWSTRAL_API_URL.length).toBeGreaterThan(0);
    });

    it('MAX_BROWSER_VUS is reasonable for in-browser testing', () => {
      expect(MAX_BROWSER_VUS).toBe(20);
      expect(MAX_BROWSER_VUS).toBeGreaterThan(0);
      expect(MAX_BROWSER_VUS).toBeLessThanOrEqual(50); // in-browser should be low
    });
  });

  // ===========================================================================
  // QUICK_START_SCENARIOS
  // ===========================================================================
  describe('QUICK_START_SCENARIOS', () => {
    it('has at least 5 scenarios', () => {
      expect(QUICK_START_SCENARIOS.length).toBeGreaterThanOrEqual(5);
    });

    it('each scenario has required fields', () => {
      QUICK_START_SCENARIOS.forEach((scenario) => {
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('description');
        expect(scenario).toHaveProperty('virtualUsers');
        expect(scenario).toHaveProperty('duration');
        expect(scenario).toHaveProperty('rampUp');
        expect(scenario).toHaveProperty('testType');
        expect(scenario).toHaveProperty('endpoints');

        // Type checks
        expect(typeof scenario.id).toBe('string');
        expect(typeof scenario.name).toBe('string');
        expect(typeof scenario.description).toBe('string');
        expect(typeof scenario.virtualUsers).toBe('number');
        expect(typeof scenario.duration).toBe('number');
        expect(typeof scenario.rampUp).toBe('number');
        expect(typeof scenario.testType).toBe('string');
        expect(Array.isArray(scenario.endpoints)).toBe(true);
      });
    });

    it('all IDs are unique', () => {
      const ids = QUICK_START_SCENARIOS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each scenario has positive VU count and duration', () => {
      QUICK_START_SCENARIOS.forEach((scenario) => {
        expect(scenario.virtualUsers).toBeGreaterThan(0);
        expect(scenario.duration).toBeGreaterThan(0);
        expect(scenario.rampUp).toBeGreaterThanOrEqual(0);
      });
    });

    it('endpoint weights sum to 100 per scenario', () => {
      QUICK_START_SCENARIOS.forEach((scenario) => {
        const totalWeight = scenario.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
        expect(totalWeight).toBe(100);
      });
    });

    it('each endpoint has method, path, and weight', () => {
      QUICK_START_SCENARIOS.forEach((scenario) => {
        scenario.endpoints.forEach((ep) => {
          expect(ep).toHaveProperty('method');
          expect(ep).toHaveProperty('path');
          expect(ep).toHaveProperty('weight');
          expect(ep.method).toMatch(/^(GET|POST|PUT|PATCH|DELETE)$/);
          expect(ep.path).toMatch(/^\//);
          expect(ep.weight).toBeGreaterThan(0);
        });
      });
    });

    it('testType is valid', () => {
      const validTypes = ['load', 'spike', 'stress', 'endurance', 'soak', 'breakpoint'];
      QUICK_START_SCENARIOS.forEach((scenario) => {
        expect(validTypes).toContain(scenario.testType);
      });
    });

    it('includes api_load and spike_test scenarios', () => {
      const ids = QUICK_START_SCENARIOS.map((s) => s.id);
      expect(ids).toContain('api_load');
      expect(ids).toContain('spike_test');
    });

    it('includes PWA load scenario', () => {
      const pwa = QUICK_START_SCENARIOS.find((s) => s.id === 'pwa_load');
      expect(pwa).toBeDefined();
      expect(pwa!.endpoints.some((ep) => ep.path === '/')).toBe(true);
      expect(pwa!.endpoints.some((ep) => ep.path === '/manifest.json')).toBe(true);
    });
  });

  // ===========================================================================
  // FLOWSTRAL_SCENARIOS
  // ===========================================================================
  describe('FLOWSTRAL_SCENARIOS', () => {
    it('has 5 scenarios', () => {
      expect(FLOWSTRAL_SCENARIOS).toHaveLength(5);
    });

    it('each scenario has required fields plus baseUrl', () => {
      FLOWSTRAL_SCENARIOS.forEach((scenario) => {
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('description');
        expect(scenario).toHaveProperty('virtualUsers');
        expect(scenario).toHaveProperty('duration');
        expect(scenario).toHaveProperty('rampUp');
        expect(scenario).toHaveProperty('testType');
        expect(scenario).toHaveProperty('baseUrl');
        expect(scenario).toHaveProperty('endpoints');
      });
    });

    it('all IDs are unique', () => {
      const ids = FLOWSTRAL_SCENARIOS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all IDs are prefixed with flowstral_', () => {
      FLOWSTRAL_SCENARIOS.forEach((scenario) => {
        expect(scenario.id).toMatch(/^flowstral_/);
      });
    });

    it('endpoint weights sum to 100 per scenario', () => {
      FLOWSTRAL_SCENARIOS.forEach((scenario) => {
        const totalWeight = scenario.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
        expect(totalWeight).toBe(100);
      });
    });

    it('baseUrl uses correct URLs', () => {
      FLOWSTRAL_SCENARIOS.forEach((scenario) => {
        expect([FLOWSTRAL_WEBSITE_URL, FLOWSTRAL_API_URL]).toContain(scenario.baseUrl);
      });
    });

    it('marketing visitor targets flowstral.com', () => {
      const marketing = FLOWSTRAL_SCENARIOS.find((s) => s.id === 'flowstral_marketing');
      expect(marketing).toBeDefined();
      expect(marketing!.baseUrl).toBe(FLOWSTRAL_WEBSITE_URL);
    });

    it('API health targets Railway backend', () => {
      const apiHealth = FLOWSTRAL_SCENARIOS.find((s) => s.id === 'flowstral_api_health');
      expect(apiHealth).toBeDefined();
      expect(apiHealth!.baseUrl).toBe(FLOWSTRAL_API_URL);
    });

    it('peak spike has high VUs and fast ramp', () => {
      const spike = FLOWSTRAL_SCENARIOS.find((s) => s.id === 'flowstral_peak_spike');
      expect(spike).toBeDefined();
      expect(spike!.virtualUsers).toBeGreaterThanOrEqual(100);
      expect(spike!.rampUp).toBeLessThanOrEqual(10);
      expect(spike!.testType).toBe('spike');
    });

    it('SEO crawler has many endpoints', () => {
      const crawler = FLOWSTRAL_SCENARIOS.find((s) => s.id === 'flowstral_seo_crawler');
      expect(crawler).toBeDefined();
      expect(crawler!.endpoints.length).toBeGreaterThanOrEqual(10);
    });
  });
});
