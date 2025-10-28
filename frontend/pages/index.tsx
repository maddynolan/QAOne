import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';

export default function Dashboard() {
  const quickActions = [
    {
      name: 'Create Test Plan',
      description: 'Generate a new test plan from specification',
      href: '/plans/new',
      gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      icon: '📋',
    },
    {
      name: 'Run Tests',
      description: 'Execute existing test suites',
      href: '/runs',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      icon: '▶️',
    },
    {
      name: 'View Reports',
      description: 'Analyze test results and metrics',
      href: '/reports',
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      icon: '📊',
    },
    {
      name: 'Manage Suites',
      description: 'Configure test suites and artifacts',
      href: '/suites',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      icon: '⚙️',
    },
  ];

  const stats = [
    {
      name: 'Total Plans',
      value: '0',
      change: '+0%',
      changeType: 'positive',
      icon: '📋',
      gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    },
    {
      name: 'Total Suites',
      value: '0',
      change: '+0%',
      changeType: 'positive',
      icon: '⚙️',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
    },
    {
      name: 'Total Runs',
      value: '0',
      change: '+0%',
      changeType: 'positive',
      icon: '▶️',
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    },
    {
      name: 'Success Rate',
      value: '0%',
      change: '+0%',
      changeType: 'positive',
      icon: '📊',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    },
  ];

  return (
    <>
      <Head>
        <title>QA AI Platform - Dashboard</title>
        <meta name="description" content="Hybrid AI QA platform for automated test generation and execution" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </Head>

      <Layout>
        <div style={{ width: '100%', padding: '32px' }}>
          {/* Header */}
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '24px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}>
                <span style={{ color: 'white', fontSize: '24px' }}>🚀</span>
              </div>
              <div>
                <h1 style={{ 
                  fontSize: '48px', 
                  fontWeight: 'bold', 
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0,
                  marginBottom: '8px'
                }}>
                  Welcome to QA AI Platform
                </h1>
                <p style={{ 
                  fontSize: '20px', 
                  color: '#6b7280',
                  margin: 0,
                  maxWidth: '600px'
                }}>
                  Streamline your quality assurance process with AI-powered test generation, execution, and analysis.
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '32px', 
            marginBottom: '48px' 
          }}>
            {stats.map((stat, index) => (
              <div key={stat.name} style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(16px)',
                borderRadius: '24px',
                padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      background: stat.gradient,
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '16px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <span style={{ color: 'white', fontSize: '20px' }}>{stat.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '4px' }}>
                        {stat.name}
                      </p>
                      <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                        {stat.value}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      backgroundColor: stat.changeType === 'positive' ? '#dcfce7' : '#fee2e2',
                      color: stat.changeType === 'positive' ? '#166534' : '#dc2626'
                    }}>
                      {stat.change}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}>
                <span style={{ color: 'white', fontSize: '20px' }}>⚡</span>
              </div>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                Quick Actions
              </h2>
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '32px' 
            }}>
              {quickActions.map((action, index) => (
                <Link
                  key={action.name}
                  href={action.href}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(16px)',
                    borderRadius: '24px',
                    padding: '32px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    textDecoration: 'none',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: action.gradient,
                      borderRadius: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '24px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <span style={{ color: 'white', fontSize: '32px' }}>{action.icon}</span>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0, marginBottom: '12px' }}>
                      {action.name}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                      {action.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(16px)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '32px',
              borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
              background: 'linear-gradient(135deg, rgba(249, 250, 251, 0.5), rgba(255, 255, 255, 0.5))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}>
                  <span style={{ color: 'white', fontSize: '20px' }}>📈</span>
                </div>
                <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                  Recent Test Runs
                </h2>
              </div>
            </div>
            <div style={{ padding: '32px' }}>
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <div style={{
                  width: '96px',
                  height: '96px',
                  background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 32px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}>
                  <span style={{ color: '#9ca3af', fontSize: '32px' }}>▶️</span>
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0, marginBottom: '12px' }}>
                  No recent test runs found
                </h3>
                <p style={{ 
                  color: '#6b7280', 
                  margin: 0, 
                  marginBottom: '32px', 
                  maxWidth: '400px', 
                  marginLeft: 'auto', 
                  marginRight: 'auto',
                  lineHeight: '1.5'
                }}>
                  Create a test plan and run your first tests to see activity here.
                </p>
                <Link 
                  href="/plans/new" 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '16px 32px',
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '12px',
                    fontSize: '18px',
                    fontWeight: '600',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    transition: 'transform 0.2s'
                  }}
                >
                  <span style={{ marginRight: '12px' }}>📋</span>
                  Create Your First Test Plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}