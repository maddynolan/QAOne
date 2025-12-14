import { Plus, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { dataStorageService, Defect } from "@/lib/data-storage";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "blocker": return "destructive";
    case "critical": return "destructive";
    case "major": return "default";
    case "minor": return "secondary";
    default: return "outline";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "open": return "destructive";
    case "in-progress": return "default";
    case "fixed": return "secondary";
    case "retest": return "default";
    case "verified": return "outline";
    case "closed": return "outline";
    default: return "outline";
  }
};

export default function Defects() {
  const navigate = useNavigate();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDefects();
  }, []);

  const loadDefects = async () => {
    try {
      setLoading(true);
      let allDefects: Defect[] = [];
      
      // Load from localStorage first (most recent)
      const localDefects = JSON.parse(localStorage.getItem('defects') || '[]');
      allDefects = [...localDefects];
      
      // Try API to merge
      try {
        const response = await fetch(`${API_BASE_URL}/defects`);
        if (response.ok) {
          const data = await response.json();
          const apiDefects = (data.defects || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            description: d.description,
            severity: d.severity || d.priority || "medium",
            status: d.status || "open",
            priority: d.priority || d.severity || "medium",
            createdAt: d.createdAt || d.created_at,
            updatedAt: d.updatedAt || d.updated_at,
            defectType: d.defect_type,
            pageUrl: d.page_url,
          }));
          
          // Merge: add API defects that aren't in local
          const localIds = new Set(localDefects.map((d: any) => d.id));
          for (const apiDef of apiDefects) {
            if (!localIds.has(apiDef.id)) {
              allDefects.push(apiDef);
            }
          }
        }
      } catch (apiError) {
        console.warn("API fetch failed, using local storage only:", apiError);
      }
      
      // Sort by createdAt descending
      allDefects.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      setDefects(allDefects);
    } catch (error) {
      console.error("Error loading defects:", error);
      toast.error("Failed to load defects");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Defects</h1>
            <p className="text-muted-foreground mt-1">Loading defects...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Defects</h1>
          <p className="text-muted-foreground mt-1">Track and manage bugs and issues</p>
        </div>
        <Button className="gradient-primary" onClick={() => navigate("/defects/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Report Defect
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search defects..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {defects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No defects found. Create your first defect to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {defects.map((defect) => (
            <Card key={defect.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{defect.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {defect.description || "No description"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reported {new Date(defect.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Badge variant={getSeverityColor(defect.severity)}>
                      {defect.severity}
                    </Badge>
                    <Badge variant={getStatusColor(defect.status)}>
                      {defect.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Priority: <span className="font-medium text-foreground">{defect.priority}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/defects/edit/${defect.id}`)}
                    >
                      Edit
                    </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/defects/edit/${defect.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}
    </div>
  );
}
