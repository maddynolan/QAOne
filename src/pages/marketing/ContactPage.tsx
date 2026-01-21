/**
 * Contact Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowRight, Mail, Phone, MapPin, MessageSquare, Send,
  Clock, Globe, Building2
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

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: 'general',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    alert('Thank you! We\'ll get back to you soon.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-700 border-0 px-4 py-1.5">
            Get in Touch
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            We'd Love to Hear From You
          </h1>
          <p className="text-xl text-slate-600">
            Have questions? Need a demo? Our team is here to help.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Contact Info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Contact Information</h2>
                <div className="space-y-4">
                  {[
                    { icon: Mail, label: 'Email', value: 'hello@flowstral.com', href: 'mailto:hello@flowstral.com' },
                    { icon: Phone, label: 'Phone', value: '(360) 878-3752', href: 'tel:+13608783752' },
                    { icon: MapPin, label: 'Location', value: 'Maryland, USA', href: null },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-500">{item.label}</div>
                        {item.href ? (
                          <a href={item.href} className="text-slate-800 font-medium hover:text-blue-600 transition-colors">
                            {item.value}
                          </a>
                        ) : (
                          <div className="text-slate-800 font-medium">{item.value}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-100 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold text-slate-800">Response Time</span>
                </div>
                <p className="text-sm text-slate-600">
                  We typically respond within 24 hours during business days. 
                  For urgent matters, please call us directly.
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-slate-800">Enterprise Sales</span>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Looking for custom pricing or enterprise features?
                </p>
                <Button variant="outline" className="w-full">
                  <MessageSquare className="w-4 h-4 mr-2" /> Schedule a Call
                </Button>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Send Us a Message</h2>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Company</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Your company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white"
                    >
                      <option value="general">General Inquiry</option>
                      <option value="sales">Sales / Pricing</option>
                      <option value="support">Technical Support</option>
                      <option value="demo">Request a Demo</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Message *</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                      placeholder="How can we help you?"
                    />
                  </div>

                  <Button 
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold rounded-xl"
                  >
                    <Send className="w-4 h-4 mr-2" /> Send Message
                  </Button>
                </form>
              </div>
            </div>
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

