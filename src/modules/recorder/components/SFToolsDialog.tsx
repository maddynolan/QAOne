/**
 * Salesforce Tools Dialog
 * Dialog for adding Salesforce-specific test steps (SOQL, Apex, Clone,
 * Validation, API, DataFactory, Permission, Flow, ApexTest, CreateRecord,
 * BulkLoad, RunReport).
 *
 * Extracted from PlaywrightRecorderPage.tsx (lines 9322-9729).
 */

import React from 'react';
import {
  Database, Zap, Copy, Shield, Globe, Sparkles, Layers,
  ArrowRight, Play, Plus, Upload, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { RecordedAction } from '@/modules/recorder/types/recorder.types';

export interface SFToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sfToolType: string | null;
  sfToolInput: string;
  setSfToolInput: (v: string) => void;
  sfToolInput2: string;
  setSfToolInput2: (v: string) => void;
  sfToolInput3: string;
  setSfToolInput3: (v: string) => void;
  setActions: React.Dispatch<React.SetStateAction<RecordedAction[]>>;
}

export default function SFToolsDialog({
  open,
  onOpenChange,
  sfToolType,
  sfToolInput,
  setSfToolInput,
  sfToolInput2,
  setSfToolInput2,
  sfToolInput3,
  setSfToolInput3,
  setActions,
}: SFToolsDialogProps) {

  const handleAddAction = () => {
    let action: RecordedAction;

    if (sfToolType === 'soql') {
      action = { id: `action_${Date.now()}`, qword: 'ExecuteSOQL', args: [sfToolInput || 'SELECT Id FROM Account LIMIT 1'], description: `SOQL: ${sfToolInput.substring(0, 50)}...`, timestamp: Date.now() };
    } else if (sfToolType === 'apex') {
      action = { id: `action_${Date.now()}`, qword: 'ExecuteApex', args: [sfToolInput || '// Apex code', 'anonymous'], description: `Apex: ${sfToolInput.split('\n')[0].substring(0, 40)}...`, timestamp: Date.now() };
    } else if (sfToolType === 'clone') {
      action = { id: `action_${Date.now()}`, qword: 'CloneRecord', args: [sfToolInput || 'Account', sfToolInput2 || ''], description: `Clone ${sfToolInput || 'Account'} Record`, timestamp: Date.now() };
    } else if (sfToolType === 'validation') {
      action = { id: `action_${Date.now()}`, qword: 'AssertValidation', args: [sfToolInput || 'Rule', sfToolInput2 || 'Error'], description: `Assert Validation: ${sfToolInput || 'Rule'}`, timestamp: Date.now() };
    } else if (sfToolType === 'api') {
      action = { id: `action_${Date.now()}`, qword: 'RestApiCall', args: [sfToolInput2 || 'GET', sfToolInput || '/services/data/v59.0/', sfToolInput3 || ''], description: `API ${sfToolInput2}: ${sfToolInput.substring(0, 40)}`, timestamp: Date.now() };
    } else if (sfToolType === 'datafactory') {
      action = { id: `action_${Date.now()}`, qword: 'CreateTestData', args: [sfToolInput || 'Account', sfToolInput2 || '5'], description: `Create ${sfToolInput2 || 5} ${sfToolInput || 'Account'} records`, timestamp: Date.now() };
    } else if (sfToolType === 'permission') {
      action = { id: `action_${Date.now()}`, qword: 'ManagePermissionSet', args: [sfToolInput2 || 'assign', sfToolInput || 'PermissionSet'], description: `${sfToolInput2 === 'remove' ? 'Remove' : 'Assign'} Permission Set: ${sfToolInput}`, timestamp: Date.now() };
    } else if (sfToolType === 'flow') {
      action = { id: `action_${Date.now()}`, qword: 'TriggerFlow', args: [sfToolInput || 'FlowName', sfToolInput2 || '{}'], description: `Trigger Flow: ${sfToolInput || 'FlowName'}`, timestamp: Date.now() };
    } else if (sfToolType === 'apextest') {
      action = { id: `action_${Date.now()}`, qword: 'RunApexTest', args: [sfToolInput || 'TestClass', sfToolInput2 || ''], description: `Run Apex Test: ${sfToolInput || 'TestClass'}${sfToolInput2 ? `.${sfToolInput2}` : ''}`, timestamp: Date.now() };
    } else if (sfToolType === 'createrecord') {
      action = { id: `action_${Date.now()}`, qword: 'CreateRecord', args: [sfToolInput || 'Account', sfToolInput2 || '{}'], description: `Create ${sfToolInput || 'Account'} Record`, timestamp: Date.now() };
    } else if (sfToolType === 'bulkload') {
      action = { id: `action_${Date.now()}`, qword: 'BulkLoad', args: [sfToolInput || 'Account', sfToolInput2 || '', sfToolInput3 || 'insert'], description: `Bulk ${sfToolInput3 || 'insert'} ${sfToolInput || 'Account'}`, timestamp: Date.now() };
    } else if (sfToolType === 'runreport') {
      action = { id: `action_${Date.now()}`, qword: 'RunReport', args: [sfToolInput || 'Report', sfToolInput2 || '{}'], description: `Run Report: ${sfToolInput || 'Report'}`, timestamp: Date.now() };
    } else {
      action = { id: `action_${Date.now()}`, qword: 'Unknown', args: [], description: 'Unknown action', timestamp: Date.now() };
    }

    setActions(prev => [...prev, action]);
    toast.success(`Added ${sfToolType?.toUpperCase()} step to test`);
    onOpenChange(false);
    setSfToolInput('');
    setSfToolInput2('');
    setSfToolInput3('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            {sfToolType === 'soql' && <><Database className="h-5 w-5 text-blue-400" /> Add SOQL Query Step</>}
            {sfToolType === 'apex' && <><Zap className="h-5 w-5 text-emerald-400" /> Add Apex Execution Step</>}
            {sfToolType === 'clone' && <><Copy className="h-5 w-5 text-purple-400" /> Add Clone Record Step</>}
            {sfToolType === 'validation' && <><Shield className="h-5 w-5 text-primary" /> Add Validation Assert Step</>}
            {sfToolType === 'api' && <><Globe className="h-5 w-5 text-cyan-400" /> Add REST API Call Step</>}
            {sfToolType === 'datafactory' && <><Sparkles className="h-5 w-5 text-pink-400" /> Add Data Factory Step</>}
            {sfToolType === 'permission' && <><Layers className="h-5 w-5 text-indigo-400" /> Add Permission Set Step</>}
            {sfToolType === 'flow' && <><ArrowRight className="h-5 w-5 text-orange-400" /> Add Flow Trigger Step</>}
            {sfToolType === 'apextest' && <><Play className="h-5 w-5 text-lime-400" /> Add Apex Test Step</>}
            {sfToolType === 'createrecord' && <><Plus className="h-5 w-5 text-sky-400" /> Add Create Record Step</>}
            {sfToolType === 'bulkload' && <><Upload className="h-5 w-5 text-fuchsia-400" /> Add Bulk Load Step</>}
            {sfToolType === 'runreport' && <><FileText className="h-5 w-5 text-yellow-400" /> Add Run Report Step</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {sfToolType === 'soql' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">SOQL Query</label>
                <textarea
                  value={sfToolInput}
                  onChange={(e) => setSfToolInput(e.target.value)}
                  placeholder="SELECT Id, Name FROM Account WHERE..."
                  className="w-full h-24 bg-secondary border border-border rounded-lg p-3 text-foreground text-sm font-mono resize-none focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">The query result will be stored and can be used in later steps</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-muted-foreground">Quick:</span>
                {[
                  'SELECT Id, Name FROM Account LIMIT 10',
                  'SELECT Id, Email FROM Contact WHERE Email != null LIMIT 5',
                  "SELECT Id, Name FROM Opportunity WHERE StageName = 'Closed Won'",
                ].map((q, i) => (
                  <Button key={i} variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground" onClick={() => setSfToolInput(q)}>
                    Template {i + 1}
                  </Button>
                ))}
              </div>
            </>
          )}

          {sfToolType === 'apex' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Apex Code (Anonymous)</label>
                <textarea
                  value={sfToolInput}
                  onChange={(e) => setSfToolInput(e.target.value)}
                  placeholder={"// Your Apex code here\nSystem.debug('Hello');"}
                  className="w-full h-32 bg-secondary border border-border rounded-lg p-3 text-foreground text-sm font-mono resize-none focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Execute anonymous Apex during test - useful for data setup/cleanup</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-muted-foreground">Templates:</span>
                <Button variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground"
                  onClick={() => setSfToolInput("// Insert test data\nAccount acc = new Account(Name = 'Test Account');\ninsert acc;")}>
                  Insert Record
                </Button>
                <Button variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground"
                  onClick={() => setSfToolInput("// Delete test data\ndelete [SELECT Id FROM Account WHERE Name LIKE 'Test%'];")}>
                  Delete Records
                </Button>
                <Button variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground"
                  onClick={() => setSfToolInput("// Update records\nList<Account> accs = [SELECT Id FROM Account LIMIT 5];\nfor(Account a : accs) { a.Description = 'Updated'; }\nupdate accs;")}>
                  Update Records
                </Button>
              </div>
            </>
          )}

          {sfToolType === 'clone' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="Account, Contact, Opportunity..." className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Record ID (optional - will use current page if empty)</label>
                <Input value={sfToolInput2} onChange={(e) => setSfToolInput2(e.target.value)} placeholder="001XXXXXXXXXXXX or leave empty" className="bg-secondary border-border text-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground">Clone will duplicate the record with a new ID, copying all cloneable fields</p>
            </>
          )}

          {sfToolType === 'validation' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Validation Rule Name</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="e.g., Account_Name_Required" className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Expected Error Message (contains)</label>
                <Input value={sfToolInput2} onChange={(e) => setSfToolInput2(e.target.value)} placeholder="e.g., Account Name is required" className="bg-secondary border-border text-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground">Asserts that the expected validation error appears when triggered</p>
            </>
          )}

          {sfToolType === 'api' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">API Endpoint</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="/services/data/v59.0/sobjects/Account" className="bg-secondary border-border text-foreground font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">HTTP Method</label>
                <div className="flex gap-2">
                  {['GET', 'POST', 'PATCH', 'DELETE'].map(m => (
                    <Button key={m} variant={sfToolInput2 === m ? 'default' : 'outline'} size="sm"
                      className={sfToolInput2 === m ? 'bg-cyan-600' : 'border-white/20'}
                      onClick={() => setSfToolInput2(m)}>{m}</Button>
                  ))}
                </div>
              </div>
              {(sfToolInput2 === 'POST' || sfToolInput2 === 'PATCH') && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Request Body (JSON)</label>
                  <textarea
                    value={sfToolInput3}
                    onChange={(e) => setSfToolInput3(e.target.value)}
                    placeholder='{"Name": "Test Account"}'
                    className="w-full h-20 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
                  />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Make a REST API call to Salesforce - useful for data setup/cleanup</p>
            </>
          )}

          {sfToolType === 'datafactory' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="Account, Contact, Lead..." className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Number of Records</label>
                <Input type="number" value={sfToolInput2} onChange={(e) => setSfToolInput2(e.target.value)} placeholder="5" className="bg-secondary border-border text-foreground w-24" />
              </div>
              <p className="text-[10px] text-muted-foreground">Generate test records with random data - great for bulk testing</p>
            </>
          )}

          {sfToolType === 'permission' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Permission Set Name</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="Sales_Cloud_Admin, Service_User..." className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Action</label>
                <div className="flex gap-2">
                  <Button variant={sfToolInput2 === 'assign' ? 'default' : 'outline'} size="sm"
                    className={sfToolInput2 === 'assign' ? 'bg-indigo-600' : 'border-white/20'}
                    onClick={() => setSfToolInput2('assign')}>Assign</Button>
                  <Button variant={sfToolInput2 === 'remove' ? 'default' : 'outline'} size="sm"
                    className={sfToolInput2 === 'remove' ? 'bg-indigo-600' : 'border-white/20'}
                    onClick={() => setSfToolInput2('remove')}>Remove</Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Assign or remove permission sets for the current test user</p>
            </>
          )}

          {sfToolType === 'flow' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Flow API Name</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="My_Automation_Flow" className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Input Variables (JSON, optional)</label>
                <textarea
                  value={sfToolInput2}
                  onChange={(e) => setSfToolInput2(e.target.value)}
                  placeholder='{"recordId": "001XXXXXXXXXXXX"}'
                  className="w-full h-16 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Manually trigger a Flow to test automation logic</p>
            </>
          )}

          {sfToolType === 'apextest' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Test Class Name</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="AccountTriggerTest, ContactServiceTest..." className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Test Method (optional - runs all if empty)</label>
                <Input value={sfToolInput2} onChange={(e) => setSfToolInput2(e.target.value)} placeholder="testInsertAccount" className="bg-secondary border-border text-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground">Run Apex tests as part of your test flow - validates backend logic</p>
            </>
          )}

          {sfToolType === 'createrecord' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="Account, Contact, Opportunity..." className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Field Values (JSON)</label>
                <textarea
                  value={sfToolInput2}
                  onChange={(e) => setSfToolInput2(e.target.value)}
                  placeholder='{"Name": "Test Account", "Industry": "Technology"}'
                  className="w-full h-20 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Create a single record via API - the record ID will be stored for later use</p>
            </>
          )}

          {sfToolType === 'bulkload' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="Account, Contact, Lead..." className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">CSV File Path or Variable</label>
                <Input value={sfToolInput2} onChange={(e) => setSfToolInput2(e.target.value)} placeholder="./test-data/accounts.csv or ${csvData}" className="bg-secondary border-border text-foreground font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Operation</label>
                <div className="flex gap-2">
                  {['insert', 'update', 'upsert', 'delete'].map(op => (
                    <Button key={op} variant={sfToolInput3 === op ? 'default' : 'outline'} size="sm"
                      className={sfToolInput3 === op ? 'bg-fuchsia-600' : 'border-white/20 capitalize'}
                      onClick={() => setSfToolInput3(op)}>{op}</Button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Bulk load data from CSV - useful for data-driven testing</p>
            </>
          )}

          {sfToolType === 'runreport' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Report API Name or ID</label>
                <Input value={sfToolInput} onChange={(e) => setSfToolInput(e.target.value)} placeholder="Monthly_Sales_Report or 00O..." className="bg-secondary border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Filters (JSON, optional)</label>
                <textarea
                  value={sfToolInput2}
                  onChange={(e) => setSfToolInput2(e.target.value)}
                  placeholder='{"column": "ACCOUNT_NAME", "operator": "contains", "value": "Test"}'
                  className="w-full h-16 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Run a Salesforce report and store results for assertions</p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/20">
            Cancel
          </Button>
          <Button
            onClick={handleAddAction}
            className={cn(
              "text-foreground",
              sfToolType === 'soql' && "bg-blue-600 hover:bg-blue-700",
              sfToolType === 'apex' && "bg-emerald-600 hover:bg-emerald-700",
              sfToolType === 'clone' && "bg-purple-600 hover:bg-purple-700",
              sfToolType === 'validation' && "bg-primary hover:bg-primary/90",
              sfToolType === 'api' && "bg-cyan-600 hover:bg-cyan-700",
              sfToolType === 'datafactory' && "bg-pink-600 hover:bg-pink-700",
              sfToolType === 'permission' && "bg-indigo-600 hover:bg-indigo-700",
              sfToolType === 'flow' && "bg-orange-600 hover:bg-orange-700",
              sfToolType === 'apextest' && "bg-lime-600 hover:bg-lime-700",
              sfToolType === 'createrecord' && "bg-sky-600 hover:bg-sky-700",
              sfToolType === 'bulkload' && "bg-fuchsia-600 hover:bg-fuchsia-700",
              sfToolType === 'runreport' && "bg-yellow-600 hover:bg-yellow-700"
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
