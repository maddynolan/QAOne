import { Plus, Search, Filter, FileText, ExternalLink, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Requirement {
  id: string;
  title: string;
  description: string;
  source: string;
  source_ref: string;
  created_at: string;
}

export default function Requirements() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/requirements");
      if (!response.ok) {
        throw new Error("Failed to load requirements");
      }
      const data = await response.json();
      setRequirements(data.requirements || []);
    } catch (error: any) {
      console.error("Error loading requirements:", error);
      toast.error("Failed to load requirements");
    } finally {
      setLoading(false);
    }
  };

  const getSourceColor = (source: string) => {
    const sourceLower = source.toLowerCase();
    if (sourceLower.includes("api")) return "default";
    if (sourceLower.includes("eco") || sourceLower.includes("commerce")) return "secondary";
    if (sourceLower.includes("bank")) return "destructive";
    if (sourceLower.includes("todo")) return "outline";
    return "default";
  };

  const filteredRequirements = requirements.filter((req) =>
    req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.source_ref.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Requirements</h1>
            <p className="text-muted-foreground mt-1">Loading requirements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Requirements</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your requirements ({requirements.length} total)
          </p>
        </div>
        <Button className="gradient-primary" onClick={() => navigate("/requirements/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Requirement
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requirements..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {filteredRequirements.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Requirements Found</h3>
          <p className="text-muted-foreground">
            {searchTerm
              ? "No requirements match your search criteria."
              : "No requirements found. Requirements will appear here once created."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRequirements.map((requirement) => (
            <Card key={requirement.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-xl">{requirement.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getSourceColor(requirement.source)}>
                        {requirement.source}
                      </Badge>
                      <Badge variant="outline">{requirement.source_ref}</Badge>
                      {requirement.created_at && (
                        <span className="text-sm text-muted-foreground">
                          Created {new Date(requirement.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {requirement.description}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/requirements/edit/${requirement.id}`)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/traceability?requirement=${requirement.id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Traceability
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

