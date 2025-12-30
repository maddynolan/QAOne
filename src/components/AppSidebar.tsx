import { 
  LayoutDashboard, FileText, Play, AlertCircle, Settings, CheckSquare, Bug, 
  BookOpen, Sparkles, Plug, Code, FileCode, Map, Zap, Scan, BarChart3, 
  TrendingUp, MousePointerClick, GitBranch, Workflow, ChevronDown, ChevronRight, 
  Layers, Users, Calendar, Compass, TestTube, FlaskConical, Database,
  Video, Target, Gauge, Rocket, Wrench, Circle, Cloud
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
      { title: "Test Builder", url: "/builder", icon: Layers, highlight: true, description: "Build & record tests" },
      // Recorder is only shown when running in Electron Desktop
      ...(typeof window !== 'undefined' && (window as any).electronAPI?.isElectron 
        ? [{ title: "Recorder", url: "#recorder", icon: Circle, highlight: true, description: "Record in docked browser", isElectronOnly: true }]
        : []),
      { title: "Elements", url: "/elements", icon: MousePointerClick, description: "Element repository" },
    ],
  },
  
  // ============================================
  // SECTION 3: EXPLORATION & DISCOVERY
  // ============================================
  {
    label: "Exploration",
    items: [
      { title: "Blaze (Auto)", url: "/nexus", icon: Zap, highlight: true, description: "Autonomous testing" },
      { title: "Discovery", url: "/exploration", icon: Compass, description: "Explore app capabilities" },
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
      { title: "Salesforce Tools", url: "/salesforce-tools", icon: Cloud, highlight: true, description: "SF API, Data, Schema" },
      { title: "API Testing", url: "/enhanced-api-testing", icon: Code },
      { title: "Performance & Load", url: "/load-testing", icon: Gauge, description: "Load testing & performance" },
      { title: "Accessibility", url: "/accessibility", icon: Scan },
      { title: "Self-Healing", url: "/self-healing", icon: Wrench, description: "Auto-fix broken selectors" },
      { title: "Gherkin", url: "/gherkin", icon: FileCode },
      { title: "Framework Analyzer", url: "/framework-analyzer", icon: FlaskConical },
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
              src="/aristrace-logo.svg" 
              alt="ArisTrace" 
              className="w-9 h-9 rounded-lg"
            />
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg text-sidebar-foreground tracking-tight">
                  Aris<span className="text-amber-500">Trace</span>
                </h2>
                <p className="text-xs text-sidebar-foreground/60">QA Excellence Platform</p>
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
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1 flex items-center justify-between text-sidebar-foreground/70">
                    <span className="text-xs font-medium uppercase tracking-wider">{group.label}</span>
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
                                  <span className="ml-auto text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded font-medium">REC</span>
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
                                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                  <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-medium uppercase tracking-wider px-2">
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
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sidebar-foreground hover:bg-cyan-100 hover:text-cyan-700 border border-cyan-200 bg-cyan-50/50"
                              >
                                <item.icon className="h-4 w-4 text-cyan-600 fill-cyan-600" />
                                <span>{item.title}</span>
                                <span className="ml-auto text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded font-medium">REC</span>
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
                                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium"
                                  : itemHighlight
                                    ? "text-sidebar-foreground hover:bg-amber-100 hover:text-amber-700 border border-amber-200 bg-amber-50/50"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                            >
                              <item.icon className={`h-4 w-4 ${itemHighlight && !isActive ? 'text-amber-600' : ''}`} />
                              <span>{item.title}</span>
                              {itemHighlight && !isActive && (
                                <span className="ml-auto text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-medium">★</span>
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
