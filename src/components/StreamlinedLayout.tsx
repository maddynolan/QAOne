/**
 * StreamlinedLayout - Enterprise Navigation
 * 
 * Design Philosophy:
 * - Clean, professional enterprise styling
 * - Light theme default (like Katalon, OpenText, Provar)
 * - Dark theme option (original Flowstral)
 * - Minimal icons in navigation
 * - Consistent with enterprise QA tools
 */

import React from 'react';
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isElectron } from '@/lib/electron-bridge';
import { useTheme } from '@/contexts/ThemeContext';
import { AIBadge } from '@/contexts/AIContext';
import { useLandingPlugins, LandingPluginsProvider, type PluginKey } from '@/contexts/LandingPluginsContext';
import {
  Settings,
  Bell,
  User,
  ChevronDown,
  LayoutDashboard,
  BarChart3,
  Plug,
  Sun,
  Moon,
  Shield,
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
  description?: string;
  plugin?: PluginKey; // If set, tab is only shown when this plugin is licensed and enabled
}

// Workflow: Record → Build → Tests (with Runs inside) - NO ICONS in nav
// Tabs with `plugin` property are shown/hidden based on license
const mainNavItems: NavItem[] = [
  {
    id: 'recorder',
    label: 'Record',
    path: '/recorder',
    description: 'Capture browser interactions',
  },
  {
    id: 'builder',
    label: 'Build',
    path: '/test-cases/builder',
    description: 'Create & edit test cases',
  },
  {
    id: 'tests',
    label: 'Tests',
    path: '/test-cases',
    description: 'Repository, Suites, Plans, Runs',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    path: '/mobile',
    description: 'Mobile device testing',
    plugin: 'mobile', // License-controlled
  },
  {
    id: 'api',
    label: 'API',
    path: '/api',
    description: 'API testing',
    plugin: 'api', // License-controlled
  },
  {
    id: 'performance',
    label: 'Perf',
    path: '/performance',
    description: 'Load testing',
    plugin: 'perf', // License-controlled
  },
  {
    id: 'accessibility',
    label: 'A11y',
    path: '/accessibility',
    description: 'Accessibility testing',
    plugin: 'a11y', // License-controlled
  },
  {
    id: 'visual-testing',
    label: 'Visual',
    path: '/visual-testing',
    description: 'Visual regression testing',
  },
  {
    id: 'code-alchemy',
    label: 'Alchemy',
    path: '/code-alchemy',
    description: 'Import repos as test cases',
  },
  {
    id: 'salesforce',
    label: 'SF',
    path: '/salesforce',
    description: 'Salesforce tools',
  },
  {
    id: 'flowpilot',
    label: 'Flowpilot',
    path: '/flowpilot',
    description: 'Goal-based AI testing',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// LOGO COMPONENT - Adapts to theme
// ═══════════════════════════════════════════════════════════════════════════

function FlowstralLogo() {
  const { theme } = useTheme();
  
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      {/* Logo icon - Blue in light, Orange in dark */}
      <div className={cn(
        "relative w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm",
        theme === 'light' 
          ? "bg-gradient-to-br from-blue-500 to-blue-700" 
          : "bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/30"
      )}>
        F
      </div>
      {/* Logo text */}
      <span className="text-lg font-semibold tracking-tight">
        <span className={theme === 'light' ? 'text-gray-900' : 'text-white'}>Flow</span>
        <span className={theme === 'light' ? 'text-blue-600' : 'text-amber-500'}>stral</span>
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB BUTTON COMPONENT - Clean text-only nav (enterprise style)
// ═══════════════════════════════════════════════════════════════════════════

interface TabButtonProps {
  item: NavItem;
  isActive: boolean;
}

function TabButton({ item, isActive }: TabButtonProps) {
  const { theme } = useTheme();
  
  return (
    <NavLink
      to={item.path}
      className={cn(
        "relative px-3 py-2 text-sm font-medium transition-all duration-200 rounded-md whitespace-nowrap",
        // Light mode
        theme === 'light' && (
          isActive 
            ? "text-blue-700 bg-blue-50" 
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        ),
        // Dark mode
        theme === 'dark' && (
          isActive 
            ? "text-amber-400 bg-amber-500/10" 
            : "text-gray-400 hover:text-white hover:bg-gray-800/50"
        )
      )}
    >
      {item.label}
      {/* Active indicator line */}
      {isActive && (
        <div className={cn(
          "absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full",
          theme === 'light' ? "bg-blue-600" : "bg-gradient-to-r from-amber-400 to-orange-500"
        )} />
      )}
    </NavLink>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME TOGGLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "h-9 w-9",
        theme === 'light' 
          ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900" 
          : "text-gray-400 hover:bg-gray-800 hover:text-white"
      )}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER COMPONENT - Enterprise style
// ═══════════════════════════════════════════════════════════════════════════

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAvailable } = useLandingPlugins();
  const currentPath = location.pathname;
  const inElectron = isElectron();
  
  // Filter nav items based on license - only show tabs user has access to
  const visibleNavItems = mainNavItems.filter(item => 
    !item.plugin || isAvailable(item.plugin)
  );

  // Simplified menu - only core features from landing page
  const coreFeatures = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { divider: true },
    { label: 'Secrets Vault', path: '/secrets', icon: Shield },
    { label: 'Integrations', path: '/integrations', icon: Plug },
    { divider: true },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <header className={cn(
      "h-14 min-h-[56px] shrink-0 border-b px-4 flex items-center justify-between sticky top-0 z-50",
      theme === 'light' 
        ? "bg-white border-gray-200 shadow-sm" 
        : "bg-gray-950 border-gray-800/80"
    )}>
      {/* Left: Logo + Navigation */}
      <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
        <FlowstralLogo />
        
        {/* Divider */}
        <div className={cn(
          "h-6 w-px shrink-0",
          theme === 'light' ? "bg-gray-200" : "bg-gray-800"
        )} />
        
        {/* Main Navigation Tabs - Clean text only, filtered by license */}
        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {visibleNavItems.map(item => {
            // Smart path matching
            let isActive = false;
            if (item.id === 'builder') {
              isActive = currentPath.includes('/builder');
            } else if (item.id === 'tests') {
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
          
          {/* More Dropdown - Available in both Web and Desktop */}
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  theme === 'light'
                    ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                )}>
                  More
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {coreFeatures.map((item, idx) => 
                  item.divider ? (
                    <DropdownMenuSeparator key={idx} />
                  ) : (
                    <DropdownMenuItem 
                      key={item.path}
                      className={cn(
                        "cursor-pointer",
                        currentPath === item.path && (
                          theme === 'light'
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-500/10 text-amber-400"
                        )
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
        </nav>
      </div>
      
      {/* Right: Actions */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {/* Theme Toggle */}
        <ThemeToggle />
        
        {/* AI Status Badge */}
        <AIBadge className="mr-2" />
        
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9",
            theme === 'light'
              ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <Bell className="w-4 h-4" />
          <span className={cn(
            "absolute top-1.5 right-1.5 w-2 h-2 rounded-full",
            theme === 'light' ? "bg-blue-600" : "bg-amber-500"
          )} />
        </Button>
        
        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9",
            theme === 'light'
              ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
          onClick={() => navigate('/settings')}
        >
          <Settings className="w-4 h-4" />
        </Button>
        
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-2 h-9 px-2 ml-1",
                theme === 'light'
                  ? "text-gray-600 hover:bg-gray-100"
                  : "text-gray-400 hover:bg-gray-800"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center",
                theme === 'light'
                  ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white"
                  : "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
              )}>
                <User className="w-3.5 h-3.5" />
              </div>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="cursor-pointer"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-400">
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

function StreamlinedLayoutContent({ children }: { children?: React.ReactNode }) {
  const { theme } = useTheme();
  
  return (
    <div className={cn(
      "h-screen flex flex-col overflow-hidden",
      theme === 'light' 
        ? "bg-gray-50 text-gray-900" 
        : "bg-gray-950 text-white"
    )}>
      <Header />
      <main className="flex-1 overflow-auto">
        {children || <Outlet />}
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export function StreamlinedLayout({ children }: { children?: React.ReactNode }) {
  return (
    <LandingPluginsProvider>
      <StreamlinedLayoutContent>{children}</StreamlinedLayoutContent>
    </LandingPluginsProvider>
  );
}

export default StreamlinedLayout;
