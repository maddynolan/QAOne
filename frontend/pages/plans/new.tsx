import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

export default function CreatePlan() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source: '',
    apiTests: true,
    uiTests: false,
    performanceTests: false,
    accessibilityTests: false,
    priority: 1
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Test plan created successfully!');
      router.push('/plans');
    } catch (error) {
      console.error('Error creating test plan:', error);
      alert('Failed to create test plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const testTypes = [
    { name: 'apiTests', label: 'API Tests', icon: '🔌', description: 'REST API endpoint testing' },
    { name: 'uiTests', label: 'UI Tests', icon: '🖥️', description: 'User interface testing' },
    { name: 'performanceTests', label: 'Performance Tests', icon: '⚡', description: 'Load and stress testing' },
    { name: 'accessibilityTests', label: 'Accessibility Tests', icon: '♿', description: 'WCAG compliance testing' },
  ];

  return (
    <>
      <Head>
        <title>Create Test Plan - QA AI Platform</title>
        <meta name="description" content="Create a new test plan from specification" />
      </Head>

      <Layout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-12 animate-fade-in">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                <span className="text-white text-2xl">📋</span>
              </div>
              <div>
                <h1 className="text-5xl font-bold text-gradient mb-2">Create Test Plan</h1>
                <p className="text-xl text-gray-600">
                  Generate a comprehensive test plan from your API specification or requirements.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Basic Information */}
            <div className="card hover-lift animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="card-header">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <span className="text-white text-xl">📝</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                </div>
              </div>
              <div className="card-body space-y-8">
                <div>
                  <label className="form-label">Plan Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input text-lg"
                    placeholder="e.g., E-commerce API Tests"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="form-input text-lg"
                    rows={4}
                    placeholder="Brief description of the test plan..."
                  />
                </div>

                <div>
                  <label className="form-label">Priority</label>
                  <select 
                    name="priority" 
                    value={formData.priority} 
                    onChange={handleInputChange}
                    className="form-input text-lg"
                  >
                    <option value={1}>Low</option>
                    <option value={2}>Medium</option>
                    <option value={3}>High</option>
                    <option value={4}>Critical</option>
                    <option value={5}>Emergency</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Test Configuration */}
            <div className="card hover-lift animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="card-header">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <span className="text-white text-xl">⚙️</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Test Configuration</h2>
                </div>
              </div>
              <div className="card-body">
                <div>
                  <label className="form-label mb-6">Test Types</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {testTypes.map((test) => (
                      <label key={test.name} className="group cursor-pointer">
                        <div className="p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-300 transition-all duration-200 hover:shadow-lg bg-white/50">
                          <div className="flex items-start">
                            <input
                              name={test.name}
                              type="checkbox"
                              checked={formData[test.name as keyof typeof formData] as boolean}
                              onChange={handleInputChange}
                              className="w-6 h-6 text-blue-600 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:ring-2 mt-1"
                            />
                            <div className="ml-4 flex-1">
                              <div className="flex items-center mb-2">
                                <span className="text-2xl mr-3">{test.icon}</span>
                                <span className="text-lg font-semibold text-gray-900">{test.label}</span>
                              </div>
                              <p className="text-sm text-gray-600">{test.description}</p>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Source Specification */}
            <div className="card hover-lift animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="card-header">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <span className="text-white text-xl">📄</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Source Specification</h2>
                </div>
              </div>
              <div className="card-body">
                <div>
                  <label className="form-label">Specification Content *</label>
                  <textarea
                    name="source"
                    value={formData.source}
                    onChange={handleInputChange}
                    className="form-input text-lg font-mono"
                    rows={12}
                    placeholder="Paste your OpenAPI spec, user stories, or requirements here..."
                    required
                  />
                  <p className="mt-3 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                    <span className="font-semibold">Supported formats:</span> OpenAPI/Swagger JSON, YAML, user stories, or plain text requirements.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-outline text-lg px-8 py-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Creating Test Plan...
                  </>
                ) : (
                  <>
                    <span className="mr-3">📋</span>
                    Create Test Plan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </>
  );
}