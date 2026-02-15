/**
 * @module visual-testing
 *
 * Visual regression testing with baseline management and diff visualization.
 *
 * Features:
 * - 6 comparison modes (pixel-perfect, anti-aliased, perceptual, structural, layout, AI semantic)
 * - Baseline image management
 * - Diff visualization with mismatch region highlighting
 * - Ignore regions for dynamic content
 * - Batch comparison across multiple URLs
 * - SSIM (Structural Similarity Index) scoring
 */

// Pages
export { default as VisualTestingPage } from './pages/VisualTestingPage';
