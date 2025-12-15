import { Plus, Edit, Trash2, RefreshCw, Loader2, Play, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface TestCase {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  status?: string;
  priority?: string;
  steps?: any[];
  tags?: string[];
  createdAt?: string;
}

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case "critical": return "destructive";
    case "high": return "default";
    case "medium": return "secondary";
    default: return "outline";
  }
};

export default function TestCases() {
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Simple load function - no complex service
  const loadTestCases = async () => {
    setLoading(true);
    const allCases: TestCase[] = [];
    
    try {
      // Load from localStorage first (instant)
      const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
      allCases.push(...local);
      
      // Try backend (with timeout)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      try {
        const response = await fetch(`${API_BASE_URL}/test-cases`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (response.ok) {
          const data = await response.json();
          // Handle different response formats: {value: [...]} or {test_cases: [...]} or [...]
          const backendCases = Array.isArray(data) ? data : (data.value || data.test_cases || []);
          // Merge, avoiding duplicates by ID
          backendCases.forEach((tc: TestCase) => {
            if (!allCases.some(c => c.id === tc.id)) {
              // Use title as fallback for name
              allCases.push({
                ...tc,
                name: tc.name || tc.title || `Test Case ${tc.id?.slice(0, 8) || 'Unknown'}`
              });
            }
          });
        }
      } catch (e) {
        console.log('Backend timeout/error, using local only');
      }
      
      setTestCases(allCases);
    } catch (error) {
      console.error('Error loading test cases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestCases();
  }, []);

  // Filter by search
  const filteredCases = testCases.filter(tc => 
    !searchTerm || 
    tc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test case?')) return;
    
    // Remove from local state immediately
    setTestCases(prev => prev.filter(tc => tc.id !== id));
    
    // Remove from localStorage
    const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
    localStorage.setItem('test_cases', JSON.stringify(local.filter((tc: any) => tc.id !== id)));
    
    // Try backend (fire and forget)
    fetch(`${API_BASE_URL}/test-cases/${id}`, { method: 'DELETE' }).catch(() => {});
    
    toast.success('Test case deleted');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Cases</h1>
          <p className="text-muted-foreground">{testCases.length} test cases</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTestCases} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/cases/create')}>
            <Plus className="h-4 w-4 mr-2" />
            New Test Case
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search test cases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading test cases...</span>
        </div>
      ) : filteredCases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No test cases found</p>
            <Button onClick={() => navigate('/cases/create')} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Test Case
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.map((tc) => (
                <TableRow key={tc.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{tc.name || 'Untitled'}</div>
                      {tc.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {tc.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tc.type || tc.category || 'manual'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityColor(tc.priority)}>
                      {tc.priority || 'medium'}
                    </Badge>
                  </TableCell>
                  <TableCell>{tc.steps?.length || 0}</TableCell>
                  <TableCell>
                    <Badge variant={tc.status === 'active' ? 'default' : 'secondary'}>
                      {tc.status || 'draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/cases/edit/${tc.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(tc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
