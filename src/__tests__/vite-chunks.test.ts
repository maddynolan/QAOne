/**
 * Unit Tests — Vite Manual Chunks Configuration
 * ================================================
 * Tests the manualChunks function logic to ensure:
 * - Monaco editor is isolated in its own chunk (pure JS, no React dep)
 * - All other node_modules go into a single vendor chunk
 * - React-dependent libraries (Radix, recharts, etc.) are NOT split from React
 * - Application code is not assigned to vendor chunks
 *
 * This is critical because splitting React-dependent libraries into
 * separate chunks causes runtime errors (forwardRef undefined).
 */

// Extract the manualChunks logic for testing
const manualChunks = (id: string): string | undefined => {
  if (id.includes('node_modules')) {
    if (id.includes('monaco')) {
      return 'vendor-monaco';
    }
    return 'vendor';
  }
  return undefined;
};

describe('Vite manualChunks Configuration', () => {
  // ===========================================================================
  // Monaco Isolation
  // ===========================================================================
  describe('Monaco Editor Isolation', () => {
    it('assigns Monaco editor to vendor-monaco chunk', () => {
      expect(manualChunks('/node_modules/monaco-editor/esm/vs/editor/editor.api.js')).toBe(
        'vendor-monaco'
      );
    });

    it('assigns @monaco-editor/react to vendor-monaco chunk', () => {
      expect(manualChunks('/node_modules/@monaco-editor/react/lib/index.js')).toBe(
        'vendor-monaco'
      );
    });

    it('assigns monaco-languageclient to vendor-monaco chunk', () => {
      expect(manualChunks('/node_modules/monaco-languageclient/lib/index.js')).toBe(
        'vendor-monaco'
      );
    });
  });

  // ===========================================================================
  // Vendor Chunk — React Ecosystem
  // ===========================================================================
  describe('React Ecosystem in Single Vendor Chunk', () => {
    it('assigns React to vendor chunk', () => {
      expect(manualChunks('/node_modules/react/index.js')).toBe('vendor');
    });

    it('assigns React DOM to vendor chunk', () => {
      expect(manualChunks('/node_modules/react-dom/client.js')).toBe('vendor');
    });

    it('assigns Radix UI to vendor chunk (NOT separate — uses forwardRef at init)', () => {
      expect(manualChunks('/node_modules/@radix-ui/react-dialog/dist/index.mjs')).toBe('vendor');
      expect(manualChunks('/node_modules/@radix-ui/react-checkbox/dist/index.mjs')).toBe(
        'vendor'
      );
      expect(manualChunks('/node_modules/@radix-ui/react-popover/dist/index.mjs')).toBe(
        'vendor'
      );
    });

    it('assigns recharts to vendor chunk (NOT separate — uses forwardRef at init)', () => {
      expect(manualChunks('/node_modules/recharts/es6/chart/LineChart.js')).toBe('vendor');
      expect(manualChunks('/node_modules/recharts/es6/component/ResponsiveContainer.js')).toBe(
        'vendor'
      );
    });

    it('assigns tanstack to vendor chunk', () => {
      expect(manualChunks('/node_modules/@tanstack/react-query/build/modern/index.js')).toBe(
        'vendor'
      );
      expect(manualChunks('/node_modules/@tanstack/react-table/build/lib/index.mjs')).toBe(
        'vendor'
      );
    });

    it('assigns zustand to vendor chunk', () => {
      expect(manualChunks('/node_modules/zustand/esm/react.mjs')).toBe('vendor');
    });

    it('assigns lucide-react to vendor chunk', () => {
      expect(manualChunks('/node_modules/lucide-react/dist/esm/icons/activity.js')).toBe(
        'vendor'
      );
    });
  });

  // ===========================================================================
  // Vendor Chunk — Other Dependencies
  // ===========================================================================
  describe('Other Dependencies in Vendor Chunk', () => {
    it('assigns axios to vendor', () => {
      expect(manualChunks('/node_modules/axios/lib/axios.js')).toBe('vendor');
    });

    it('assigns date-fns to vendor', () => {
      expect(manualChunks('/node_modules/date-fns/format.mjs')).toBe('vendor');
    });

    it('assigns d3 libraries to vendor', () => {
      expect(manualChunks('/node_modules/d3-scale/src/linear.js')).toBe('vendor');
      expect(manualChunks('/node_modules/d3-shape/src/area.js')).toBe('vendor');
    });
  });

  // ===========================================================================
  // Application Code — Not Assigned
  // ===========================================================================
  describe('Application Code Not Assigned to Vendor', () => {
    it('returns undefined for application source files', () => {
      expect(manualChunks('/src/modules/performance/pages/VirtualUserGenerator.tsx')).toBeUndefined();
      expect(manualChunks('/src/App.tsx')).toBeUndefined();
      expect(manualChunks('/src/components/ui/button.tsx')).toBeUndefined();
    });

    it('returns undefined for src/lib files', () => {
      expect(manualChunks('/src/lib/api-config.ts')).toBeUndefined();
    });

    it('returns undefined for backend files', () => {
      expect(manualChunks('/backend/app/main.py')).toBeUndefined();
    });
  });

  // ===========================================================================
  // Critical Regression Guard
  // ===========================================================================
  describe('Critical: No React-Dependent Library Isolation', () => {
    // This test documents the root cause of the production blank page bug.
    // Libraries that call React.forwardRef() at module initialization time
    // MUST NOT be in a separate chunk from React.
    const reactDependentLibs = [
      '/node_modules/@radix-ui/react-dialog/dist/index.mjs',
      '/node_modules/@radix-ui/react-checkbox/dist/index.mjs',
      '/node_modules/@radix-ui/react-select/dist/index.mjs',
      '/node_modules/recharts/es6/chart/LineChart.js',
      '/node_modules/react-router-dom/dist/index.js',
      '/node_modules/cmdk/dist/index.mjs',
      '/node_modules/react-day-picker/dist/index.esm.js',
      '/node_modules/react-hook-form/dist/index.esm.mjs',
    ];

    it.each(reactDependentLibs)(
      '%s should be in the same chunk as React (vendor)',
      (libPath) => {
        const reactChunk = manualChunks('/node_modules/react/index.js');
        const libChunk = manualChunks(libPath);
        expect(libChunk).toBe(reactChunk);
      }
    );

    it('Monaco should be in a DIFFERENT chunk from React', () => {
      const reactChunk = manualChunks('/node_modules/react/index.js');
      const monacoChunk = manualChunks('/node_modules/monaco-editor/esm/vs/editor.api.js');
      expect(monacoChunk).not.toBe(reactChunk);
    });
  });
});
