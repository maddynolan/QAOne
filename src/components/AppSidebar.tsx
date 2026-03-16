import {
  LayoutDashboard, FileText, Play, AlertCircle, Settings, CheckSquare, Bug,
  BookOpen, Sparkles, Plug, Code, FileCode, Zap, Scan, BarChart3, Activity,
  TrendingUp, MousePointerClick, GitBranch, Workflow, ChevronDown, ChevronRight,
  Layers, Users, Calendar, Compass, TestTube, FlaskConical, Database, Shield, Map,
  Video, Target, Gauge, Rocket, Wrench, Circle, Cloud, ClipboardList,
  Smartphone, Eye
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { isElectron, showRecorder } from "@/lib/electron-bridge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Navigation Structure - Organized by QA Workflow
 * 
 * Flow: Overview → Create Tests → Run Tests → Analyze → Tools → Configure
 */
const navigationGroups = [
  // ============================================
  // SECTION 1: OVERVIEW (Always visible, top)
  // ============================================
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Projects", url: "/projects", icon: Layers },
      { title: "Analytics", url: "/analytics", icon: TrendingUp },
    ],
  },
  
  // ============================================
  // SECTION 2: CREATE & BUILD TESTS (Primary actions)
  // ============================================
  {
    label: "Create & Build",
    items: [
      { title: "Test Builder", url: "/builder", icon: Layers, highlight: true, description: "Build & trace tests" },
      // Trace is only shown when running in Electron Desktop
      ...(typeof window !== 'undefined' && (window as any).electronAPI?.isElectron
        ? [{ title: "Smart Trace", url: "#recorder", icon: Circle, highlight: true, description: "Trace actions in browser", isElectronOnly: true }]
        : []),
      { title: "Elements", url: "/elements", icon: MousePointerClick, description: "Element repository" },
    ],
  },
  
  // ============================================
  // SECTION 3: AI & EXPLORATION
  // ============================================
  {
    label: "AI & Exploration",
    items: [
      { title: "Flowpilot", url: "/flowpilot", icon: Sparkles, highlight: true, description: "AI-powered testing agents" },
      { title: "Blaze Explorer", url: "/flowpilot/explorer", icon: Zap, description: "Autonomous app crawling" },
      { title: "Flowmap", url: "/flowpilot/flowmap", icon: Map, description: "App capability mapping" },
    ],
  },
  
  // ============================================
  // SECTION 4: TEST EXECUTION
  // ============================================
  {
    label: "Execute",
    collapsible: true,
    defaultOpen: true,
    items: [
      { title: "Test Execution", url: "/execution", icon: Rocket, highlight: true, description: "Releases, Plans, Run Tests" },
      { title: "Results Dashboard", url: "/results-dashboard", icon: BarChart3, description: "Test analytics & self-healing" },
      { title: "Test Cases", url: "/cases", icon: CheckSquare },
    ],
  },
  
  // ============================================
  // SECTION 5: QUALITY & ANALYSIS
  // ============================================
  {
    label: "Quality",
    collapsible: true,
    defaultOpen: true,
    items: [
      { title: "Traceability", url: "/traceability", icon: GitBranch, highlight: true, description: "Full coverage matrix" },
      { title: "Requirements", url: "/requirements", icon: BookOpen },
      { title: "Defects", url: "/defects", icon: Bug },
    ],
  },
  
  // ============================================
  // SECTION 6: SPECIALIZED TOOLS
  // ============================================
  {
    label: "Tools",
    collapsible: true,
    defaultOpen: false,
    items: [
      { title: "API Testing", url: "/api", icon: Code, highlight: true, description: "Multi-protocol API testing" },
      { title: "Performance", url: "/performance", icon: Gauge, description: "Load testing & virtual users" },
      { title: "Visual Testing", url: "/visual-testing", icon: Eye, description: "Visual regression testing" },
      { title: "Accessibility", url: "/accessibility", icon: Scan, description: "WCAG compliance scanning" },
      { title: "Mobile Testing", url: "/mobile", icon: Smartphone, description: "iOS & Android via Maestro" },
      { title: "Salesforce", url: "/salesforce", icon: Cloud, description: "SF API, Data, Schema" },
      { title: "Self-Healing", url: "/self-healing", icon: Wrench, description: "Auto-fix broken selectors" },
      { title: "CodeAlchemy", url: "/code-alchemy", icon: Sparkles, description: "Import repos as test cases" },
    ],
  },
  
  // ============================================
  // SECTION 7: CONFIGURATION (Bottom)
  // ============================================
  {
    label: "Configure",
    collapsible: true,
    defaultOpen: false,
    items: [
      { title: "CI/CD Pipeline", url: "/cicd", icon: GitBranch },
      { title: "Integrations", url: "/integrations", icon: Plug },
      { title: "Secrets Vault", url: "/secrets", icon: Shield },
      { title: "Coverage Map", url: "/coverage", icon: Map },
      { title: "Data Flow", url: "/data-flow", icon: Workflow },
      { title: "Audit Log", url: "/audit-log", icon: ClipboardList, description: "Activity & compliance trail" },
      { title: "APM Config", url: "/apm", icon: Activity },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  
  // Helper to check if an item is active
  const isItemActive = (url: string) => {
    if (url === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(url);
  };

  // Check if any item in a group is active
  const isGroupActive = (group: typeof navigationGroups[0]) => {
    return group.items.some(item => isItemActive(item.url));
  };

  // Initialize open groups based on current route
  const getInitialOpenGroups = useMemo(() => {
    const initial: Record<string, boolean> = {};
    navigationGroups.forEach(group => {
      if (group.collapsible) {
        // Keep group open if any of its items are active, or if defaultOpen is true
        initial[group.label] = isGroupActive(group) || (group as any).defaultOpen;
      }
    });
    return initial;
  }, [location.pathname]);

  // Track which collapsible groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpenGroups);

  // Update open groups when route changes - keep active group open
  useEffect(() => {
    setOpenGroups(prev => {
      const updated = { ...prev };
      navigationGroups.forEach(group => {
        if (group.collapsible && isGroupActive(group)) {
          updated[group.label] = true;
        }
      });
      return updated;
    });
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Sidebar collapsible="icon" className="bg-sidebar border-sidebar-border">
      <SidebarContent className="pt-4 bg-sidebar">
        {/* Logo */}
        <div className={`px-4 mb-4 ${collapsed ? "text-center" : ""}`}>
          <div className="flex items-center gap-2">
            <img
              src="/flowstral-logo.svg"
              alt="Flowstral"
              className="w-9 h-9 rounded-lg"
            />
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
                  Flow<span className="text-indigo-600 dark:text-cyan-400">stral</span>
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">QA Automation Platform</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Groups */}
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            {group.collapsible && !collapsed ? (
              <Collapsible
                open={openGroups[group.label]}
                onOpenChange={() => toggleGroup(group.label)}
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-gray-100 dark:hover:bg-sidebar-accent/50 rounded px-2 py-1 flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                    {openGroups[group.label] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const isActive = isItemActive(item.url);
                        const isElectronOnly = (item as any).isElectronOnly;
                        
                        if (isElectronOnly) {
                          return (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <button
                                  onClick={() => showRecorder()}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sidebar-foreground hover:bg-cyan-100 hover:text-cyan-700 border border-cyan-200 bg-cyan-50/50"
                                >
                                  <item.icon className="h-4 w-4 text-cyan-600 fill-cyan-600" />
                                  <span>{item.title}</span>
                                  <span className="ml-auto text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded font-medium">TRACE</span>
                                </button>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        }
                        
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <NavLink 
                                to={item.url} 
                                end={item.url === '/'} 
                                className={
                                  isActive
                                    ? "bg-blue-600 dark:bg-amber-500 text-white dark:text-gray-900 hover:bg-blue-700 dark:hover:bg-amber-400 font-medium"
                                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                                }
                              >
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <>
                {!collapsed && (
                  <SidebarGroupLabel className="text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider px-2">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = isItemActive(item.url);
                      const itemHighlight = (item as any).highlight;
                      const isElectronOnly = (item as any).isElectronOnly;
                      
                      // Handle Electron-only items (like Recorder)
                      if (isElectronOnly) {
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <button
                                onClick={() => showRecorder()}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-gray-700 dark:text-gray-100 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 hover:text-cyan-700 dark:hover:text-cyan-400 border border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-900/20"
                              >
                                <item.icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400 fill-cyan-600 dark:fill-cyan-400" />
                                <span>{item.title}</span>
                                <span className="ml-auto text-[10px] bg-cyan-600 dark:bg-cyan-500 text-white px-1.5 py-0.5 rounded font-medium">TRACE</span>
                              </button>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      }
                      
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink 
                              to={item.url} 
                              end={item.url === '/'} 
                              className={`${
                                isActive
                                  ? "bg-blue-600 dark:bg-amber-500 text-white dark:text-gray-900 hover:bg-blue-700 dark:hover:bg-amber-400 font-medium"
                                  : itemHighlight
                                    ? "text-gray-800 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-amber-400 border border-blue-200 dark:border-gray-700 bg-blue-50/50 dark:bg-gray-800/50"
                                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                              }`}
                            >
                              <item.icon className={`h-4 w-4 ${itemHighlight && !isActive ? 'text-blue-600 dark:text-amber-500' : ''}`} />
                              <span>{item.title}</span>
                              {itemHighlight && !isActive && (
                                <span className="ml-auto text-[10px] bg-blue-600 dark:bg-amber-500 text-white dark:text-gray-900 px-1.5 py-0.5 rounded font-medium">NEW</span>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
