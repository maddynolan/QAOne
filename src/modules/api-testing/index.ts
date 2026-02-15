/**
 * @module api-testing
 *
 * Multi-protocol API testing with collections, environments, and request chaining.
 *
 * Features:
 * - REST, GraphQL, SOAP, gRPC, WebSocket, Kafka, MQTT, AMQP testing
 * - Request builder with Monaco editor
 * - Collection management with folders
 * - Environment variable substitution
 * - Request chaining with variable extraction
 * - 11 assertion types with schema validation
 * - OpenAPI/Swagger/Postman/HAR spec import
 * - API coverage mapping
 */

// Pages (EnhancedAPITesting is lazy-loaded in App.tsx)
export { default as APICoverageMap } from './pages/APICoverageMap';

// Components
export { default as RequestBuilder } from './components/RequestBuilder';
export { default as CollectionSidebar } from './components/CollectionSidebar';
export { default as EnvironmentManager } from './components/EnvironmentManager';
export { default as AssertionsPanel } from './components/AssertionsPanel';
export { default as RequestChainBuilder } from './components/RequestChainBuilder';
export { default as ResponseTreeExplorer } from './components/ResponseTreeExplorer';
export { default as ChainResultsView } from './components/ChainResultsView';
export { default as ChainStepCard } from './components/ChainStepCard';
export { ASSERTION_TYPES, ASSERTION_OPERATORS } from './components/constants';

// Constants
export { PROTOCOL_TEMPLATES } from './constants/protocol-templates';
export { INLINE_ASSERTION_TYPES, INLINE_ASSERTION_OPERATORS } from './constants/assertion-constants';

// Lib / Services
export { ensureTestSuiteFolders } from './lib/api-testing-utils';
export {
  exportAsJUnitXML,
  exportAsHTML,
  exportAsJSON,
  exportAsAllure,
  generateJUnitXMLContent,
  generateHTMLContent,
  generateAllureContent,
} from './lib/report-export';
export { exportToPostman, exportToHAR } from './lib/collection-export';
export {
  loadPersistedEnvironments,
  saveEnvironmentsToLocalStorage,
  saveEnvironmentToDb,
  loadEnvironments,
} from './lib/environment-persistence';

// Store
export { useApiTestingStore } from './store/apiTestingStore';
