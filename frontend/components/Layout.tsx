import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'Plans', href: '/plans', icon: '📋' },
  { name: 'Suites', href: '/suites', icon: '⚙️' },
  { name: 'Runs', href: '/runs', icon: '▶️' },
  { name: 'Reports', href: '/reports', icon: '📊' },
  { name: 'Settings', href: '/settings', icon: '🔧' },
];

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #e0f2fe 100%)',
      display: 'flex',
      fontFamily: 'Inter, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif'
    }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'block'
        }}>
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '320px',
            width: '100%',
            backgroundColor: 'white',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              marginRight: '-48px',
              paddingTop: '8px'
            }}>
              <button
                type="button"
                style={{
                  marginLeft: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '40px',
                  width: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setSidebarOpen(false)}
              >
                <span style={{ color: '#6b7280', fontSize: '20px', fontWeight: 'bold' }}>×</span>
              </button>
            </div>
            <div style={{
              flex: 1,
              height: 0,
              paddingTop: '20px',
              paddingBottom: '16px',
              overflowY: 'auto'
            }}>
              <div style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '16px',
                paddingRight: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(to right, #2563eb, #7c3aed)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>QA</span>
                  </div>
                  <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>AI Platform</h1>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Quality Assurance</p>
                  </div>
                </div>
              </div>
              <nav style={{ marginTop: '32px', paddingLeft: '8px', paddingRight: '8px' }}>
                {navigation.map((item) => {
                  const isActive = router.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '12px',
                        paddingRight: '12px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderRadius: '12px',
                        marginBottom: '8px',
                        textDecoration: 'none',
                        backgroundColor: isActive ? 'linear-gradient(to right, #3b82f6, #7c3aed)' : 'transparent',
                        color: isActive ? 'white' : '#374151',
                        boxShadow: isActive ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
                        transform: isActive ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ marginRight: '12px', fontSize: '18px' }}>{item.icon}</span>
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div style={{
        display: 'none',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          width: '320px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 0,
            flex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            borderRight: '1px solid rgba(229, 231, 235, 0.5)'
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              paddingTop: '32px',
              paddingBottom: '16px',
              overflowY: 'auto'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                paddingLeft: '24px',
                paddingRight: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(to right, #2563eb, #7c3aed)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>QA</span>
                  </div>
                  <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>AI Platform</h1>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Quality Assurance</p>
                  </div>
                </div>
              </div>
              <nav style={{ marginTop: '48px', flex: 1, paddingLeft: '16px', paddingRight: '16px' }}>
                {navigation.map((item) => {
                  const isActive = router.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        paddingTop: '16px',
                        paddingBottom: '16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderRadius: '16px',
                        marginBottom: '12px',
                        textDecoration: 'none',
                        backgroundColor: isActive ? 'linear-gradient(to right, #3b82f6, #7c3aed)' : 'transparent',
                        color: isActive ? 'white' : '#374151',
                        boxShadow: isActive ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
                        transform: isActive ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ marginRight: '16px', fontSize: '20px' }}>{item.icon}</span>
                      <span style={{ fontWeight: '600' }}>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        paddingLeft: '320px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: '100vh'
      }}>
        {/* Mobile top bar */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid rgba(229, 231, 235, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '16px',
            paddingBottom: '16px'
          }}>
            <button
              type="button"
              style={{
                padding: '8px',
                borderRadius: '12px',
                color: '#6b7280',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '24px'
              }}
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(to right, #2563eb, #7c3aed)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>QA</span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>AI Platform</span>
            </div>
            <div style={{ width: '40px' }}></div>
          </div>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, width: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}