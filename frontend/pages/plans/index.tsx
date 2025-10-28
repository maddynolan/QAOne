import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';

export default function Plans() {
  return (
    <>
      <Head>
        <title>Test Plans - QA AI Platform</title>
        <meta name="description" content="Manage your test plans" />
      </Head>

      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Test Plans</h1>
                <p className="mt-2 text-gray-600">
                  Create and manage test plans for your applications.
                </p>
              </div>
              <Link href="/plans/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Create New Plan
              </Link>
            </div>
          </div>

          {/* Plans List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">All Test Plans</h2>
            </div>
            <div className="px-6 py-8">
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-xl">📋</span>
                </div>
                <p className="text-gray-500">No test plans found.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create your first test plan to get started.
                </p>
                <div className="mt-4">
                  <Link href="/plans/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Create Test Plan
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
