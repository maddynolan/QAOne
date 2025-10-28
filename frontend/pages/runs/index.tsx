import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';

export default function Runs() {
  return (
    <>
      <Head>
        <title>Test Runs - QA AI Platform</title>
        <meta name="description" content="View and manage test runs" />
      </Head>

      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Test Runs</h1>
                <p className="mt-2 text-gray-600">
                  View and manage test execution runs.
                </p>
              </div>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                Start New Run
              </button>
            </div>
          </div>

          {/* Runs List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">All Test Runs</h2>
            </div>
            <div className="px-6 py-8">
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-xl">▶️</span>
                </div>
                <p className="text-gray-500">No test runs found.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Execute your first test run to see results here.
                </p>
                <div className="mt-4">
                  <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                    Start Test Run
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
