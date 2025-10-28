import { LayoutDashboard, FileText, Play, AlertCircle, Settings, CheckSquare, Bug } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Test Plans", url: "/plans", icon: FileText },
  { title: "Test Cases", url: "/cases", icon: CheckSquare },
  { title: "Test Runs", url: "/runs", icon: Play },
  { title: "Defects", url: "/defects", icon: Bug },
  { title: "Triage", url: "/triage", icon: AlertCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const getNavClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
      : "hover:bg-secondary";
  };

  return (
    <Sidebar collapsible="icon" className="bg-sidebar border-sidebar-border">
      <SidebarContent className="pt-4 bg-sidebar">
        <div className={`px-4 mb-6 ${collapsed ? "text-center" : ""}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold">
              Q
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg text-sidebar-foreground">QA AI</h2>
                <p className="text-xs text-sidebar-foreground/60">Platform</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground">Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        end 
                        className={
                          isActive
                            ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium !text-white"
                            : "text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground !text-gray-800 dark:!text-gray-200"
                        }
                        style={{
                          color: isActive ? 'white' : 'inherit'
                        }}
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
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
