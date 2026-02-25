/**
 * Privacy Policy Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Shield, Eye, Database, Globe, Lock, UserCheck, Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Shared Header
function MarketingHeader() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50" : "bg-white/80 backdrop-blur-sm"
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold text-slate-800">Flowstral</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Features</Link>
            <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Pricing</Link>
            <Link to="/compare/katalon" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Compare</Link>
            <Link to="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Blog</Link>
            <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">About</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900 font-medium" onClick={() => navigate('/signin')}>
            Sign In
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" onClick={() => navigate('/signup')}>
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </header>
  );
}

const sections = [
  {
    id: 'collection',
    icon: Database,
    title: '1. Information We Collect',
    content: `**Account Information:**
When you create an account, we collect your name, email address, company name, and password. For paid subscriptions, we also collect billing information.

**Usage Data:**
We automatically collect information about how you use the Service, including:
- Test case creation and execution data
- Feature usage patterns and preferences
- Performance metrics and error logs
- Device information and browser type
- IP addresses and location data

**Test Data:**
When you use our testing features, we may process test scripts, element locators, screenshots, and test results. This data is stored securely and used only to provide the Service.

**Third-Party Integrations:**
If you connect Flowstral to third-party services (Salesforce, Jira, etc.), we may receive data from those services as authorized by you.`
  },
  {
    id: 'use',
    icon: Eye,
    title: '2. How We Use Your Information',
    content: `**Service Delivery:**
- To provide, maintain, and improve the Flowstral platform
- To process transactions and send related information
- To send technical notices, updates, and support messages
- To respond to your comments and questions

**Analytics & Improvement:**
- To analyze usage patterns and improve user experience
- To develop new features and services
- To monitor and analyze trends and usage

**Communication:**
- To send promotional communications (with your consent)
- To notify you about changes to our Service
- To provide customer support

**Security:**
- To detect, prevent, and address technical issues
- To protect against fraudulent or illegal activity
- To enforce our Terms of Service`
  },
  {
    id: 'sharing',
    icon: Globe,
    title: '3. Information Sharing',
    content: `**We Do Not Sell Your Data:**
Flowstral does not sell, rent, or trade your personal information to third parties.

**Service Providers:**
We may share information with trusted third-party service providers who assist us in operating the Service, including:
- Cloud hosting providers (AWS, Google Cloud)
- Payment processors (Stripe)
- Analytics providers
- Customer support tools

**Legal Requirements:**
We may disclose information if required by law or in response to valid requests by public authorities.

**Business Transfers:**
In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.

**With Your Consent:**
We may share information for any other purpose with your explicit consent.`
  },
  {
    id: 'security',
    icon: Lock,
    title: '4. Data Security',
    content: `**Security Measures:**
We implement industry-standard security measures to protect your data:
- AES-256 encryption for data at rest
- TLS 1.3 encryption for data in transit
- Multi-factor authentication options
- Regular security audits and penetration testing
- SOC 2 Type II compliance (in progress)

**Access Controls:**
- Role-based access controls for team members
- Audit logs for all data access
- Automatic session timeout
- IP allowlisting available for Enterprise plans

**Incident Response:**
We maintain an incident response plan and will notify affected users within 72 hours of discovering a data breach that affects their personal information.

**Data Centers:**
Your data is stored in secure, SOC 2 certified data centers located in the United States and European Union.`
  },
  {
    id: 'rights',
    icon: UserCheck,
    title: '5. Your Rights (GDPR/CCPA)',
    content: `**Your Rights Include:**
- **Access:** Request a copy of your personal data
- **Rectification:** Request correction of inaccurate data
- **Deletion:** Request deletion of your data ("right to be forgotten")
- **Portability:** Request transfer of your data in a machine-readable format
- **Objection:** Object to processing of your data
- **Restriction:** Request restriction of processing

**California Residents (CCPA):**
California residents have additional rights including:
- Right to know what personal information is collected
- Right to know if personal information is sold or disclosed
- Right to opt-out of the sale of personal information
- Right to non-discrimination for exercising your rights

**European Residents (GDPR):**
We process data lawfully under GDPR, including:
- Consent for marketing communications
- Contract necessity for service delivery
- Legitimate interests for security and improvement

**Exercising Your Rights:**
To exercise any of these rights, contact us at legal@flowstral.com or through your account settings.`
  },
  {
    id: 'retention',
    icon: Trash2,
    title: '6. Data Retention',
    content: `**Active Accounts:**
We retain your data for as long as your account is active or as needed to provide services.

**After Account Deletion:**
- Personal data is deleted within 30 days
- Aggregated, anonymized data may be retained for analytics
- Backup data is purged within 90 days
- Legal hold data may be retained as required by law

**Test Data:**
- Active test data is retained while your account is active
- Deleted test cases are purged within 30 days
- Execution logs are retained for 12 months

**Enterprise Customers:**
Enterprise customers may negotiate custom retention periods as part of their agreement.`
  },
  {
    id: 'cookies',
    icon: Bell,
    title: '7. Cookies & Tracking',
    content: `**Essential Cookies:**
Required for the Service to function properly. Cannot be disabled.

**Analytics Cookies:**
Help us understand how you use the Service. Can be disabled in settings.

**Preference Cookies:**
Remember your settings and preferences.

**Marketing Cookies:**
Used to deliver relevant advertisements. Requires consent.

**Managing Cookies:**
You can manage cookie preferences through:
- Your browser settings
- Our cookie consent banner
- Account privacy settings

**Do Not Track:**
We honor Do Not Track browser signals and do not track users who have enabled this setting.`
  },
  {
    id: 'extension',
    icon: Globe,
    title: '8. Chrome Extension & Browser Recorder',
    content: `**What the Extension Collects:**
The Flowstral Recorder browser extension captures user interactions (clicks, navigation, form fills) on web pages you choose to record. This data is used solely to generate automated test scripts.

**Sensitive Data Masking:**
- Password fields and sensitive inputs are automatically masked as [MASKED] and never stored or transmitted
- HTTP headers containing authentication tokens (Authorization, Cookie, Set-Cookie, API keys) are automatically masked
- Credit card numbers, SSNs, and other sensitive patterns are never captured

**Network Traffic (Optional):**
If you enable network capture, the extension records HTTP requests and responses for protocol-level testing. Sensitive headers are masked automatically. Full unmasked network capture is only available in the Flowstral Desktop app.

**Screenshots (Optional):**
When using AI-powered test healing, screenshots may be sent to our backend for analysis. You will be notified before any screenshot is transmitted.

**Data Storage:**
- Recording data is stored in your browser's local storage
- Data is sent to your configured Flowstral backend server only when you choose to save or sync
- No data is sent to third parties without your explicit action

**Permissions:**
- The extension requests access to web pages only when you activate recording
- Network capture requires optional permission and can be disabled at any time
- All permissions can be revoked through Chrome's extension settings

**Data Deletion:**
Uninstalling the extension removes all locally stored recording data. Data synced to your Flowstral backend follows the retention policy in Section 6.`
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('collection');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-emerald-100 text-emerald-700 border-0 px-4 py-1.5">
            <Shield className="w-4 h-4 mr-1 inline" /> Your Privacy Matters
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-xl text-slate-600 mb-4">
            We're committed to protecting your privacy and being transparent about our practices.
          </p>
          <p className="text-sm text-slate-500">
            Last updated: January 6, 2025 • Effective Date: January 1, 2025
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                      activeSection === section.id
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <section.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{section.title.split('. ')[1]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12">
              {/* Trust Badges */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'GDPR Compliant', icon: Shield },
                  { label: 'CCPA Compliant', icon: UserCheck },
                  { label: 'AES-256 Encrypted', icon: Lock },
                  { label: 'SOC 2 (In Progress)', icon: Database },
                ].map((badge, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <badge.icon className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-slate-700">{badge.label}</span>
                  </div>
                ))}
              </div>

              {/* Introduction */}
              <div className="p-8 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl border border-emerald-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Our Commitment to Privacy</h2>
                <p className="text-slate-700 leading-relaxed">
                  At Flowstral Inc. ("Flowstral," "we," "us," or "our"), we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. We are committed to maintaining the trust and confidence of our users.
                </p>
              </div>

              {/* Sections */}
              {sections.map((section) => (
                <div key={section.id} id={section.id} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <section.icon className="w-6 h-6 text-emerald-700" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
                  </div>
                  <div className="prose prose-slate max-w-none">
                    {section.content.split('\n\n').map((paragraph, idx) => (
                      <div key={idx} className="mb-4">
                        {paragraph.startsWith('**') ? (
                          <div className="mb-3">
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">
                              {paragraph.split('**')[1]}
                            </h3>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                              {paragraph.split('**').slice(2).join('')}
                            </p>
                          </div>
                        ) : paragraph.startsWith('-') ? (
                          <ul className="list-disc list-inside space-y-1 text-slate-600 ml-4">
                            {paragraph.split('\n').map((item, i) => (
                              <li key={i}>{item.replace('- ', '')}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-600 leading-relaxed">{paragraph}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Contact */}
              <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Privacy Questions?</h2>
                <p className="text-slate-600 mb-6">
                  If you have any questions about this Privacy Policy or our data practices, please contact our Data Protection Officer.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button onClick={() => navigate('/contact')} className="bg-emerald-600 hover:bg-emerald-700">
                    Contact Us
                  </Button>
                  <Button variant="outline" onClick={() => window.location.href = 'mailto:legal@flowstral.com'}>
                    legal@flowstral.com
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link to="/privacy" className="text-emerald-400 font-medium">Privacy Policy</Link>
          <span className="text-slate-600">•</span>
          <Link to="/terms" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
          <span className="text-slate-600">•</span>
          <Link to="/contact" className="text-slate-400 hover:text-white transition-colors">Contact</Link>
        </div>
        <p className="text-slate-500 text-xs mt-4">&copy; {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}

