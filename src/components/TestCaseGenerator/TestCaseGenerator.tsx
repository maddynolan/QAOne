import React, { useState } from 'react';
import { Play, FileText, Download, Upload, CheckCircle, AlertCircle, TrendingUp, XCircle } from 'lucide-react';

interface ActionGraph {
  sessionId: string;
  startTime: string;
  actions: any[];
  nodes?: any[];
  edges?: any[];
}

interface TestCase {
  test_case_id?: string;
  id?: string;
  title: string;
  description?: string;
  priority: string;
  test_type?: string;
  preconditions: string[];
  test_steps?: any[];
  steps?: any[];
  confidence_score?: number;
  quality_metrics?: any;
  requires_manual_review?: boolean;
}

interface ValidationResult {
  is_valid: boolean;
  score: number;
  issues: any[];
  warnings: any[];
  suggestions: any[];
  metrics: any;
}

interface QualityMetrics {
  average_confidence: number;
  average_steps: number;
  total_test_cases: number;
  valid_count: number;
  invalid_count: number;
  total_issues: number;
  total_warnings: number;
  average_metrics?: {
    element_quality: number;
    completeness: number;
    structure_quality: number;
    deduplication_quality: number;
  };
}

const TestCaseGenerator: React.FC = () => {
  const [actionGraph, setActionGraph] = useState<ActionGraph | null>(null);
  const [generatedTests, setGeneratedTests] = useState<TestCase[]>([]);
  const [format, setFormat] = useState<'gherkin' | 'istqb'>('istqb');
  const [processing, setProcessing] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});

  // Load action graph from Flowstral session
  const loadFromFlowstralSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/flowstral/session/${sessionId}/artifacts`);
      const artifacts = await response.json();
      if (artifacts.action_graph) {
        setActionGraph(artifacts.action_graph);
        // Pre-populate with generated test cases if available
        if (artifacts.test_cases?.test_cases?.automated) {
          setGeneratedTests(artifacts.test_cases.test_cases.automated);
        }
      }
    } catch (error) {
      console.error('Failed to load Flowstral session:', error);
      alert('Failed to load session. Make sure the session ID is valid.');
    }
  };

  // Generate test cases using backend API
  const processActionGraph = async () => {
    if (!actionGraph) {
      alert('Please load an action graph first');
      return;
    }

    setProcessing(true);
    try {
      // Convert to backend format
      const backendActionGraph = {
        session_id: actionGraph.sessionId || 'standalone',
        nodes: actionGraph.nodes || [],
        edges: actionGraph.edges || []
      };

      const response = await fetch('/api/test-cases/generate-from-action-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_graph: backendActionGraph,
          output_format: format,
          optimize: true
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      setGeneratedTests(result.test_cases || []);
      setQualityMetrics(result.statistics || {});
      
      // Store validation results for each test case
      if (result.validation?.detailed_results) {
        const validationMap: Record<string, ValidationResult> = {};
        result.test_cases.forEach((tc: TestCase, index: number) => {
          const tcId = tc.test_case_id || tc.id || `TC_${index}`;
          validationMap[tcId] = result.validation.detailed_results[index];
        });
        setValidationResults(validationMap);
      }
    } catch (error) {
      console.error('Failed to generate test cases:', error);
      alert(`Failed to generate test cases: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  // Convert format without regenerating
  const convertFormat = async () => {
    if (generatedTests.length === 0) {
      alert('No test cases to convert');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/test-cases/convert-format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_cases: generatedTests,
          target_format: format === 'istqb' ? 'gherkin' : 'istqb'
        })
      });

      const result = await response.json();
      setGeneratedTests(result.test_cases);
      setFormat(format === 'istqb' ? 'gherkin' : 'istqb');
      
      // Update validation results
      if (result.validation?.detailed_results) {
        const validationMap: Record<string, ValidationResult> = {};
        result.test_cases.forEach((tc: TestCase, index: number) => {
          const tcId = tc.test_case_id || tc.id || `TC_${index}`;
          validationMap[tcId] = result.validation.detailed_results[index];
        });
        setValidationResults(validationMap);
      }
    } catch (error) {
      console.error('Failed to convert format:', error);
      alert(`Failed to convert format: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  // Validate test cases
  const validateTestCases = async () => {
    if (generatedTests.length === 0) {
      alert('No test cases to validate');
      return;
    }

    try {
      const response = await fetch('/api/test-cases/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_cases: generatedTests,
          format: format
        })
      });

      const result = await response.json();
      
      // Update validation results
      if (result.validation?.detailed_results) {
        const validationMap: Record<string, ValidationResult> = {};
        generatedTests.forEach((tc: TestCase, index: number) => {
          const tcId = tc.test_case_id || tc.id || `TC_${index}`;
          validationMap[tcId] = result.validation.detailed_results[index];
        });
        setValidationResults(validationMap);
      }
      
      // Update quality metrics
      if (result.validation) {
        setQualityMetrics(prev => ({
          ...prev,
          ...result.validation
        } as QualityMetrics));
      }
    } catch (error) {
      console.error('Failed to validate:', error);
      alert(`Failed to validate: ${error}`);
    }
  };

  const exportTests = () => {
    if (generatedTests.length === 0) {
      alert('No test cases to export');
      return;
    }

    const exported = format === 'gherkin' 
      ? generatedTests.map(tc => formatAsGherkin(tc)).join('\n\n')
      : JSON.stringify(generatedTests, null, 2);

    const blob = new Blob(
      [exported],
      { type: format === 'gherkin' ? 'text/plain' : 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_cases.${format === 'gherkin' ? 'feature' : 'json'}`;
    a.click();
  };

  const formatAsGherkin = (testCase: TestCase): string => {
    const steps = testCase.test_steps || testCase.steps || [];
    let gherkin = `Feature: ${testCase.title}\n\n`;
    gherkin += `  @automated @priority-${testCase.priority?.toLowerCase() || 'medium'}\n`;
    gherkin += `  Scenario: ${testCase.title}\n`;

    testCase.preconditions?.forEach(pre => {
      gherkin += `    Given ${pre}\n`;
    });

    steps.forEach((step: any) => {
      gherkin += `    ${step.action || step.gherkin_keyword || 'And'} ${step.action || ''}\n`;
    });

    return gherkin;
  };

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Test Case Generator Engine
          </h1>
          <p className="text-slate-600 mb-6">
            Automated test case generation with quality validation
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => {
                const sessionId = prompt('Enter Flowstral Session ID:');
                if (sessionId) loadFromFlowstralSession(sessionId);
              }}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              <Upload size={20} />
              Load from Flowstral
            </button>

            <button
              onClick={processActionGraph}
              disabled={!actionGraph || processing}
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Play size={20} />
              {processing ? 'Processing...' : 'Generate Test Cases'}
            </button>

            <button
              onClick={validateTestCases}
              disabled={generatedTests.length === 0}
              className="flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <CheckCircle size={20} />
              Validate Quality
            </button>

            <button
              onClick={exportTests}
              disabled={generatedTests.length === 0}
              className="flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              Export Tests
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Output Format
              </label>
              <select
                value={format}
                onChange={(e) => {
                  const newFormat = e.target.value as 'gherkin' | 'istqb';
                  if (generatedTests.length > 0) {
                    setFormat(newFormat);
                    convertFormat();
                  } else {
                    setFormat(newFormat);
                  }
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="istqb">ISTQB (JSON)</option>
                <option value="gherkin">Gherkin (BDD)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quality Metrics Dashboard */}
        {qualityMetrics && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Quality Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-lg ${getQualityColor(qualityMetrics.average_confidence || 0)}`}>
                <div className="text-2xl font-bold">
                  {((qualityMetrics.average_confidence || 0) * 100).toFixed(0)}%
                </div>
                <div className="text-sm">Average Confidence</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {qualityMetrics.total_test_cases || 0}
                </div>
                <div className="text-sm text-slate-600">Total Test Cases</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {qualityMetrics.valid_count || 0}
                </div>
                <div className="text-sm text-slate-600">Valid Cases</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {qualityMetrics.invalid_count || 0}
                </div>
                <div className="text-sm text-slate-600">Issues Found</div>
              </div>
            </div>

            {/* Detailed Metrics */}
            {qualityMetrics.average_metrics && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-2">Detailed Quality Scores</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-slate-600">Element Quality</div>
                    <div className="text-lg font-bold">
                      {((qualityMetrics.average_metrics.element_quality || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Completeness</div>
                    <div className="text-lg font-bold">
                      {((qualityMetrics.average_metrics.completeness || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Structure</div>
                    <div className="text-lg font-bold">
                      {((qualityMetrics.average_metrics.structure_quality || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Deduplication</div>
                    <div className="text-lg font-bold">
                      {((qualityMetrics.average_metrics.deduplication_quality || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Cases */}
        {generatedTests.length > 0 && (
          <div className="space-y-4">
            {generatedTests.map((test, index) => {
              const testId = test.test_case_id || test.id || `TC_${index}`;
              const validation = validationResults[testId];
              const steps = test.test_steps || test.steps || [];

              return (
                <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-mono text-slate-500">{testId}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          test.priority === 'High' || test.priority === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {test.priority}
                        </span>
                        {validation && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            validation.is_valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {validation.is_valid ? 'Valid' : 'Issues Found'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">{test.title}</h3>
                      {test.description && (
                        <p className="text-sm text-slate-600 mt-1">{test.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {test.confidence_score !== undefined && (
                        <>
                          {test.confidence_score >= 0.7 ? (
                            <CheckCircle className="text-green-500" size={24} />
                          ) : (
                            <AlertCircle className="text-yellow-500" size={24} />
                          )}
                          <span className="text-sm text-slate-600">
                            {Math.round(test.confidence_score * 100)}% confidence
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Validation Issues/Warnings */}
                  {validation && (validation.issues.length > 0 || validation.warnings.length > 0) && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      {validation.issues.length > 0 && (
                        <div className="mb-2">
                          <div className="font-semibold text-red-700 flex items-center gap-2">
                            <XCircle size={16} />
                            Issues ({validation.issues.length})
                          </div>
                          <ul className="list-disc list-inside text-sm text-red-600 mt-1">
                            {validation.issues.slice(0, 3).map((issue: any, idx: number) => (
                              <li key={idx}>{issue.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {validation.warnings.length > 0 && (
                        <div>
                          <div className="font-semibold text-yellow-700 flex items-center gap-2">
                            <AlertCircle size={16} />
                            Warnings ({validation.warnings.length})
                          </div>
                          <ul className="list-disc list-inside text-sm text-yellow-600 mt-1">
                            {validation.warnings.slice(0, 3).map((warning: any, idx: number) => (
                              <li key={idx}>{warning.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preconditions */}
                  {test.preconditions && test.preconditions.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-700 mb-2">Preconditions:</h4>
                      <ul className="list-disc list-inside text-slate-600 space-y-1">
                        {test.preconditions.map((pre, idx) => (
                          <li key={idx}>{pre}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Test Steps */}
                  {format === 'gherkin' ? (
                    <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm">
                      <pre className="whitespace-pre-wrap text-slate-700">
                        {formatAsGherkin(test)}
                      </pre>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-3">Test Steps ({steps.length}):</h4>
                      <div className="space-y-3">
                        {steps.map((step: any, idx: number) => (
                          <div key={idx} className="border-l-4 border-blue-500 pl-4">
                            <div className="font-medium text-slate-800">
                              Step {step.step_number || idx + 1}: {step.action}
                            </div>
                            {step.test_data && (
                              <div className="text-sm text-slate-600 mt-1">
                                Data: {step.test_data}
                              </div>
                            )}
                            {step.expected_result && (
                              <div className="text-sm text-green-600 mt-1">
                                Expected: {step.expected_result}
                              </div>
                            )}
                            {step.element_name && (
                              <div className="text-xs text-slate-500 mt-1">
                                Element: {step.element_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {generatedTests.length === 0 && !actionGraph && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <FileText size={48} className="mx-auto text-slate-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No Test Cases Generated Yet
            </h3>
            <p className="text-slate-600">
              Load a Flowstral session or upload your action graph to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCaseGenerator;


