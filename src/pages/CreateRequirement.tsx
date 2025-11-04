import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function CreateRequirement() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(isEditMode);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    source: "manual",
    source_ref: ""
  });

  // Load requirement data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      setLoading(true);
      fetch(`http://localhost:8000/requirements/${id}`)
        .then(response => {
          if (!response.ok) {
            throw new Error("Failed to load requirement");
          }
          return response.json();
        })
        .then(requirement => {
          setFormData({
            title: requirement.title || "",
            description: requirement.description || "",
            source: requirement.source || "manual",
            source_ref: requirement.source_ref || ""
          });
          setLoading(false);
        })
        .catch((error) => {
          console.error("Error loading requirement:", error);
          toast.error("Failed to load requirement");
          setLoading(false);
          navigate("/requirements");
        });
    } else {
      setLoading(false);
    }
  }, [id, isEditMode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      const url = isEditMode 
        ? `http://localhost:8000/requirements/${id}`
        : `http://localhost:8000/requirements`;
      
      const method = isEditMode ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save requirement");
      }

      const result = await response.json();
      toast.success(isEditMode ? "Requirement updated successfully!" : "Requirement created successfully!");
      navigate("/requirements");
    } catch (error: any) {
      console.error("Error saving requirement:", error);
      toast.error(`Failed to save requirement: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/requirements")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requirements
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground">Loading requirement...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/requirements")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Requirements
        </Button>
        <div>
          <h1 className="text-3xl font-bold gradient-text">
            {isEditMode ? "Edit Requirement" : "Create Requirement"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode ? "Update requirement details" : "Add a new requirement to your project"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Requirement Details</CardTitle>
            <CardDescription>
              {isEditMode 
                ? "Update the requirement information below"
                : "Fill in the details for your new requirement"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., User Login Functionality"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the requirement in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="jira">Jira</SelectItem>
                    <SelectItem value="confluence">Confluence</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source_ref">Source Reference</Label>
                <Input
                  id="source_ref"
                  placeholder="e.g., REQ-123, STORY-456"
                  value={formData.source_ref}
                  onChange={(e) => setFormData({ ...formData, source_ref: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/requirements")}
              >
                Cancel
              </Button>
              <Button type="submit" className="gradient-primary">
                {isEditMode ? "Update Requirement" : "Create Requirement"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

