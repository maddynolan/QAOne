# QA AI Platform

> An intelligent Quality Assurance platform for managing test plans, test cases, test runs, and defects with AI-powered insights.

## 🚀 Project Overview

QA AI Platform is a comprehensive testing management solution designed to streamline the entire QA lifecycle. From planning test strategies to tracking defects, this platform provides teams with the tools they need to ensure software quality.

**Live Demo**: https://lovable.dev/projects/3a83fa07-1365-49d9-befd-ca91ddd8af04

## ✨ Key Features

### Test Management
- **Test Plans**: Create and manage comprehensive test suites with customizable strategies
- **Test Cases**: Define detailed test cases with step-by-step instructions, preconditions, and expected results
- **Test Runs**: Execute test plans and track progress in real-time
- **Test Execution Details**: View detailed test run results with pass/fail statistics and execution timeline

### Defect Tracking
- **Bug Reporting**: Comprehensive defect creation with severity, priority, and lifecycle management
- **Defect Lifecycle**: Track bugs from creation through resolution with customizable statuses
- **Environment Details**: Capture browser, OS, version, and environment information
- **Reproduction Steps**: Document detailed steps to reproduce issues

### Dashboard & Analytics
- **Real-time Metrics**: Track active test plans, total test cases, and pass rates
- **Quick Actions**: Fast access to common tasks like running tests and creating plans
- **Recent Activity**: Monitor latest test runs and their outcomes
- **Triage Management**: Prioritize and manage critical issues

## 🛠️ Technology Stack

This project is built with modern web technologies:

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: shadcn/ui component library
- **Routing**: React Router DOM v6
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Notifications**: Sonner for toast messages

## 📋 Prerequisites

- Node.js 18+ and npm (recommend using [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Git for version control
- A Supabase account (for backend services)

## 🚦 Getting Started

### Installation

```sh
# Clone the repository
git clone https://github.com/maddynolan/QAOne.git

# Navigate to project directory
cd QAOne

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Environment Setup

Create a `.env` file in the root directory (if not already present):

```env
# Supabase Configuration (already configured)
SUPABASE_URL=https://fimqstvogqqnkvasorlj.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

## 📁 Project Structure

```
QAOne/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── AppSidebar.tsx  # Navigation sidebar
│   │   ├── Layout.tsx      # Main layout wrapper
│   │   ├── MetricCard.tsx  # Dashboard metric cards
│   │   └── TopNav.tsx      # Top navigation bar
│   ├── pages/              # Route pages
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── TestPlans.tsx   # Test plans listing
│   │   ├── TestCases.tsx   # Test cases listing
│   │   ├── TestRuns.tsx    # Test runs listing
│   │   ├── Defects.tsx     # Defects listing
│   │   ├── Triage.tsx      # Issue triage
│   │   └── Settings.tsx    # App settings
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── integrations/       # External service integrations
│   │   └── supabase/       # Supabase client & types
│   ├── App.tsx             # Root component with routing
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles & design tokens
├── public/                 # Static assets
├── supabase/              # Supabase configuration
└── package.json           # Project dependencies

```

## 🎨 Design System

The platform uses a comprehensive design system built on CSS custom properties:

- **Colors**: Semantic color tokens for consistent theming
- **Typography**: Hierarchical text styles with gradient effects
- **Spacing**: Consistent spacing scale
- **Components**: Pre-built UI components with variants
- **Dark Mode**: Full dark mode support

All design tokens are defined in `src/index.css` and `tailwind.config.ts`

## 🔧 Available Scripts

```sh
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run ESLint for code quality
npm run lint
```

## 🏗️ Key Features Documentation

### Test Case Management
- Create test cases with detailed steps and expected results
- Categorize by module, priority, severity, and type
- Link test cases to test plans
- Track automation status
- Add tags for easy filtering

### Defect Lifecycle
- **New** → **Open** → **In Progress** → **Fixed** → **Retest** → **Verified** → **Closed**
- Support for **Reopened** status
- Severity levels: Blocker, Critical, Major, Minor, Trivial
- Priority levels: Critical, High, Medium, Low

### Test Execution
- Run individual test cases or entire test plans
- Real-time progress tracking
- Detailed execution timeline
- Pass/fail statistics
- Test case filtering by status

## 🚀 Deployment

### Lovable Platform (Recommended)

1. Open your project in [Lovable](https://lovable.dev/projects/3a83fa07-1365-49d9-befd-ca91ddd8af04)
2. Click Share → Publish
3. Your app will be deployed instantly

### Custom Domain

To connect your own domain:
1. Navigate to Project > Settings > Domains
2. Click "Connect Domain"
3. Follow the DNS configuration instructions

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

### Self-Hosting

You can deploy to any static hosting service:

```sh
# Build the project
npm run build

# The dist/ folder contains production-ready files
# Deploy the dist/ folder to your hosting provider
```

Compatible with: Vercel, Netlify, AWS S3, GitHub Pages, etc.

## 🔄 Development Workflow

### Using Lovable (AI-Powered)

Simply visit the [Lovable Project](https://lovable.dev/projects/3a83fa07-1365-49d9-befd-ca91ddd8af04) and start prompting. Changes made via Lovable are automatically committed to this repo.

### Using Your IDE

Make changes locally and push to GitHub. Changes will automatically sync to Lovable.

### GitHub Codespaces

Launch a cloud development environment directly from GitHub for instant coding without local setup.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is part of a QA management system. All rights reserved.

## 🔗 Resources

- [Lovable Documentation](https://docs.lovable.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Documentation](https://react.dev/)

## 💬 Support

For questions or issues:
- Create an issue in this repository
- Visit the [Lovable Discord community](https://discord.com/channels/1119885301872070706/1280461670979993613)

---

**Built with ❤️ using [Lovable](https://lovable.dev)**
