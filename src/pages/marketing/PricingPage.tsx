/**
 * Pricing Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Check, X, ArrowRight, Rocket, Building2, Users, Zap,
  ChevronRight, HelpCircle, Mail, MessageSquare
} from 'lucide-react';
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
            <Link to="/pricing" className="text-sm text-blue-600 font-semibold">Pricing</Link>
            <Link to="/resources/docs" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Docs</Link>
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

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small teams getting started',
    price: 99,
    period: 'per user/month',
    icon: Zap,
    color: 'emerald',
    features: [
      { name: 'Smart Recorder', included: true },
      { name: 'Visual Builder', included: true },
      { name: 'Test Management', included: true },
      { name: 'API Testing (Multi-Protocol)', included: true },
      { name: 'Visual Testing', included: true },
      { name: 'Accessibility Testing', included: true },
      { name: 'Up to 10 users', included: true },
      { name: '5,000 test runs/month', included: true },
      { name: 'Email Support', included: true },
      { name: 'Performance Testing', included: false },
      { name: 'Salesforce Tools', included: false },
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    description: 'For growing teams with advanced needs',
    price: 199,
    period: 'per user/month',
    icon: Users,
    color: 'blue',
    features: [
      { name: 'Everything in Starter', included: true },
      { name: 'Performance Testing (10k VUs)', included: true },
      { name: 'Salesforce Native Tools (20+)', included: true },
      { name: 'Up to 50 users', included: true },
      { name: '25,000 test runs/month', included: true },
      { name: 'Auto-Correlation', included: true },
      { name: 'Security Scanning (OWASP)', included: true },
      { name: 'CI/CD Integrations', included: true },
      { name: 'Priority Support (24h SLA)', included: true },
      { name: 'API Chaining & Assertions', included: true },
      { name: 'Actionable Dashboards', included: true },
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with custom requirements',
    price: null,
    period: 'Custom pricing',
    icon: Building2,
    color: 'violet',
    features: [
      { name: 'Everything in Professional', included: true },
      { name: 'Unlimited users', included: true },
      { name: 'Unlimited test runs', included: true },
      { name: 'Performance Testing (50k+ VUs)', included: true },
      { name: 'Custom Integrations', included: true },
      { name: 'On-Premise / Air-Gapped', included: true },
      { name: 'SSO / SAML / SCIM', included: true },
      { name: 'Dedicated Success Manager', included: true },
      { name: '24/7 Phone & Chat Support', included: true },
      { name: 'Custom SLA (99.9%)', included: true },
      { name: 'Training & Onboarding', included: true },
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-700 border-0 px-4 py-1.5">
            Simple Pricing
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Choose the Right Plan for Your Team
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Start free, scale as you grow. All plans include core testing capabilities.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={cn("text-sm font-medium", !annual ? "text-slate-900" : "text-slate-500")}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={cn(
                "relative w-14 h-7 rounded-full transition-colors",
                annual ? "bg-blue-600" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform",
                annual ? "translate-x-8" : "translate-x-1"
              )} />
            </button>
            <span className={cn("text-sm font-medium", annual ? "text-slate-900" : "text-slate-500")}>
              Annual <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-0 text-xs">Save 20%</Badge>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div 
                key={idx}
                className={cn(
                  "relative p-8 rounded-3xl border-2 transition-all hover:shadow-xl",
                  plan.popular 
                    ? "bg-gradient-to-b from-blue-50 to-white border-blue-300 shadow-lg scale-105" 
                    : "bg-white border-slate-200 hover:border-slate-300"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white border-0 px-4">
                    Most Popular
                  </Badge>
                )}

                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                  plan.color === 'emerald' ? "bg-emerald-100" :
                  plan.color === 'blue' ? "bg-blue-100" : "bg-violet-100"
                )}>
                  <plan.icon className={cn(
                    "w-7 h-7",
                    plan.color === 'emerald' ? "text-emerald-600" :
                    plan.color === 'blue' ? "text-blue-600" : "text-violet-600"
                  )} />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-6">{plan.description}</p>

                <div className="mb-6">
                  {plan.price ? (
                    <>
                      <span className="text-4xl font-bold text-slate-900">
                        ${annual ? Math.round(plan.price * 0.8) : plan.price}
                      </span>
                      <span className="text-slate-500 ml-2">{plan.period}</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-slate-900">Custom</span>
                  )}
                </div>

                <Button 
                  className={cn(
                    "w-full h-12 rounded-xl font-semibold mb-8",
                    plan.popular 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  )}
                  onClick={() => plan.price ? navigate('/auth') : window.location.href = 'mailto:sales@flowstral.com'}
                >
                  {plan.cta}
                </Button>

                <div className="space-y-3">
                  {plan.features.map((feature, fidx) => (
                    <div key={fidx} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      )}
                      <span className={cn(
                        "text-sm",
                        feature.included ? "text-slate-700" : "text-slate-400"
                      )}>{feature.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Questions? We're Here to Help</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => navigate('/faq')}>
              <HelpCircle className="w-5 h-5 mr-2" /> View FAQ
            </Button>
            <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => navigate('/contact')}>
              <MessageSquare className="w-5 h-5 mr-2" /> Chat with Us
            </Button>
            <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => window.location.href = 'mailto:support@flowstral.com'}>
              <Mail className="w-5 h-5 mr-2" /> Email Support
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <p className="text-slate-400 text-sm">© 2024 Flowstral. All rights reserved.</p>
      </footer>
    </div>
  );
}

