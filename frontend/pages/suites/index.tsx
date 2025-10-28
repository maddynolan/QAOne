import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';

export default function Suites() {
  return (
    <>
      <Head>
        <title>Test Suites - QA AI Platform</title>
        <meta name="description" content="Manage your test suites" />
      </Head>

      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Test Suites</h1>
                <p className="mt-2 text-gray-600">
                  Configure and manage test suites and artifacts.
                </p>
              </div>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Create New Suite
              </button>
            </div>
          </div>

          {/* Suites List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">All Test Suites</h2>
            </div>
            <div className="px-6 py-8">
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-xl">⚙️</span>
                </div>
                <p className="text-gray-500">No test suites found.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create your first test suite to organize your tests.
                </p>
                <div className="mt-4">
                  <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    Create Test Suite
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
