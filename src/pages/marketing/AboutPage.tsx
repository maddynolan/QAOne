/**
 * About Us Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowRight, Users, Target, Heart, Rocket, Building2, Sparkles
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
            <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Pricing</Link>
            <Link to="/resources/docs" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Docs</Link>
            <Link to="/about" className="text-sm text-blue-600 font-semibold">About</Link>
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

const values = [
  { icon: Target, title: 'Quality First', desc: 'Every bug that reaches production is a user experience we failed to protect. We obsess over quality.' },
  { icon: Users, title: 'Empower Everyone', desc: 'Great testing shouldn\'t require a CS degree. We make enterprise-grade QA accessible to all team members.' },
  { icon: Sparkles, title: 'Innovation Driven', desc: 'From AI-powered self-healing tests to visual regression detection, we\'re redefining what\'s possible.' },
  { icon: Heart, title: 'Built with Empathy', desc: 'We\'ve lived the QA pain. Every feature we build comes from real testing challenges we\'ve faced.' },
];

const painPoints = [
  { icon: '😤', title: 'Flaky Tests', desc: 'Tests that pass sometimes and fail randomly, eating up hours of debugging time.' },
  { icon: '⏰', title: 'Maintenance Hell', desc: 'Spending more time fixing tests than writing new ones after every UI change.' },
  { icon: '🔧', title: 'Complex Setup', desc: 'Needing a development team just to maintain your test automation framework.' },
  { icon: '🎯', title: 'Lack of Coverage', desc: 'Never quite testing everything because automation is too slow or complicated.' },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-violet-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-violet-100 text-violet-700 border-0 px-4 py-1.5">
            Our Story
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Born from Real
            <span className="block text-violet-600">QA Pain</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Flowstral was created by a passionate QA architect who spent over a decade 
            in the trenches—debugging flaky tests at 2 AM, maintaining thousands of brittle 
            scripts, and watching teams struggle with test automation complexity.
          </p>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-lg mx-auto text-center">
            <p className="text-slate-600 leading-relaxed">
              After years of watching talented QA professionals spend more time fighting 
              their tools than testing their applications, we asked a simple question: 
              <span className="font-semibold text-slate-800"> Why is test automation still so hard?</span>
            </p>
            <p className="text-slate-600 leading-relaxed mt-4">
              The answer led us to build Flowstral—a platform that combines the power of 
              enterprise-grade test automation with the simplicity of recording your actions. 
              No coding required. No complex frameworks to learn. Just record, enhance with AI, 
              and run reliable tests across web, mobile, and API.
            </p>
          </div>
        </div>
      </section>

      {/* Pain Points We Solve */}
      <section className="py-16 px-6 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-4">We've Felt Every QA Pain</h2>
          <p className="text-slate-400 text-center mb-10 max-w-2xl mx-auto">
            These weren't just problems we observed—we lived them. That's why we built Flowstral.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {painPoints.map((point, idx) => (
              <div key={idx} className="text-center p-4">
                <div className="text-4xl mb-3">{point.icon}</div>
                <div className="text-lg font-semibold text-white mb-1">{point.title}</div>
                <div className="text-sm text-slate-400">{point.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-700 border-0">Our Values</Badge>
            <h2 className="text-3xl font-bold text-slate-900">What Drives Us</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, idx) => (
              <div key={idx} className="p-6 bg-slate-50 rounded-2xl hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{value.title}</h3>
                <p className="text-sm text-slate-500">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-violet-100 text-violet-700 border-0">Our Mission</Badge>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Democratizing Quality Assurance</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">What We Believe</h3>
              <p className="text-slate-600">
                Every software team deserves access to powerful test automation—not just those 
                with dedicated SDET teams and big budgets. Quality shouldn't be a privilege; 
                it should be a standard.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 flex items-center justify-center mb-4">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Where We're Headed</h3>
              <p className="text-slate-600">
                We're building the future where AI handles the tedious parts of testing—maintenance, 
                healing broken selectors, generating edge cases—so QA professionals can focus on 
                what matters: ensuring great user experiences.
              </p>
            </div>
          </div>

          <div className="mt-8 p-8 bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl border border-blue-100 text-center">
            <p className="text-lg text-slate-700 italic">
              "We're not just building a testing tool. We're giving QA professionals 
              their nights and weekends back."
            </p>
            <p className="text-sm text-slate-500 mt-2">— The Flowstral Team</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-violet-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Join Us in Transforming QA</h2>
          <p className="text-xl text-white/80 mb-8">Start your free trial or explore career opportunities.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => navigate('/signup')}
              className="h-12 px-8 bg-white text-violet-600 hover:bg-white/90 font-semibold rounded-xl"
            >
              <Rocket className="w-5 h-5 mr-2" /> Start Free Trial
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate('/resources/careers')}
              className="h-12 px-8 border-white/30 text-white hover:bg-white/10 rounded-xl"
            >
              <Building2 className="w-5 h-5 mr-2" /> View Careers
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <p className="text-slate-400 text-sm">© 2026 Flowstral. All rights reserved.</p>
      </footer>
    </div>
  );
}

