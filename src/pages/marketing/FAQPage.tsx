/**
 * FAQ Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronDown, Search, Zap, CreditCard, Shield, Settings, Users, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarketingHeader } from '@/components/MarketingHeader';

const faqCategories = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: Zap,
    faqs: [
      {
        q: 'What is Flowstral?',
        a: 'Flowstral is a complete no-code QA platform that enables teams to create, manage, and execute tests without writing code. It combines test management, visual test building, smart recording, API testing, performance testing, and more in one unified platform.'
      },
      {
        q: 'Do I need coding experience to use Flowstral?',
        a: 'No! Flowstral is designed to be completely no-code. Our visual builder allows you to create tests by dragging and dropping actions, and our smart recorder captures your interactions automatically. Technical users can also use our API and scripting capabilities for advanced scenarios.'
      },
      {
        q: 'How do I create my first test?',
        a: 'You can start by using our Smart Trace to record your interactions with your application, or use the Visual Builder to drag and drop test steps. Both methods create unified test cases that can be executed manually or as automated tests.'
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes! All plans include a 14-day free trial with full access to all features. No credit card required to start. After the trial, you can choose the plan that best fits your needs.'
      },
    ]
  },
  {
    id: 'pricing',
    name: 'Pricing & Billing',
    icon: CreditCard,
    faqs: [
      {
        q: 'How is pricing calculated?',
        a: 'Pricing is per user per month. Each plan includes different feature sets and usage limits. Annual billing saves you 20% compared to monthly billing.'
      },
      {
        q: 'Can I upgrade or downgrade my plan?',
        a: 'Yes, you can change your plan at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the start of your next billing cycle.'
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and wire transfers for Enterprise customers. Annual plans can also be paid by invoice.'
      },
      {
        q: 'What happens if I exceed my test run limits?',
        a: 'We\'ll notify you when you\'re approaching your limit. You can either upgrade your plan or purchase additional test runs. We won\'t stop your tests mid-execution.'
      },
    ]
  },
  {
    id: 'features',
    name: 'Features & Capabilities',
    icon: Settings,
    faqs: [
      {
        q: 'What testing types does Flowstral support?',
        a: 'Flowstral supports functional testing, API testing (REST, GraphQL, SOAP), performance testing (up to 50k+ virtual users), visual regression testing, accessibility testing (WCAG 2.1), and Salesforce-native testing with 20+ specialized tools.'
      },
      {
        q: 'How does the Smart Trace work?',
        a: 'The Smart Trace captures your browser interactions and automatically generates test steps. It uses intelligent element recognition to create robust locators, suggests assertions, and handles dynamic content. For Salesforce, it also understands metadata context.'
      },
      {
        q: 'Can the same test run manually and automated?',
        a: 'Yes! This is a core feature of Flowstral. Every test case can be executed either manually (with step-by-step guidance) or as automated test with a single click. This unified approach maximizes test coverage and automation efficiency.'
      },
      {
        q: 'What integrations are available?',
        a: 'Flowstral integrates with Salesforce, Jira, Azure DevOps, GitHub, GitLab, Jenkins, CircleCI, Slack, Teams, and many more. Enterprise customers can also request custom integrations.'
      },
    ]
  },
  {
    id: 'security',
    name: 'Security & Compliance',
    icon: Shield,
    faqs: [
      {
        q: 'How is my data protected?',
        a: 'We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. Our infrastructure is hosted on SOC 2 certified data centers with regular security audits and penetration testing.'
      },
      {
        q: 'Is Flowstral GDPR compliant?',
        a: 'Yes, Flowstral is fully GDPR compliant. We provide data processing agreements, support data subject rights, and maintain appropriate technical and organizational measures to protect personal data.'
      },
      {
        q: 'Can I deploy Flowstral on-premise?',
        a: 'Enterprise customers can deploy Flowstral in their own infrastructure, including air-gapped environments. Contact our sales team for more information about on-premise deployment options.'
      },
      {
        q: 'Do you offer SSO and SAML?',
        a: 'Yes, SSO via SAML 2.0 and SCIM is available on Enterprise plans. We also support OAuth 2.0 for integrations and API access.'
      },
    ]
  },
  {
    id: 'team',
    name: 'Teams & Collaboration',
    icon: Users,
    faqs: [
      {
        q: 'How many team members can I add?',
        a: 'Starter plans support up to 10 users, Professional up to 50 users, and Enterprise plans have unlimited users. Each user can have different roles and permissions.'
      },
      {
        q: 'What collaboration features are available?',
        a: 'Flowstral includes shared test repositories, real-time collaboration, comments and annotations, version history, branching for test cases, and team dashboards for visibility.'
      },
      {
        q: 'Can I control access to different projects?',
        a: 'Yes, you can create separate projects with their own team members and permissions. Role-based access control lets you define who can view, edit, and execute tests.'
      },
    ]
  },
  {
    id: 'technical',
    name: 'Technical Questions',
    icon: Code,
    faqs: [
      {
        q: 'Which browsers are supported for test execution?',
        a: 'Flowstral supports Chrome, Firefox, Edge, and Safari for web testing. We use the latest browser versions and support headless execution for CI/CD pipelines.'
      },
      {
        q: 'Can I use Flowstral in my CI/CD pipeline?',
        a: 'Yes! We provide CLI tools and APIs for integrating with any CI/CD system. Pre-built integrations are available for Jenkins, GitHub Actions, GitLab CI, Azure Pipelines, and CircleCI.'
      },
      {
        q: 'What APIs does Flowstral support testing?',
        a: 'Flowstral supports REST, GraphQL, and SOAP APIs. Features include request chaining, variable extraction, schema validation, security scanning (SQL injection, OWASP Top 10), and performance testing.'
      },
      {
        q: 'How does self-healing work?',
        a: 'Our self-healing technology automatically updates element locators when your application UI changes. It uses multiple locator strategies and intelligent matching to find elements even when attributes change.'
      },
    ]
  },
];

function FAQItem({ question, answer, isOpen, onToggle }: { question: string; answer: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="font-medium text-slate-900 pr-4">{question}</span>
        <ChevronDown className={cn(
          "w-5 h-5 text-slate-500 flex-shrink-0 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isOpen ? "max-h-96" : "max-h-0"
      )}>
        <div className="p-5 pt-0 text-slate-600 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('getting-started');
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = searchQuery
    ? faqCategories.map(cat => ({
        ...cat,
        faqs: cat.faqs.filter(faq => 
          faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.faqs.length > 0)
    : faqCategories;

  const currentCategory = filteredCategories.find(cat => cat.id === activeCategory) || filteredCategories[0];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Help Center</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Find answers to common questions about Flowstral
          </p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Category Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-2">
                {faqCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setActiveCategory(category.id);
                      setOpenFAQ(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                      activeCategory === category.id
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <category.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* FAQ List */}
            <div className="lg:col-span-3 space-y-4">
              {searchQuery && (
                <p className="text-sm text-slate-500 mb-4">
                  Found {filteredCategories.reduce((sum, cat) => sum + cat.faqs.length, 0)} results for "{searchQuery}"
                </p>
              )}
              
              {searchQuery ? (
                // Show all matching FAQs when searching
                filteredCategories.map(category => (
                  <div key={category.id} className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <category.icon className="w-5 h-5" />
                      {category.name}
                    </h3>
                    {category.faqs.map((faq, idx) => (
                      <FAQItem
                        key={`${category.id}-${idx}`}
                        question={faq.q}
                        answer={faq.a}
                        isOpen={openFAQ === `${category.id}-${idx}`}
                        onToggle={() => setOpenFAQ(openFAQ === `${category.id}-${idx}` ? null : `${category.id}-${idx}`)}
                      />
                    ))}
                  </div>
                ))
              ) : (
                // Show current category FAQs
                currentCategory?.faqs.map((faq, idx) => (
                  <FAQItem
                    key={idx}
                    question={faq.q}
                    answer={faq.a}
                    isOpen={openFAQ === `${activeCategory}-${idx}`}
                    onToggle={() => setOpenFAQ(openFAQ === `${activeCategory}-${idx}` ? null : `${activeCategory}-${idx}`)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-16 px-6 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
          <p className="text-slate-400 mb-8">
            Our support team is here to help. Reach out and we'll get back to you within 24 hours.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button onClick={() => navigate('/contact')} className="bg-white text-blue-600 hover:bg-blue-50">
              Contact Support
            </Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => navigate('/demo')}>
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link to="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
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

