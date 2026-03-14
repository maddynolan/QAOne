/**
 * Contact Page
 */

import React, { useState } from 'react';
import { trackEnterpriseInquiry } from '@/lib/web-analytics';
import {
  Mail, Phone, MapPin, MessageSquare, Send,
  Clock, Globe, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureContactLead } from '@/lib/leads-service';
import { MarketingHeader } from '@/components/MarketingHeader';

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
    trackEnterpriseInquiry();

    // Capture lead for tracking (non-blocking)
    captureContactLead(
      formData.email,
      formData.name,
      formData.company,
      formData.message,
      formData.subject
    ).then(result => {
      if (result.success) {
        console.log('[Contact] Lead captured:', result.lead_id);
      }
    }).catch(() => {}); // Silent fail
    
    // Route to correct email based on subject
    const emailMap: Record<string, string> = {
      'general': 'support@flowstral.com',
      'sales': 'sales@flowstral.com',
      'support': 'support@flowstral.com',
      'demo': 'sales@flowstral.com',
      'partnership': 'sales@flowstral.com',
      'legal': 'legal@flowstral.com'
    };
    
    const toEmail = emailMap[formData.subject] || 'support@flowstral.com';
    const subjectLine = encodeURIComponent(`[Flowstral ${formData.subject}] Message from ${formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n` +
      `Company: ${formData.company || 'Not provided'}\n` +
      `Subject: ${formData.subject}\n\n` +
      `Message:\n${formData.message}`
    );
    
    // Open email client with pre-filled content
    window.location.href = `mailto:${toEmail}?subject=${subjectLine}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Contact</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Get in touch
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
                    { icon: Mail, label: 'Sales', value: 'sales@flowstral.com', href: 'mailto:sales@flowstral.com' },
                    { icon: Mail, label: 'Support', value: 'support@flowstral.com', href: 'mailto:support@flowstral.com' },
                    { icon: Mail, label: 'Legal', value: 'legal@flowstral.com', href: 'mailto:legal@flowstral.com' },
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

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
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
                      <option value="legal">Legal / Compliance</option>
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
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
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

