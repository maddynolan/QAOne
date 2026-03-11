/**
 * CreateDefectForm - Form for creating/editing defects
 *
 * Provides fields for title, description, severity, priority, status,
 * type, environment, component, versions, steps to reproduce,
 * expected/actual results, linked test cases, and tags.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Defect, TestRun } from '../types/test-repository.types';

interface CreateDefectFormProps {
  testCases: any[];
  testRuns: TestRun[];
  initialDefect?: Defect;
  onSubmit: (defect: Defect) => void;
  onCancel: () => void;
}

export function CreateDefectForm({
  testCases,
  testRuns,
  initialDefect,
  onSubmit,
  onCancel
}: CreateDefectFormProps) {
  const [title, setTitle] = useState(initialDefect?.title || '');
  const [description, setDescription] = useState(initialDefect?.description || '');
  const [severity, setSeverity] = useState<Defect['severity']>(initialDefect?.severity || 'major');
  const [priority, setPriority] = useState<Defect['priority']>(initialDefect?.priority || 'medium');
  const [status, setStatus] = useState<Defect['status']>(initialDefect?.status || 'new');
  const [type, setType] = useState<Defect['type']>(initialDefect?.type || 'bug');
  const [environment, setEnvironment] = useState(initialDefect?.environment || '');
  const [stepsToReproduce, setStepsToReproduce] = useState(initialDefect?.stepsToReproduce || '');
  const [expectedResult, setExpectedResult] = useState(initialDefect?.expectedResult || '');
  const [actualResult, setActualResult] = useState(initialDefect?.actualResult || '');
  const [assignedTo, setAssignedTo] = useState(initialDefect?.assignedTo || '');
  const [component, setComponent] = useState(initialDefect?.component || '');
  const [affectedVersion, setAffectedVersion] = useState(initialDefect?.affectedVersion || '');
  const [fixVersion, setFixVersion] = useState(initialDefect?.fixVersion || '');
  const [linkedTestCaseIds, setLinkedTestCaseIds] = useState<string[]>(initialDefect?.linkedTestCaseIds || []);
  const [linkedRunIds, setLinkedRunIds] = useState<string[]>(initialDefect?.linkedRunIds || []);
  const [tags, setTags] = useState(initialDefect?.tags?.join(', ') || '');

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    const defect: Defect = {
      id: initialDefect?.id || `DEF-${Date.now().toString(36).toUpperCase()}`,
      title: title.trim(),
      description,
      severity,
      priority,
      status,
      type,
      environment,
      stepsToReproduce,
      expectedResult,
      actualResult,
      assignedTo,
      component,
      affectedVersion,
      fixVersion,
      linkedTestCaseIds,
      linkedRunIds,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: initialDefect?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSubmit(defect);
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief description of the defect"
          className="bg-secondary border-border"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed description of the issue..."
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-gray-900 dark:text-white min-h-[80px] resize-y"
        />
      </div>

      {/* Row 1: Severity, Priority, Status, Type */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as any)}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"
          >
            <option value="critical">S1 - Critical</option>
            <option value="major">S2 - Major</option>
            <option value="minor">S3 - Minor</option>
            <option value="trivial">S4 - Low</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"
          >
            <option value="critical">P1 - Critical</option>
            <option value="high">P2 - High</option>
            <option value="medium">P3 - Medium</option>
            <option value="low">P4 - Low</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"
          >
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="fixed">Fixed</option>
            <option value="verified">Verified</option>
            <option value="closed">Closed</option>
            <option value="reopened">Reopened</option>
            <option value="deferred">Deferred</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"
          >
            <option value="bug">Bug</option>
            <option value="enhancement">Enhancement</option>
            <option value="regression">Regression</option>
            <option value="performance">Performance</option>
            <option value="security">Security</option>
            <option value="ui">UI Issue</option>
          </select>
        </div>
      </div>

      {/* Row 2: Environment, Component, Assigned To */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Environment</label>
          <Input
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="e.g., Production, Staging"
            className="bg-secondary border-border"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Component</label>
          <Input
            value={component}
            onChange={(e) => setComponent(e.target.value)}
            placeholder="e.g., Login, Checkout"
            className="bg-secondary border-border"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Assigned To</label>
          <Input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Developer name"
            className="bg-secondary border-border"
          />
        </div>
      </div>

      {/* Row 3: Versions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Affected Version</label>
          <Input
            value={affectedVersion}
            onChange={(e) => setAffectedVersion(e.target.value)}
            placeholder="e.g., 1.2.3"
            className="bg-secondary border-border"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Fix Version</label>
          <Input
            value={fixVersion}
            onChange={(e) => setFixVersion(e.target.value)}
            placeholder="e.g., 1.2.4"
            className="bg-secondary border-border"
          />
        </div>
      </div>

      {/* Steps to Reproduce */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Steps to Reproduce</label>
        <textarea
          value={stepsToReproduce}
          onChange={(e) => setStepsToReproduce(e.target.value)}
          placeholder="1. Go to...\n2. Click on...\n3. Observe..."
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-gray-900 dark:text-white min-h-[80px] resize-y"
        />
      </div>

      {/* Expected vs Actual */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Expected Result</label>
          <textarea
            value={expectedResult}
            onChange={(e) => setExpectedResult(e.target.value)}
            placeholder="What should happen..."
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-gray-900 dark:text-white min-h-[60px] resize-y"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Actual Result</label>
          <textarea
            value={actualResult}
            onChange={(e) => setActualResult(e.target.value)}
            placeholder="What actually happens..."
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-gray-900 dark:text-white min-h-[60px] resize-y"
          />
        </div>
      </div>

      {/* Linked Test Cases */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Linked Test Cases</label>
        <div className="max-h-32 overflow-y-auto bg-secondary border border-border rounded-md p-2">
          {testCases.slice(0, 20).map(tc => (
            <label key={tc.id} className="flex items-center gap-2 p-1 hover:bg-secondary rounded cursor-pointer">
              <input
                type="checkbox"
                checked={linkedTestCaseIds.includes(tc.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setLinkedTestCaseIds(prev => [...prev, tc.id]);
                  } else {
                    setLinkedTestCaseIds(prev => prev.filter(id => id !== tc.id));
                  }
                }}
                className="rounded border-gray-600 text-blue-600 dark:text-primary"
              />
              <span className="text-sm truncate">{tc.name}</span>
            </label>
          ))}
          {testCases.length > 20 && (
            <p className="text-xs text-gray-500 mt-1">Showing first 20 test cases</p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Tags (comma separated)</label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g., regression, critical, sprint-5"
          className="bg-secondary border-border"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} className="border-border">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {initialDefect ? 'Update Defect' : 'Create Defect'}
        </Button>
      </DialogFooter>
    </div>
  );
}
