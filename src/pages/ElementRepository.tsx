import { useState, useEffect } from "react";
import {
  MousePointerClick, Search, Filter, Plus, RefreshCw, 
  Edit2, Trash2, Copy, CheckCircle, XCircle, Eye,
  Layers, Code, Tag, ArrowUpDown, ChevronDown, ChevronRight,
  Zap, Target, History, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface ElementIdentifier {
  type: "testid" | "id" | "name" | "role" | "text" | "css" | "xpath" | "aria-label";
  value: string;
  priority: number;
  successRate: number;
  usageCount: number;
  lastUsed?: string;
  appSpecific?: boolean;
  appType?: string;
}

interface ElementModel {
  id: string;
  name: string;
  elementType: string;
  pageId?: string;
  pageName?: string;
  applicationTyp: string;
  identifiers: ElementIdentifier[];
  visualFingerprint?: string;
  metadata: {
    description?: string;
    tags?: string[];
  };
  stats: {
    totalUsage: number;
    successRate: number;
    healedCount: number;
    lastUsed: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PageGroup {
  pageId: string;
  pageName: string;
  url: string;
  elementCount: number;
  elements: ElementModel[];
}

export default function ElementRepository() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [elements, setElements] = useState<ElementModel[]>([]);
  const [pageGroups, setPageGroups] = useState<PageGroup[]>([]);
  const [selectedElement, setSelectedElement] = useState<ElementModel | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchElements();
  }, [appFilter, typeFilter]);

  const fetchElements = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with real API call
      const mockElements: ElementModel[] = [
        {
          id: "elem-001",
          name: "login_submit_button",
          elementType: "button",
          pageId: "page-001",
          pageName: "Login Page",
          applicationTyp: "generic",
          identifiers: [
            { type: "testid", value: "login-submit", priority: 1, successRate: 100, usageCount: 234 },
            { type: "id", value: "loginBtn", priority: 2, successRate: 98.5, usageCount: 189 },
            { type: "role", value: "button[name='Sign In']", priority: 3, successRate: 95.2, usageCount: 45 },
            { type: "text", value: "Sign In", priority: 4, successRate: 92.1, usageCount: 12 },
            { type: "css", value: ".btn-primary.login-btn", priority: 5, successRate: 88.4, usageCount: 8 },
          ],
          metadata: { description: "Main login form submit button", tags: ["login", "auth", "critical"] },
          stats: { totalUsage: 488, successRate: 97.2, healedCount: 14, lastUsed: "2 hours ago" },
          createdAt: "2024-01-15",
          updatedAt: "2024-12-08"
        },
        {
          id: "elem-002",
          name: "email_input",
          elementType: "input",
          pageId: "page-001",
          pageName: "Login Page",
          applicationTyp: "generic",
          identifiers: [
            { type: "name", value: "email", priority: 1, successRate: 100, usageCount: 567 },
            { type: "id", value: "email-field", priority: 2, successRate: 99.1, usageCount: 234 },
            { type: "aria-label", value: "Email Address", priority: 3, successRate: 96.8, usageCount: 56 },
          ],
          metadata: { description: "Email input field", tags: ["login", "auth", "input"] },
          stats: { totalUsage: 857, successRate: 99.2, healedCount: 7, lastUsed: "1 hour ago" },
          createdAt: "2024-01-15",
          updatedAt: "2024-12-08"
        },
        {
          id: "elem-003",
          name: "add_to_cart_button",
          elementType: "button",
          pageId: "page-002",
          pageName: "Product Detail",
          applicationTyp: "react",
          identifiers: [
            { type: "testid", value: "add-to-cart", priority: 1, successRate: 99.5, usageCount: 1234 },
            { type: "text", value: "Add to Cart", priority: 2, successRate: 94.2, usageCount: 456 },
          ],
          metadata: { description: "Add product to shopping cart", tags: ["ecommerce", "cart", "critical"] },
          stats: { totalUsage: 1690, successRate: 98.1, healedCount: 32, lastUsed: "30 min ago" },
          createdAt: "2024-02-20",
          updatedAt: "2024-12-09"
        },
        {
          id: "elem-004",
          name: "sf_opportunity_name",
          elementType: "input",
          pageId: "page-003",
          pageName: "Opportunity Create",
          applicationTyp: "salesforce",
          identifiers: [
            { type: "css", value: "lightning-input[field-name='Name'] input", priority: 1, successRate: 97.8, usageCount: 89, appSpecific: true, appType: "salesforce" },
            { type: "xpath", value: "//lightning-input[@field-name='Name']//input", priority: 2, successRate: 95.2, usageCount: 34, appSpecific: true, appType: "salesforce" },
          ],
          metadata: { description: "Salesforce Opportunity Name field", tags: ["salesforce", "opportunity", "input"] },
          stats: { totalUsage: 123, successRate: 96.7, healedCount: 4, lastUsed: "5 hours ago" },
          createdAt: "2024-03-10",
          updatedAt: "2024-12-07"
        },
      ];

      setElements(mockElements);

      // Group elements by page
      const groups: { [key: string]: PageGroup } = {};
      mockElements.forEach(elem => {
        const pageId = elem.pageId || "unassigned";
        if (!groups[pageId]) {
          groups[pageId] = {
            pageId,
            pageName: elem.pageName || "Unassigned Elements",
            url: `/page/${pageId}`,
            elementCount: 0,
            elements: []
          };
        }
        groups[pageId].elements.push(elem);
        groups[pageId].elementCount++;
      });
      setPageGroups(Object.values(groups));

    } catch (error) {
      console.error("Failed to fetch elements:", error);
      toast.error("Failed to load element repository");
    } finally {
      setLoading(false);
    }
  };

  const togglePage = (pageId: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedPages(newExpanded);
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return "text-green-600";
    if (rate >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getIdentifierIcon = (type: string) => {
    switch (type) {
      case "testid": return <Target className="h-3 w-3" />;
      case "role": return <Zap className="h-3 w-3" />;
      case "text": return <Tag className="h-3 w-3" />;
      case "css": return <Code className="h-3 w-3" />;
      default: return <Code className="h-3 w-3" />;
    }
  };

  const filteredElements = elements.filter(elem => {
    const matchesSearch = searchQuery === "" || 
      elem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      elem.pageName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesApp = appFilter === "all" || elem.applicationTyp === appFilter;
    const matchesType = typeFilter === "all" || elem.elementType === typeFilter;
    return matchesSearch && matchesApp && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Element Repository</h1>
          <p className="text-muted-foreground mt-1">
            Manage reusable element models with self-healing identifiers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchElements()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Element
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Elements</p>
                <p className="text-2xl font-bold">{elements.length}</p>
              </div>
              <MousePointerClick className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {(elements.reduce((acc, el) => acc + el.stats.successRate, 0) / elements.length).toFixed(1)}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Times Healed</p>
                <p className="text-2xl font-bold text-purple-600">
                  {elements.reduce((acc, el) => acc + el.stats.healedCount, 0)}
                </p>
              </div>
              <Zap className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pages Covered</p>
                <p className="text-2xl font-bold">{pageGroups.length}</p>
              </div>
              <Layers className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search elements..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={appFilter} onValueChange={setAppFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="App Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Apps</SelectItem>
            <SelectItem value="generic">Generic</SelectItem>
            <SelectItem value="salesforce">Salesforce</SelectItem>
            <SelectItem value="react">React</SelectItem>
            <SelectItem value="angular">Angular</SelectItem>
            <SelectItem value="vue">Vue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Element Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="button">Buttons</SelectItem>
            <SelectItem value="input">Inputs</SelectItem>
            <SelectItem value="link">Links</SelectItem>
            <SelectItem value="select">Selects</SelectItem>
            <SelectItem value="checkbox">Checkboxes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Element Groups by Page */}
      <div className="space-y-4">
        {pageGroups.map(group => (
          <Collapsible
            key={group.pageId}
            open={expandedPages.has(group.pageId)}
            onOpenChange={() => togglePage(group.pageId)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedPages.has(group.pageId) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                      <div>
                        <CardTitle className="text-lg">{group.pageName}</CardTitle>
                        <CardDescription>{group.elementCount} elements</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">{group.pageId}</Badge>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Element Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Primary Identifier</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.elements
                        .filter(elem => filteredElements.includes(elem))
                        .map(elem => (
                          <TableRow key={elem.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{elem.name}</span>
                                {elem.stats.healedCount > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Healed {elem.stats.healedCount}x
                                  </Badge>
                                )}
                              </div>
                              {elem.metadata.tags && (
                                <div className="flex gap-1 mt-1">
                                  {elem.metadata.tags.slice(0, 3).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{elem.elementType}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getIdentifierIcon(elem.identifiers[0]?.type)}
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {elem.identifiers[0]?.value?.slice(0, 30)}
                                  {elem.identifiers[0]?.value?.length > 30 && "..."}
                                </code>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                +{elem.identifiers.length - 1} alternatives
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${getSuccessRateColor(elem.stats.successRate)}`}>
                                  {elem.stats.successRate}%
                                </span>
                                <Progress value={elem.stats.successRate} className="w-20 h-2" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{elem.stats.totalUsage.toLocaleString()}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setSelectedElement(elem)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setSelectedElement(elem);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {/* Element Detail Dialog */}
      <Dialog open={!!selectedElement && !editDialogOpen} onOpenChange={() => setSelectedElement(null)}>
        <DialogContent className="max-w-2xl">
          {selectedElement && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedElement.name}</DialogTitle>
                <DialogDescription>
                  {selectedElement.metadata.description || "Element details and identifiers"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{selectedElement.stats.totalUsage}</p>
                    <p className="text-xs text-muted-foreground">Total Usage</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{selectedElement.stats.successRate}%</p>
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{selectedElement.stats.healedCount}</p>
                    <p className="text-xs text-muted-foreground">Times Healed</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{selectedElement.stats.lastUsed}</p>
                    <p className="text-xs text-muted-foreground">Last Used</p>
                  </div>
                </div>

                {/* Identifiers */}
                <div>
                  <h4 className="font-medium mb-3">Identifiers (Priority Order)</h4>
                  <div className="space-y-2">
                    {selectedElement.identifiers.map((id, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium">
                            {id.priority}
                          </span>
                          <Badge variant="outline" className="uppercase text-xs">
                            {id.type}
                          </Badge>
                          <code className="text-sm bg-muted px-2 py-1 rounded max-w-md truncate">
                            {id.value}
                          </code>
                          {id.appSpecific && (
                            <Badge variant="secondary" className="text-xs">
                              {id.appType}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm ${getSuccessRateColor(id.successRate)}`}>
                            {id.successRate}%
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {id.usageCount} uses
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {selectedElement.metadata.tags && selectedElement.metadata.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedElement.metadata.tags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedElement(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setEditDialogOpen(true);
                }}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Element
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setSelectedElement(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Element</DialogTitle>
            <DialogDescription>
              Modify element identifiers and priorities
            </DialogDescription>
          </DialogHeader>
          {selectedElement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Element Name</label>
                  <Input defaultValue={selectedElement.name} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Element Type</label>
                  <Select defaultValue={selectedElement.elementType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="button">Button</SelectItem>
                      <SelectItem value="input">Input</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input defaultValue={selectedElement.metadata.description} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Identifiers</label>
                  <Button variant="outline" size="sm">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Identifier
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedElement.identifiers.map((id, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground cursor-move" />
                      <Select defaultValue={id.type}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="testid">testid</SelectItem>
                          <SelectItem value="id">id</SelectItem>
                          <SelectItem value="name">name</SelectItem>
                          <SelectItem value="role">role</SelectItem>
                          <SelectItem value="text">text</SelectItem>
                          <SelectItem value="css">css</SelectItem>
                          <SelectItem value="xpath">xpath</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input defaultValue={id.value} className="flex-1" />
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Element updated successfully");
              setEditDialogOpen(false);
              setSelectedElement(null);
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

