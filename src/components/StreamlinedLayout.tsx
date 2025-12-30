/**
 * StreamlinedLayout - Clean, modern tab-based navigation
 * 
 * Design Philosophy:
 * - Single header with unified branding
 * - 5 core modules via tabs
 * - Consistent amber/orange accent
 * - Dark theme optimized for long sessions
 * - No nested menus or sidebars
 */

import React from 'react';
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isElectron } from '@/lib/electron-bridge';
import {
  Video,
  FileText,
  Globe,
  Gauge,
  Cloud,
  Settings,
  Bell,
  User,
  Zap,
  ChevronDown,
  MoreHorizontal,
  LayoutDashboard,
  BarChart3,
  GitBranch,
  Link2,
  List,
  Bug,
  FileCheck,
  Calendar,
  Wrench,
  Box,
  RefreshCw,
  Pencil,
  FolderTree,
  Play,
  Kanban,
  Plug,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  description?: string;
}

// Workflow: Record → Build → Tests (with Runs inside)
const mainNavItems: NavItem[] = [
  {
    id: 'recorder',
    label: 'Record',
    path: '/recorder',
    icon: Video,
    description: 'Capture browser interactions',
  },
  {
    id: 'builder',
    label: 'Build',
    path: '/test-cases/builder',
    icon: Pencil,
    description: 'Create & edit test cases',
  },
  {
    id: 'tests',
    label: 'Tests',
    path: '/test-cases',
    icon: FolderTree,
    description: 'Repository, Suites, Plans, Runs',
  },
  {
    id: 'api',
    label: 'API',
    path: '/api',
    icon: Globe,
    description: 'API testing',
  },
  {
    id: 'performance',
    label: 'Perf',
    path: '/performance',
    icon: Gauge,
    description: 'Load testing',
  },
  {
    id: 'accessibility',
    label: 'A11y',
    path: '/accessibility',
    icon: Eye,
    description: 'Accessibility testing',
  },
  {
    id: 'salesforce',
    label: 'SF',
    path: '/salesforce',
    icon: Cloud,
    description: 'Salesforce tools',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// LOGO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function FlowstralLogo() {
  return (
    <div className="flex items-center gap-2">
      {/* Logo icon */}
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg shadow-lg shadow-amber-500/30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
      </div>
      {/* Logo text */}
      <span className="text-lg font-bold tracking-tight">
        <span className="text-white">Flow</span>
        <span className="text-amber-500">stral</span>
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface TabButtonProps {
  item: NavItem;
  isActive: boolean;
}

function TabButton({ item, isActive }: TabButtonProps) {
  const Icon = item.icon;
  
  return (
    <NavLink
      to={item.path}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        isActive 
          ? "bg-amber-500/15 text-amber-400" 
          : "text-gray-400 hover:text-white hover:bg-gray-800/50"
      )}
    >
      <Icon className={cn(
        "w-4 h-4",
        isActive ? "text-amber-500" : ""
      )} />
      <span>{item.label}</span>
      {/* Active indicator */}
      {isActive && (
        <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" />
      )}
    </NavLink>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const inElectron = isElectron();

  // Web-only features menu items
  const webFeatures = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Project Boards', path: '/projects', icon: Kanban },
    { divider: true },
    { label: 'Test Suites', path: '/suites', icon: List },
    { label: 'Test Plans', path: '/plans', icon: FileCheck },
    { label: 'Test Runs', path: '/runs', icon: RefreshCw },
    { divider: true },
    { label: 'Requirements', path: '/requirements', icon: FileText },
    { label: 'Traceability', path: '/traceability', icon: Link2 },
    { label: 'Defects', path: '/defects', icon: Bug },
    { divider: true },
    { label: 'Framework Analyzer', path: '/framework-analyzer', icon: Wrench },
    { label: 'Element Repository', path: '/elements', icon: Box },
    { label: 'Scheduled Runs', path: '/scheduled-runs', icon: Calendar },
    { label: 'CI/CD', path: '/cicd', icon: GitBranch },
    { divider: true },
    { label: 'Integrations', path: '/integrations', icon: Plug },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <header className="h-14 bg-gray-950 border-b border-gray-800/80 px-4 flex items-center justify-between sticky top-0 z-50">
      {/* Left: Logo + Navigation */}
      <div className="flex items-center gap-6">
        <FlowstralLogo />
        
        {/* Divider */}
        <div className="h-6 w-px bg-gray-800" />
        
        {/* Main Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {mainNavItems.map(item => {
            // Smart path matching - builder should NOT match when on test-cases main page
            let isActive = false;
            if (item.id === 'builder') {
              // Builder is active only when on /test-cases/builder routes
              isActive = currentPath.includes('/builder');
            } else if (item.id === 'tests') {
              // Tests is active when on /test-cases but NOT /builder
              isActive = currentPath.startsWith('/test-cases') && !currentPath.includes('/builder');
            } else {
              isActive = currentPath.startsWith(item.path);
            }
            
            return (
              <TabButton
                key={item.id}
                item={item}
                isActive={isActive}
              />
            );
          })}
          
          {/* More Dropdown - Web Only */}
          {!inElectron && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  "text-gray-400 hover:text-white hover:bg-gray-800/50"
                )}>
                  <MoreHorizontal className="w-4 h-4" />
                  <span>More</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-gray-900 border-gray-800 max-h-[70vh] overflow-y-auto">
                <DropdownMenuLabel className="text-gray-500 text-xs">Additional Features</DropdownMenuLabel>
                {webFeatures.map((item, idx) => 
                  item.divider ? (
                    <DropdownMenuSeparator key={idx} className="bg-gray-800" />
                  ) : (
                    <DropdownMenuItem 
                      key={item.path}
                      className={cn(
                        "cursor-pointer",
                        currentPath === item.path 
                          ? "bg-amber-500/10 text-amber-400" 
                          : "text-gray-300 focus:bg-gray-800 focus:text-white"
                      )}
                      onClick={() => navigate(item.path!)}
                    >
                      {item.icon && <item.icon className="w-4 h-4 mr-2" />}
                      {item.label}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
      
      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
        </Button>
        
        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={() => navigate('/settings')}
        >
          <Settings className="w-4 h-4" />
        </Button>
        
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-9 text-gray-400 hover:text-white hover:bg-gray-800 px-2 ml-1"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-gray-900 border-gray-800">
            <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-gray-300 focus:bg-gray-800 focus:text-white cursor-pointer"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem className="text-red-400 focus:bg-red-900/20 focus:text-red-400 cursor-pointer">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export function StreamlinedLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden">
        {children || <Outlet />}
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default StreamlinedLayout;
