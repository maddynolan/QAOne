/**
 * @module test-management
 * @page TestPlans
 *
 * Test plan management page for organizing testing efforts. Supports creating,
 * editing, and tracking test plans with associated test suites and milestones.
 *
 * @features
 * - Test plan CRUD operations
 * - Plan-level progress tracking
 * - Test suite association and ordering
 * - Milestone and deadline management
 * - AI-powered plan generation
 *
 * @api /test-plans/* - Test plan management (4 endpoints)
 *
 * @dependencies TestPlans uses react-router-dom, useState, useEffect, lucide-react, sonner toast
 */
import { Plus, Search, Filter, Sparkles, Trash2, RefreshCw, Edit, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL } from "@/lib/api-config";

interface TestPlan {
  id: string;
  name: string;
  description: string;
  suite_ids: string[];
  test_case_ids: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export default function TestPlans() {
  const navigate = useNavigate();
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTestPlans();
  }, []);

  const loadTestPlans = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/db/test-plans?limit=1000`);
      if (response.ok) {
        const data = await response.json();
        setTestPlans(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to load test plans:', response.statusText);
        setTestPlans([]);
      }
    } catch (error) {
      console.error('Error loading test plans:', error);
      toast.error('Failed to load test plans');
      setTestPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createTestPlan = async () => {
    if (!newPlanName.trim()) {
      toast.error("Plan name is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/db/test-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlanName.trim(),
          description: newPlanDescription.trim(),
          status: 'draft',
        })
      });

      if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
      
      toast.success('Test plan created!');
      setShowCreateDialog(false);
      setNewPlanName("");
      setNewPlanDescription("");
      await loadTestPlans();
    } catch (error: any) {
      toast.error(`Failed to create plan: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteTestPlan = async (planId: string) => {
    if (!confirm('Delete this test plan?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/db/test-plans/${planId}`, { method: 'DELETE' });
      setTestPlans(prev => prev.filter(p => p.id !== planId));
      toast.success('Test plan deleted');
    } catch {
      toast.error('Failed to delete test plan');
    }
  };

  const filteredPlans = testPlans.filter(plan => 
    !searchTerm || plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (plan.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Plans</h1>
          <p className="text-muted-foreground mt-1">Manage and organize your test plans - shared across all team members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTestPlans} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gradient-primary" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search test plans..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading test plans...</div>
      ) : filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Test Plans</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first test plan to organize test execution
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPlans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.test_case_ids?.length || 0} test cases
                      {plan.suite_ids?.length ? ` | ${plan.suite_ids.length} suites` : ''}
                      {plan.created_at && ` | Created ${new Date(plan.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                    {plan.status || "draft"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/plans/edit/${plan.id}`)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate("/runs")}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run Tests
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTestPlan(plan.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Test Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Plan Name *</Label>
              <Input
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="e.g., Sprint 24 Regression Plan"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newPlanDescription}
                onChange={(e) => setNewPlanDescription(e.target.value)}
                placeholder="What does this plan cover?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createTestPlan} disabled={saving}>
              {saving ? "Creating..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
