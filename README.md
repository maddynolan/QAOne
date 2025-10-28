# QA AI Platform

> An intelligent Quality Assurance platform with AI-powered test generation, execution, and analysis.

## 🚀 Project Overview

QA AI Platform is a comprehensive testing management solution designed to streamline the entire QA lifecycle. From AI-powered test generation to intelligent defect analysis, this platform provides teams with cutting-edge tools to ensure software quality.

**Live Demo**: https://lovable.dev/projects/3a83fa07-1365-49d9-befd-ca91ddd8af04

## ✨ Key Features

### 🤖 AI-Powered Test Generation
- **Smart Test Case Creation**: Generate comprehensive test cases from feature descriptions
- **Intelligent Defect Analysis**: AI-powered root cause analysis and suggested fixes
- **Context-Aware Responses**: Dynamic test steps based on test type and complexity
- **Mock AI Service**: Development-ready AI simulation for immediate testing

### 📋 Test Management
- **Test Plans**: Create and manage comprehensive test suites with customizable strategies
- **Test Cases**: Define detailed test cases with step-by-step instructions, preconditions, and expected results
- **Test Runs**: Execute test plans and track progress in real-time
- **Test Execution Details**: View detailed test run results with pass/fail statistics and execution timeline

### 🐛 Defect Tracking
- **Bug Reporting**: Comprehensive defect creation with severity, priority, and lifecycle management
- **AI-Powered Triage**: Intelligent failure analysis with root cause identification
- **Defect Lifecycle**: Track bugs from creation through resolution with customizable statuses
- **Environment Details**: Capture browser, OS, version, and environment information

### 📊 Dashboard & Analytics
- **Real-time Metrics**: Track active test plans, total test cases, and pass rates
- **Quick Actions**: Fast access to common tasks like running tests and creating plans
- **Recent Activity**: Monitor latest test runs and their outcomes
- **AI Configuration**: Manage AI service settings and test connections

## 🛠️ Technology Stack

This project is built with modern web technologies:

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: shadcn/ui component library
- **Routing**: React Router DOM v6
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Backend**: Supabase (BaaS) with PostgreSQL
- **Notifications**: Sonner for toast notifications
- **AI Integration**: Custom LLM service with mock AI for development

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │   Supabase      │    │   Custom LLM    │
│   (Port 8081)   │◄──►│   (Database)    │◄──►│   (Your Server) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Local Storage │              │
         └──────────────►│   (Test Data)   │◄─────────────┘
                        └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/maddynolan/QAOne.git
   cd QAOne
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:8081
   - The app will automatically initialize with sample data

## 📁 Project Structure

```
QAOne/
├── src/                    # Source code
│   ├── components/        # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── Layout.tsx     # Main layout component
│   │   └── AppSidebar.tsx # Sidebar navigation
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx  # Main dashboard
│   │   ├── TestCases.tsx  # Test case management
│   │   ├── CreateTestCase.tsx # AI-powered test creation
│   │   ├── Triage.tsx     # AI-powered defect analysis
│   │   └── Settings.tsx   # Configuration
│   ├── lib/               # Utility libraries
│   │   ├── custom-llm-service.ts # AI service integration
│   │   ├── mock-ai-service.ts    # Mock AI for development
│   │   └── data-storage.ts       # Local data persistence
│   ├── integrations/      # External service integrations
│   │   └── supabase/      # Supabase client & types
│   ├── App.tsx            # Root component with routing
│   └── main.tsx           # Application entry point
├── public/                 # Static assets
├── package.json           # Project dependencies
└── README.md              # This file
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

## 🤖 AI Features

### Test Case Generation
- **Input**: Feature description, test type, complexity level
- **Output**: Complete test case with steps, preconditions, priority, and tags
- **Variety**: Different templates for API, UI, E2E, and Performance tests
- **Context-Aware**: Smart naming and step generation based on feature content

### Defect Analysis
- **Input**: Error message, test context, environment details
- **Output**: Root cause analysis, suggested fixes, investigation steps
- **Confidence Scoring**: AI confidence levels for analysis accuracy
- **Similar Issues**: Identification of related problems

### Mock AI Service
- **Development Ready**: Works immediately without custom LLM setup
- **Realistic Responses**: Professional test cases and analysis
- **Configurable**: Adjustable delay and success rates
- **Easy Migration**: Seamless switch to real AI when ready

## 🔄 Development Workflow

### Using Mock AI (Default)
The platform comes with a fully functional mock AI service that generates realistic test cases and defect analysis. No setup required!

### Switching to Real AI
When your custom LLM is ready:

1. **Configure Environment Variables**:
   ```bash
   VITE_LLM_ENDPOINT=http://your-llm-server:port/api/v1/generate
   VITE_LLM_API_KEY=your-actual-api-key
   ```

2. **Restart the Application**:
   ```bash
   npm run dev
   ```

3. **The app automatically switches to real AI!** 🎉

## 📊 Data Management

### Local Storage
- **Test Cases**: Complete test case data with steps and metadata
- **Test Plans**: Organized test suites and execution strategies
- **Test Runs**: Execution history and results
- **Defects**: Bug tracking with AI analysis

### Sample Data
The platform initializes with realistic sample data:
- Pre-built test cases for common scenarios
- Sample test runs with different statuses
- Example defect reports with AI analysis

## 🚀 Usage

### Creating AI-Powered Test Cases

1. Navigate to **Test Cases** → **Create Test Case**
2. Enter a description like: "User login with valid credentials"
3. Click **"Generate Test Case with AI"** ✨
4. Watch as AI generates complete test case with steps, preconditions, and priority!
5. Click **"Create Test Case"** to save

### AI-Powered Defect Analysis

1. Go to **Triage** page
2. Click **"Analyze with AI"** on any issue
3. See AI provide root cause analysis, suggested fixes, and investigation steps!

### Managing Test Cases

1. View all test cases in **Test Cases** page
2. Search and filter by name, description, or tags
3. Edit, run, or delete test cases
4. View detailed test case information

## 🔧 Configuration

### AI Service Settings
Access **Settings** → **AI Service Configuration** to:
- Test AI connection
- Switch between mock and real AI
- Adjust mock AI parameters
- View service status

### Environment Variables

Create a `.env` file for custom configuration:

```env
# Custom LLM Configuration (for production)
VITE_LLM_ENDPOINT=http://your-llm-server:port/api/v1/generate
VITE_LLM_API_KEY=your-custom-llm-api-key
VITE_LLM_MODEL=qa-ai-model
VITE_LLM_TEMPERATURE=0.7
VITE_LLM_MAX_TOKENS=2000

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 🧪 Testing

### Running Tests

```bash
# Frontend tests
npm test

# E2E tests
npm run test:e2e
```

### Test Coverage

```bash
# Frontend coverage
npm run test:coverage
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Deploy automatically on every push
3. Environment variables configured in Vercel dashboard

### Netlify

1. Connect your GitHub repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`

### Self-Hosting

```bash
# Build the project
npm run build

# The dist/ folder contains production-ready files
# Deploy the dist/ folder to your hosting provider
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing component patterns
- Write comprehensive tests for new features
- Update documentation for API changes
- Follow conventional commit messages

## 🔮 Roadmap

### Upcoming Features

- [ ] **Real Custom LLM Integration**: Connect to your custom AI infrastructure
- [ ] **Multi-tenant Support**: Organization and team management
- [ ] **Advanced Analytics**: Machine learning-based insights
- [ ] **Integration Hub**: Third-party tool integrations
- [ ] **Mobile App**: React Native mobile application
- [ ] **Advanced Reporting**: Custom dashboard creation
- [ ] **Test Data Management**: Synthetic data generation
- [ ] **Performance Testing**: Load testing capabilities

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- React team for the excellent frontend framework
- Vite team for the fast build tool
- shadcn/ui team for the beautiful component library
- Supabase team for the backend-as-a-service platform
- All open-source contributors

## 📞 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation at `/docs`
- Review the troubleshooting section above

---

**Built with ❤️ for the QA community**

## 🎯 Key Differentiators

- **AI-First Approach**: Built from the ground up with AI integration
- **Development Ready**: Works immediately with mock AI service
- **Modern Stack**: React 18, TypeScript, Vite, Tailwind CSS
- **Beautiful UI**: Professional design with shadcn/ui components
- **Realistic Data**: Comprehensive sample data and realistic AI responses
- **Easy Migration**: Seamless transition from mock to real AI