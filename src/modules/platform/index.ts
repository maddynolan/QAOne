/**
 * @module platform
 *
 * Cross-cutting platform features: settings, integrations, defects, requirements, and more.
 *
 * Features:
 * - Application settings & configuration
 * - Third-party integrations (Jira, Azure DevOps, Confluence, GitHub)
 * - CI/CD pipeline configuration
 * - Defect management & tracking
 * - Requirements management & traceability
 * - Secrets vault for credential storage
 * - Project management with boards
 * - Framework analyzer & Code Alchemy
 * - License administration
 * - Authentication & authorization
 */

// Pages
export { default as Settings } from './pages/Settings';
export { default as Integrations } from './pages/Integrations';
export { default as Defects } from './pages/Defects';
export { default as CreateDefect } from './pages/CreateDefect';
export { default as Requirements } from './pages/Requirements';
export { default as CreateRequirement } from './pages/CreateRequirement';
export { default as Traceability } from './pages/Traceability';
export { default as CICDIntegration } from './pages/CICDIntegration';
export { default as SecretsVault } from './pages/SecretsVault';
export { default as ProjectManagement } from './pages/ProjectManagement';
export { default as FrameworkAnalyzer } from './pages/FrameworkAnalyzer';
export { default as CodeAlchemy } from './pages/CodeAlchemy';
export { default as DataDependencyGraph } from './pages/DataDependencyGraph';
export { default as APMConfig } from './pages/APMConfig';
export { default as LicenseAdminPage } from './pages/LicenseAdminPage';
export { default as NotFound } from './pages/NotFound';
export { AuthPage } from './pages/AuthPage';

// Components
export { default as PluginManagement } from './components/PluginManagement';
export { default as WorkspaceSwitcher } from './components/WorkspaceSwitcher';
