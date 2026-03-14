/**
 * Terms of Service Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Shield, Scale, FileText, Lock, AlertTriangle, Gavel } from 'lucide-react';
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
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
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
          <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => navigate('/signup')}>
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </header>
  );
}

const sections = [
  {
    id: 'license',
    icon: FileText,
    title: '1. License Grant',
    content: `Subject to your compliance with these Terms, Flowstral grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Flowstral platform ("Service") for your internal business purposes.

**Permitted Uses:**
- Use the Service for software quality assurance and testing purposes
- Create, manage, and execute test cases within the platform
- Generate test reports and analytics for your organization
- Integrate with your existing development workflows via our APIs

**License Restrictions:**
- You may not sublicense, sell, lease, or otherwise transfer the Service to any third party
- You may not modify, adapt, translate, or create derivative works based on the Service
- You may not reverse engineer, decompile, or disassemble any part of the Service
- You may not use the Service to develop a competing product or service`
  },
  {
    id: 'ip',
    icon: Shield,
    title: '2. Intellectual Property & Patents',
    content: `**Ownership:**
Flowstral and its licensors retain all right, title, and interest in and to the Service, including all related intellectual property rights. The Service is protected by copyright, trademark, patent, and other laws.

**Patented Technology:**
Certain features of the Flowstral platform incorporate patented and patent-pending technologies, including but not limited to:
- Smart element recognition and self-healing test technology (Patent Pending)
- No-code test case unification methodology (Patent Pending)
- Intelligent test correlation and suggestion engine (Patent Pending)
- Visual workflow builder architecture (Patent Pending)

**Trademarks:**
"Flowstral," the Flowstral logo, and all related names, logos, product and service names are trademarks of Flowstral Inc. You may not use such marks without our prior written permission.

**Your Content:**
You retain ownership of all data, test cases, and content you create using the Service ("Your Content"). You grant us a limited license to use Your Content solely to provide the Service to you.`
  },
  {
    id: 'redistribution',
    icon: AlertTriangle,
    title: '3. Redistribution Prohibited',
    content: `**Strict Prohibition:**
You are expressly prohibited from redistributing, reselling, or repackaging the Flowstral platform or any of its components, including:

- The software application and all associated code
- APIs and integration components
- Documentation and training materials
- Test templates, generators, and pre-built components
- Any data models or algorithms

**Export Compliance:**
You agree to comply with all applicable export laws and regulations. You may not export or re-export the Service to any country, entity, or person to which export is prohibited.

**Third-Party Distribution:**
You may not distribute access credentials, API keys, or license keys to any third party without our express written consent.`
  },
  {
    id: 'usage',
    icon: Scale,
    title: '4. Acceptable Use Policy',
    content: `You agree not to use the Service to:

- Violate any applicable laws or regulations
- Infringe upon the intellectual property rights of others
- Transmit malicious code, viruses, or harmful software
- Attempt to gain unauthorized access to our systems or networks
- Interfere with or disrupt the integrity of the Service
- Use automated systems to scrape or extract data from the Service
- Conduct load testing or stress testing against our infrastructure without prior written approval
- Use the Service for cryptocurrency mining or similar resource-intensive activities

**Rate Limits:**
We reserve the right to impose reasonable rate limits on API usage and test execution to ensure fair access for all users.`
  },
  {
    id: 'confidential',
    icon: Lock,
    title: '5. Confidentiality',
    content: `**Definition:**
"Confidential Information" means any non-public information disclosed by either party, including business plans, technical data, product roadmaps, pricing, and customer information.

**Obligations:**
Both parties agree to:
- Maintain the confidentiality of all Confidential Information
- Use Confidential Information only for the purposes of this Agreement
- Not disclose Confidential Information to third parties without prior written consent
- Take reasonable measures to protect Confidential Information

**Exceptions:**
Confidential Information does not include information that:
- Is or becomes publicly available without breach of this Agreement
- Was known to the receiving party prior to disclosure
- Is independently developed by the receiving party
- Is required to be disclosed by law or legal process`
  },
  {
    id: 'liability',
    icon: Gavel,
    title: '6. Limitation of Liability',
    content: `**Disclaimer:**
THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLOWSTRAL DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

**Limitation:**
IN NO EVENT SHALL FLOWSTRAL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.

**Cap:**
FLOWSTRAL'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY YOU TO FLOWSTRAL IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

**Indemnification:**
You agree to indemnify and hold harmless Flowstral from any claims arising from your use of the Service or violation of these Terms.`
  },
];

export default function TermsPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('license');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-slate-100 text-slate-700 border-0 px-4 py-1.5">
            Legal
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Terms of Service
          </h1>
          <p className="text-xl text-slate-600 mb-4">
            Please read these terms carefully before using Flowstral.
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
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
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
              {/* Introduction */}
              <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Agreement Overview</h2>
                <p className="text-slate-700 leading-relaxed">
                  These Terms of Service ("Terms") constitute a legally binding agreement between you and Flowstral Inc. ("Flowstral," "we," "us," or "our") governing your access to and use of the Flowstral platform and services. By accessing or using our Service, you agree to be bound by these Terms. If you do not agree, you may not access or use the Service.
                </p>
              </div>

              {/* Sections */}
              {sections.map((section) => (
                <div key={section.id} id={section.id} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <section.icon className="w-6 h-6 text-slate-700" />
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
                <h2 className="text-xl font-bold text-slate-900 mb-4">Questions About These Terms?</h2>
                <p className="text-slate-600 mb-6">
                  If you have any questions about these Terms of Service, please contact our legal team.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button onClick={() => navigate('/contact')} className="bg-blue-600 hover:bg-blue-700">
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
          <Link to="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
          <span className="text-slate-600">•</span>
          <Link to="/terms" className="text-blue-400 font-medium">Terms of Service</Link>
          <span className="text-slate-600">•</span>
          <Link to="/contact" className="text-slate-400 hover:text-white transition-colors">Contact</Link>
        </div>
        <p className="text-slate-500 text-xs mt-4">&copy; {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}

