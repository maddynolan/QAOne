/**
 * Blog Landing Page — Content marketing hub
 *
 * Route: /blog
 * Lists blog posts with category filtering.
 * Posts are defined as data here (can later be backed by CMS or MDX).
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { trackCTAClick } from '@/lib/web-analytics';
import {
  ArrowRight, BookOpen, Clock, Tag, Search,
  ChevronRight, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MarketingHeader } from '@/components/MarketingHeader';

// ── Blog Post Data ─────────────────────────────────────────────────────────

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date: string;
  featured?: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'why-30-percent-automated-tests-flaky',
    title: 'Why 30% of Your Automated Tests Are Flaky (And How to Fix It)',
    excerpt: 'Flaky tests are the #1 complaint in test automation. We break down the root causes — timing issues, selector brittleness, environment drift — and show how self-healing locators solve each one.',
    category: 'Best Practices',
    readTime: '8 min',
    date: '2026-02-15',
    featured: true,
  },
  {
    slug: 'replace-selenium-postman-jmeter',
    title: 'How to Replace Selenium + Postman + JMeter With One Platform',
    excerpt: 'Most QA teams use 5-8 separate tools. Here is a step-by-step migration guide for consolidating your browser automation, API testing, and load testing into a single unified platform.',
    category: 'Migration Guides',
    readTime: '12 min',
    date: '2026-02-10',
    featured: true,
  },
  {
    slug: 'no-code-test-automation-2026',
    title: 'No-Code Test Automation in 2026: What Actually Works',
    excerpt: 'The no-code testing market has exploded. We compare the approaches — recording, visual builders, AI generation — and explain which works best for different team compositions.',
    category: 'Industry Trends',
    readTime: '6 min',
    date: '2026-02-05',
  },
  {
    slug: 'visual-regression-testing-guide',
    title: 'The Complete Guide to Visual Regression Testing',
    excerpt: 'Pixel-perfect, anti-aliased, perceptual hash, SSIM, layout, and AI semantic — we explain all 6 comparison modes and when to use each one for maximum coverage with minimum false positives.',
    category: 'Tutorials',
    readTime: '10 min',
    date: '2026-01-28',
  },
  {
    slug: 'salesforce-testing-pain-points',
    title: '7 Salesforce Testing Pain Points (And How Native Tools Solve Them)',
    excerpt: 'Shadow DOM, dynamic IDs, Lightning components, and SOQL validation make Salesforce notoriously hard to test. Here is how purpose-built Salesforce testing tools handle each challenge.',
    category: 'Salesforce',
    readTime: '9 min',
    date: '2026-01-20',
  },
  {
    slug: 'api-testing-beyond-rest',
    title: 'API Testing Beyond REST: gRPC, GraphQL, Kafka, MQTT, and WebSocket',
    excerpt: 'REST is table stakes. Modern architectures use event-driven messaging, streaming protocols, and RPC frameworks. Here is how to test all of them from a single platform.',
    category: 'Tutorials',
    readTime: '11 min',
    date: '2026-01-15',
  },
  {
    slug: 'qa-tool-consolidation-roi',
    title: 'The ROI of QA Tool Consolidation: A CFO-Friendly Breakdown',
    excerpt: 'QA teams spend $115K-335K annually on testing tools. We calculate the direct cost savings, hidden savings (training, integration, vendor management), and productivity gains of consolidation.',
    category: 'ROI & Strategy',
    readTime: '7 min',
    date: '2026-01-10',
  },
  {
    slug: 'self-healing-tests-honest-guide',
    title: 'Self-Healing Tests: An Honest Guide (Not Marketing Hype)',
    excerpt: 'Every testing tool claims "self-healing." Most lie. We explain the 4 healing layers (knowledge, deterministic, vision AI, OCR), when each works, and when they fail.',
    category: 'Best Practices',
    readTime: '8 min',
    date: '2026-01-05',
  },
];

const categories = ['All', ...Array.from(new Set(blogPosts.map(p => p.category)))];

// ── Component ──────────────────────────────────────────────────────────────

export default function BlogPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  // If a slug is provided, show the blog post detail view
  const selectedPost = slug ? blogPosts.find(p => p.slug === slug) : null;

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-bold text-slate-900">Flowstral</span>
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/blog')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> All Posts
              </Button>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => navigate('/signup')}>
                Start Free <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </header>

        {/* Post Content */}
        <article className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <Button variant="ghost" className="mb-6 text-slate-500" onClick={() => navigate('/blog')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Blog
            </Button>
            <Badge className="mb-4 bg-blue-50 text-blue-700 border-blue-200">{selectedPost.category}</Badge>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">{selectedPost.title}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 mb-8">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {selectedPost.readTime} read</span>
              <span>{new Date(selectedPost.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="prose prose-slate max-w-none">
              <p className="text-lg text-slate-700 leading-relaxed mb-6">{selectedPost.excerpt}</p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                <p className="text-blue-800 font-medium mb-3">This article is coming soon.</p>
                <p className="text-blue-600 text-sm mb-4">We are actively writing in-depth content for our blog. Check back soon for the full article.</p>
                <Button onClick={() => navigate('/signup')} className="bg-blue-600 hover:bg-blue-700">
                  Get Notified When Published <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </article>

        {/* Footer */}
        <footer className="py-8 px-6 bg-slate-900 text-center">
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  const filtered = useMemo(() => {
    return blogPosts.filter(post => {
      const matchCategory = activeCategory === 'All' || post.category === activeCategory;
      const matchSearch = !search ||
        post.title.toLowerCase().includes(search.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [activeCategory, search]);

  const featured = blogPosts.filter(p => p.featured);

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Blog</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            QA Insights & Guides
          </h1>
          <p className="text-xl text-slate-600">
            Expert articles on test automation, QA strategy, and engineering productivity.
          </p>
        </div>
      </section>

      {/* Featured Posts */}
      {activeCategory === 'All' && !search && (
        <section className="pb-12 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {featured.map(post => (
                <div
                  key={post.slug}
                  className="p-6 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:shadow-md transition-all group"
                  onClick={() => navigate(`/blog/${post.slug}`)}
                >
                  <Badge className="mb-3 bg-blue-100 text-blue-700 border-0">{post.category}</Badge>
                  <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{post.title}</h2>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime}</span>
                    <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    activeCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search articles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Post List */}
      <section className="pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-4">
            {filtered.map(post => (
              <div
                key={post.slug}
                className="flex items-start gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(`/blog/${post.slug}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className="text-xs">{post.category}</Badge>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors mb-1">{post.title}</h3>
                  <p className="text-sm text-slate-600 line-clamp-1">{post.excerpt}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 flex-shrink-0 mt-1 transition-colors" />
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No articles match your search. Try a different keyword.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
            Try what you just read about
          </h2>
          <p className="text-slate-400 mb-8">
            Free tier available. No credit card required.
          </p>
          <Button
            className="h-12 px-8 rounded-xl text-lg font-semibold bg-white text-slate-900 hover:bg-slate-100"
            onClick={() => { trackCTAClick('get_started_free', '/blog'); navigate('/signup'); }}
          >
            Get Started Free <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
          <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link to="/demo" className="hover:text-white transition-colors">Demo</Link>
          <Link to="/tools/cost-calculator" className="hover:text-white transition-colors">Cost Calculator</Link>
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">&copy; {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
