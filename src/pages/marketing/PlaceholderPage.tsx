/**
 * Placeholder Pages for Coming Soon content
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { 
  ArrowRight, ArrowLeft, Mail, Bell, BookOpen, Code2,
  Users, Newspaper, Handshake, HelpCircle, MessageSquare,
  GraduationCap, FileText, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Shared Header
function MarketingHeader() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
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
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('/signup')}>
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </header>
  );
}

// Page configurations
const pageConfigs: Record<string, {
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  gradient: string;
  cta?: { label: string; action: string };
}> = {
  'docs': {
    title: 'Documentation',
    subtitle: 'Learn Flowstral',
    description: 'Comprehensive guides, tutorials, and API references to help you get the most out of Flowstral. Our documentation is being expanded daily.',
    icon: BookOpen,
    gradient: 'from-blue-500 to-cyan-500',
    cta: { label: 'Get Started', action: '/auth' }
  },
  'api-reference': {
    title: 'API Reference',
    subtitle: 'Developer Docs',
    description: 'Complete API documentation with examples, authentication guides, and SDK references for integrating Flowstral into your workflow.',
    icon: Code2,
    gradient: 'from-slate-600 to-slate-700',
    cta: { label: 'View Docs', action: '/auth' }
  },
  'tutorials': {
    title: 'Tutorials',
    subtitle: 'Step-by-Step Guides',
    description: 'Learn how to use every feature of Flowstral with our hands-on tutorials. From basic recording to advanced performance testing.',
    icon: GraduationCap,
    gradient: 'from-emerald-500 to-teal-500',
    cta: { label: 'Start Learning', action: '/auth' }
  },
  'blog': {
    title: 'Blog',
    subtitle: 'News & Insights',
    description: 'Stay updated with the latest QA trends, best practices, product updates, and insights from the Flowstral team.',
    icon: Newspaper,
    gradient: 'from-orange-500 to-amber-500',
    cta: { label: 'Subscribe', action: '/contact' }
  },
  'community': {
    title: 'Community',
    subtitle: 'Join the Conversation',
    description: 'Connect with other QA professionals, share tips, ask questions, and help shape the future of Flowstral.',
    icon: Users,
    gradient: 'from-teal-500 to-teal-600',
    cta: { label: 'Join Discord', action: '/contact' }
  },
  'careers': {
    title: 'Careers',
    subtitle: 'Coming Soon',
    description: 'We\'re growing! Our careers page is currently under construction. Check back soon for exciting opportunities to join our team and help revolutionize QA automation.',
    icon: Building2,
    gradient: 'from-slate-500 to-slate-600',
    cta: { label: 'Contact Us Instead', action: '/contact' }
  },
  'partners': {
    title: 'Partners',
    subtitle: 'Grow Together',
    description: 'Partner with Flowstral to bring no-code testing to more teams. We offer referral, reseller, and technology partnership programs.',
    icon: Handshake,
    gradient: 'from-teal-500 to-emerald-500',
    cta: { label: 'Become a Partner', action: '/contact' }
  },
  'support': {
    title: 'Support',
    subtitle: 'We\'re Here to Help',
    description: 'Get help from our support team. Check our knowledge base, submit a ticket, or chat with us directly.',
    icon: HelpCircle,
    gradient: 'from-sky-500 to-blue-500',
    cta: { label: 'Contact Support', action: '/contact' }
  },
};

export default function PlaceholderPage() {
  const navigate = useNavigate();
  const { page } = useParams<{ page: string }>();
  const [email, setEmail] = useState('');
  
  const config = page ? pageConfigs[page] : null;
  
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Page Not Found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          {/* Icon */}
          <div className="w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center bg-slate-200">
            <Icon className="w-10 h-10 text-slate-700" />
          </div>

          {/* Subtitle */}
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">{config.subtitle}</p>

          {/* Title */}
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            {config.title}
          </h1>

          {/* Description */}
          <p className="text-xl text-slate-600 leading-relaxed mb-8">
            {config.description}
          </p>

          {/* Coming Soon Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 mb-8">
            <Bell className="w-4 h-4" />
            <span className="text-sm font-medium">Coming Soon - Get Notified</span>
          </div>

          {/* Email Signup */}
          <div className="max-w-md mx-auto mb-8">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
              <Button className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Mail className="w-4 h-4 mr-2" /> Notify Me
              </Button>
            </div>
          </div>

          {/* CTA */}
          {config.cta && (
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate(config.cta!.action)}
              className="h-12 px-8 rounded-xl"
            >
              {config.cta.label} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 text-center mb-8">In the meantime, explore:</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Start Free Trial', href: '/signup', icon: ArrowRight },
              { label: 'View Pricing', href: '/pricing', icon: FileText },
              { label: 'Contact Us', href: '/contact', icon: MessageSquare },
            ].map((link, idx) => (
              <Button 
                key={idx}
                variant="outline" 
                className="h-14 justify-start px-6"
                onClick={() => navigate(link.href)}
              >
                <link.icon className="w-5 h-5 mr-3" /> {link.label}
              </Button>
            ))}
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

