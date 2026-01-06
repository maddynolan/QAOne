/**
 * About Us Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowRight, Users, Target, Heart, Globe, Award, Rocket,
  ChevronRight, Linkedin, Twitter, Building2, Sparkles
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
  { icon: Target, title: 'Quality First', desc: 'We believe every user deserves software that works flawlessly.' },
  { icon: Users, title: 'Empower Teams', desc: 'Testing shouldn\'t require coding expertise. We make it accessible to everyone.' },
  { icon: Sparkles, title: 'Continuous Innovation', desc: 'We\'re always pushing the boundaries of what\'s possible in test automation.' },
  { icon: Heart, title: 'Customer Obsessed', desc: 'Your success is our success. We listen, learn, and build for you.' },
];

const stats = [
  { value: '10k+', label: 'Tests Run Daily' },
  { value: '500+', label: 'Happy Teams' },
  { value: '50+', label: 'Countries' },
  { value: '99.9%', label: 'Uptime' },
];

const team = [
  { name: 'Sarah Chen', role: 'CEO & Co-Founder', image: '👩‍💼' },
  { name: 'Marcus Johnson', role: 'CTO & Co-Founder', image: '👨‍💻' },
  { name: 'Emily Rodriguez', role: 'VP Engineering', image: '👩‍🔬' },
  { name: 'David Kim', role: 'VP Product', image: '👨‍🎨' },
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
            Making Quality Assurance
            <span className="block text-violet-600">Accessible to Everyone</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            We started Flowstral with a simple belief: testing software shouldn't require 
            writing code. Our mission is to empower every team to ship quality software faster.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-slate-400">{stat.label}</div>
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

      {/* Team */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-violet-100 text-violet-700 border-0">Leadership</Badge>
            <h2 className="text-3xl font-bold text-slate-900">Meet the Team</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {team.map((member, idx) => (
              <div key={idx} className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center text-5xl">
                  {member.image}
                </div>
                <h3 className="text-lg font-bold text-slate-800">{member.name}</h3>
                <p className="text-sm text-slate-500 mb-3">{member.role}</p>
                <div className="flex justify-center gap-2">
                  <a href="#" className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-blue-500 hover:text-white transition-all">
                    <Linkedin className="w-4 h-4" />
                  </a>
                  <a href="#" className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-blue-400 hover:text-white transition-all">
                    <Twitter className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
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
              className="h-12 px-8 border-white/30 text-white hover:bg-white/10 rounded-xl"
            >
              <Building2 className="w-5 h-5 mr-2" /> View Careers
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

