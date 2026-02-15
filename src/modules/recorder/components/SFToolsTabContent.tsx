/**
 * SFToolsTabContent - Salesforce tools tab with sub-tabs (SOQL, Assert, Stages, Quick, Test).
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Play, Trash2, Save, Search, Plus, Copy,
  Zap, FileText, ExternalLink, ChevronRight,
  Eye, Database, Upload,
  Shield, Sparkles,
  PenLine, LayoutGrid, ArrowRight,
  Globe, Loader2,
  Navigation, Building2, Users, Contact, Briefcase,
  FileBox, MapPin, Compass, Route,
  FlaskConical, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SmartSOQLBuilder } from "@/modules/salesforce/components/salesforce/SmartSOQLBuilder";
import { MetadataAssertions } from "@/modules/salesforce/components/salesforce/MetadataAssertions";
import { StageTransitionTester } from "@/modules/salesforce/components/salesforce/StageTransitionTester";
import type { RecordedAction } from "@/modules/recorder/types/recorder.types";

interface SFToolsTabContentProps {
  sfToolsSubTab: string;
  setSfToolsSubTab: (tab: string) => void;
  sfToolInput: string;
  setSfToolInput: (value: string) => void;
  sfToolInput2: string;
  setSfToolInput2: (value: string) => void;
  sfToolInput3: string;
  setSfToolInput3: (value: string) => void;
  soqlQuery: string;
  setSoqlQuery: (query: string) => void;
  soqlResults: any[];
  setSoqlResults: (results: any[]) => void;
  soqlColumns: string[];
  setSoqlColumns: (columns: string[]) => void;
  soqlError: string | null;
  isQueryLoading: boolean;
  showSoqlPanel: boolean;
  setShowSoqlPanel: (show: boolean) => void;
  inspectRecordId: string;
  setInspectRecordId: (id: string) => void;
  inspectedRecord: any;
  setSfToolType: (type: any) => void;
  setShowSFToolDialog: (show: boolean) => void;
  executeSOQL: () => void;
  inspectRecord: () => void;
  addSOQLAssertionStep: (column: string, value: string, row: number) => void;
  addFieldAssertion: (field: string, value: any) => void;
  setActions: React.Dispatch<React.SetStateAction<RecordedAction[]>>;
}

export default function SFToolsTabContent({
  sfToolsSubTab,
  setSfToolsSubTab,
  sfToolInput,
  setSfToolInput,
  sfToolInput2,
  setSfToolInput2,
  sfToolInput3,
  setSfToolInput3,
  soqlQuery,
  setSoqlQuery,
  soqlResults,
  setSoqlResults,
  soqlColumns,
  setSoqlColumns,
  soqlError,
  isQueryLoading,
  showSoqlPanel,
  setShowSoqlPanel,
  inspectRecordId,
  setInspectRecordId,
  inspectedRecord,
  setSfToolType,
  setShowSFToolDialog,
  executeSOQL,
  inspectRecord: inspectRecordFn,
  addSOQLAssertionStep,
  addFieldAssertion,
  setActions,
}: SFToolsTabContentProps) {
  return (
    <>
      {/* SF Tools Sub-tabs bar */}
      <div className="shrink-0 bg-card border-b border-border">
        <div className="flex">
          <button
            onClick={() => setSfToolsSubTab('soql')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
              sfToolsSubTab === 'soql'
                ? "bg-primary/10 text-primary border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
            )}
          >
            <Database className="h-3.5 w-3.5" />
            SOQL
          </button>
          <button
            onClick={() => setSfToolsSubTab('assertions')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
              sfToolsSubTab === 'assertions'
                ? "bg-warning/10 text-warning border-warning"
                : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            Assert
          </button>
          <button
            onClick={() => setSfToolsSubTab('stages')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
              sfToolsSubTab === 'stages'
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500"
                : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
            )}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Stages
          </button>
          <button
            onClick={() => setSfToolsSubTab('quick')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
              sfToolsSubTab === 'quick'
                ? "bg-purple-500/10 text-purple-400 border-purple-500"
                : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            Quick
          </button>
          <button
            onClick={() => setSfToolsSubTab('testhelpers')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
              sfToolsSubTab === 'testhelpers'
                ? "bg-green-500/10 text-green-400 border-green-500"
                : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
            )}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Test
          </button>
        </div>
      </div>

      {/* SF Tools Sub-tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {/* SOQL Builder Sub-tab */}
        {sfToolsSubTab === 'soql' && (
          <SmartSOQLBuilder
            onExecute={(query, results) => {
              setSoqlQuery(query);
              if (results?.records) {
                setSoqlResults(results.records);
                setSoqlColumns(results.records.length > 0 ? Object.keys(results.records[0]).filter(k => k !== 'attributes') : []);
              }
            }}
            onAddAsStep={(step) => {
              const action: RecordedAction = {
                id: `sf_${Date.now()}`,
                qword: step.action,
                args: Object.values(step.args).map(v => String(v)),
                description: step.args.description || step.action,
                timestamp: Date.now(),
                type: step.type
              };
              setActions(prev => [...prev, action]);
            }}
            className="h-full w-full"
          />
        )}

        {/* Metadata Assertions Sub-tab */}
        {sfToolsSubTab === 'assertions' && (
          <MetadataAssertions
            onAddAsStep={(step) => {
              const action: RecordedAction = {
                id: `sf_${Date.now()}`,
                qword: step.action,
                args: Object.values(step.args).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)),
                description: step.args.description || step.action,
                timestamp: Date.now(),
                type: step.type
              };
              setActions(prev => [...prev, action]);
            }}
            className="h-full w-full"
          />
        )}

        {/* Stage Transition Sub-tab */}
        {sfToolsSubTab === 'stages' && (
          <StageTransitionTester
            onAddAsStep={(step) => {
              const action: RecordedAction = {
                id: `sf_${Date.now()}`,
                qword: step.action,
                args: Object.values(step.args).map(v => String(v)),
                description: step.args.description || step.action,
                timestamp: Date.now(),
                type: step.type
              };
              setActions(prev => [...prev, action]);
            }}
            className="h-full w-full"
          />
        )}

        {/* Quick Tools Sub-tab */}
        {sfToolsSubTab === 'quick' && (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-3">

            {/* ===== QUICK SOQL SECTION ===== */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  Quick SOQL Query
                </h4>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-blue-400"
                  onClick={() => setShowSoqlPanel(!showSoqlPanel)}
                >
                  {showSoqlPanel ? 'Hide' : 'Expand'} Editor
                </Button>
              </div>

              {/* Quick Query Input */}
              <div className="flex gap-1.5">
                <Input
                  value={soqlQuery}
                  onChange={(e) => setSoqlQuery(e.target.value)}
                  placeholder="SELECT Id, Name FROM Account LIMIT 10"
                  className="h-8 text-xs bg-input border-blue-500/20 text-foreground font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && executeSOQL()}
                />
                <Button
                  size="sm"
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-700"
                  onClick={executeSOQL}
                  disabled={isQueryLoading}
                >
                  {isQueryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                </Button>
              </div>

              {/* Query Templates */}
              <div className="flex flex-wrap gap-1 mt-2">
                {[
                  { label: 'Accounts', q: 'SELECT Id, Name, Industry, Phone FROM Account LIMIT 20' },
                  { label: 'Contacts', q: 'SELECT Id, FirstName, LastName, Email, AccountId FROM Contact LIMIT 20' },
                  { label: 'Leads', q: 'SELECT Id, Name, Company, Status, Email FROM Lead LIMIT 20' },
                  { label: 'Opps', q: 'SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity LIMIT 20' },
                  { label: 'Users', q: 'SELECT Id, Name, Email, ProfileId, IsActive FROM User LIMIT 20' },
                ].map(t => (
                  <Button
                    key={t.label}
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[9px] text-blue-300/70 hover:text-blue-300"
                    onClick={() => setSoqlQuery(t.q)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>

              {/* Query Results (Compact) */}
              {soqlResults.length > 0 && (
                <div className="mt-2 bg-input rounded border border-blue-500/20 max-h-32 overflow-auto">
                  <table className="w-full text-[9px]">
                    <thead className="bg-blue-500/10 sticky top-0">
                      <tr>
                        <th className="px-1 py-0.5 text-left text-blue-300">#</th>
                        {soqlColumns.slice(0, 4).map(col => (
                          <th key={col} className="px-1 py-0.5 text-left text-blue-300 truncate max-w-[80px]">{col}</th>
                        ))}
                        <th className="px-1 py-0.5 text-center text-blue-300">Add</th>
                      </tr>
                    </thead>
                    <tbody>
                      {soqlResults.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-t border-blue-500/10 hover:bg-blue-500/5">
                          <td className="px-1 py-0.5 text-muted-foreground">{idx + 1}</td>
                          {soqlColumns.slice(0, 4).map(col => (
                            <td key={col} className="px-1 py-0.5 text-foreground truncate max-w-[80px]">
                              {String(row[col] ?? '-')}
                            </td>
                          ))}
                          <td className="px-1 py-0.5 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-4 w-4 p-0 text-green-400 hover:text-green-300"
                              onClick={() => addSOQLAssertionStep(soqlColumns[1] || 'Id', row[soqlColumns[1]] || row.Id, idx)}
                              title="Add as assertion"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {soqlResults.length > 10 && (
                    <div className="text-center text-[9px] text-muted-foreground py-1">
                      +{soqlResults.length - 10} more records
                    </div>
                  )}
                </div>
              )}

              {soqlError && (
                <div className="mt-2 p-1.5 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
                  {soqlError}
                </div>
              )}
            </div>

            {/* ===== RECORD INSPECTOR ===== */}
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2">
              <h4 className="text-xs font-medium text-purple-400 flex items-center gap-1.5 mb-2">
                <Eye className="h-3.5 w-3.5" />
                Record Inspector
              </h4>
              <div className="flex gap-1.5">
                <Input
                  value={inspectRecordId}
                  onChange={(e) => setInspectRecordId(e.target.value)}
                  placeholder="Enter Record ID (e.g., 001...)"
                  className="h-7 text-xs bg-input border-purple-500/20 text-foreground font-mono"
                />
                <Button
                  size="sm"
                  className="h-7 px-2 bg-purple-600 hover:bg-purple-700"
                  onClick={inspectRecordFn}
                >
                  <Search className="h-3 w-3" />
                </Button>
              </div>

              {/* Inspected Record Fields */}
              {inspectedRecord && (
                <div className="mt-2 bg-input rounded border border-purple-500/20 max-h-40 overflow-auto">
                  <div className="p-1">
                    {Object.entries(inspectedRecord)
                      .filter(([k]) => k !== 'attributes')
                      .slice(0, 15)
                      .map(([field, value]) => (
                      <div key={field} className="flex items-center justify-between py-0.5 px-1 text-[9px] hover:bg-purple-500/10 rounded group">
                        <span className="text-purple-300 truncate max-w-[100px]">{field}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground truncate max-w-[100px]">{String(value ?? 'null')}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-green-400"
                            onClick={() => addFieldAssertion(field, value)}
                            title="Add assertion"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ===== DATA SETUP TOOLS ===== */}
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Data Setup</h4>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 text-[10px] border-border hover:border-pink-500/50 hover:bg-pink-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('datafactory'); setSfToolInput('Account'); setSfToolInput2('5'); setShowSFToolDialog(true); }}
                >
                  <Sparkles className="h-4 w-4 text-pink-400" />
                  <span>Data Factory</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 text-[10px] border-border hover:border-sky-500/50 hover:bg-sky-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('createrecord'); setSfToolInput('Account'); setSfToolInput2('{"Name":"Test"}'); setShowSFToolDialog(true); }}
                >
                  <Plus className="h-4 w-4 text-sky-400" />
                  <span>Create Record</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 text-[10px] border-border hover:border-purple-500/50 hover:bg-purple-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('clone'); setSfToolInput('Account'); setSfToolInput2(''); setShowSFToolDialog(true); }}
                >
                  <Copy className="h-4 w-4 text-purple-400" />
                  <span>Clone Record</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 text-[10px] border-border hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('bulkload'); setSfToolInput('Account'); setSfToolInput2(''); setShowSFToolDialog(true); }}
                >
                  <Upload className="h-4 w-4 text-fuchsia-400" />
                  <span>Bulk Insert</span>
                </Button>
              </div>
            </div>

            {/* ===== CODE EXECUTION ===== */}
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Code & API</h4>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[10px] border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('apex'); setSfToolInput('// Apex code\nSystem.debug(\'Test\');'); setShowSFToolDialog(true); }}
                >
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Apex</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[10px] border-border hover:border-cyan-500/50 hover:bg-cyan-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('api'); setSfToolInput('/services/data/v59.0/sobjects/Account'); setSfToolInput2('GET'); setShowSFToolDialog(true); }}
                >
                  <Globe className="h-3.5 w-3.5 text-cyan-400" />
                  <span>REST API</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[10px] border-border hover:border-orange-500/50 hover:bg-orange-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('flow'); setSfToolInput(''); setShowSFToolDialog(true); }}
                >
                  <ArrowRight className="h-3.5 w-3.5 text-orange-400" />
                  <span>Flow</span>
                </Button>
              </div>
            </div>

            {/* ===== ASSERTIONS & VALIDATIONS ===== */}
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Assertions</h4>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[10px] border-border hover:border-primary/50 hover:bg-primary/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('validation'); setSfToolInput(''); setSfToolInput2(''); setShowSFToolDialog(true); }}
                >
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span>Validation Rule</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[10px] border-border hover:border-teal-500/50 hover:bg-teal-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => {
                    const action: RecordedAction = { id: `action_${Date.now()}`, qword: 'AssertFieldValue', args: ['FieldName', 'ExpectedValue'], description: 'Assert Field Value', timestamp: Date.now() };
                    setActions(prev => [...prev, action]);
                    toast.success('Added Field Assert - configure in Builder');
                  }}
                >
                  <Play className="h-3.5 w-3.5 text-teal-400" />
                  <span>Assert Field</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[10px] border-border hover:border-blue-500/50 hover:bg-blue-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('soql'); setSfToolInput('SELECT COUNT() FROM Account'); setShowSFToolDialog(true); }}
                >
                  <Database className="h-3.5 w-3.5 text-blue-400" />
                  <span>SOQL Assert</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[10px] border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('runreport'); setSfToolInput(''); setShowSFToolDialog(true); }}
                >
                  <FileText className="h-3.5 w-3.5 text-yellow-400" />
                  <span>Report Assert</span>
                </Button>
              </div>
            </div>

            {/* ===== ADMIN & CLEANUP ===== */}
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Admin & Cleanup</h4>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-[10px] border-border hover:border-indigo-500/50 hover:bg-indigo-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('permission'); setSfToolInput(''); setSfToolInput2('assign'); setShowSFToolDialog(true); }}
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Perm Set</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-[10px] border-border hover:border-lime-500/50 hover:bg-lime-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => { setSfToolType('apextest'); setSfToolInput(''); setShowSFToolDialog(true); }}
                >
                  <Play className="h-3.5 w-3.5 text-lime-400" />
                  <span>Apex Test</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-[10px] border-border hover:border-rose-500/50 hover:bg-rose-500/5 flex-col gap-0.5 justify-center"
                  onClick={() => {
                    const action: RecordedAction = { id: `action_${Date.now()}`, qword: 'DeleteRecord', args: ['CurrentRecord'], description: 'Delete Current Record', timestamp: Date.now() };
                    setActions(prev => [...prev, action]);
                    toast.success('Added Delete step');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  <span>Delete</span>
                </Button>
              </div>
            </div>

            {/* ===== NAVIGATE TO FULL SF TAB ===== */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => window.location.href = '/salesforce'}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Open Full Salesforce Tools
              </Button>
              <p className="text-[9px] text-muted-foreground text-center mt-1.5">
                Access Schema Browser, Debug Logs, Data Diff, and 20+ more tools
              </p>
            </div>
          </div>
          </ScrollArea>
        )}

        {/* Test Helpers Sub-tab - Navigation & Record Operations */}
        {sfToolsSubTab === 'testhelpers' && (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-3">

              {/* ===== NAVIGATE TO RECORD BY ID ===== */}
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2.5">
                <h4 className="text-[10px] font-medium text-green-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  Navigate to Record by ID
                </h4>
                <div className="flex gap-1.5">
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Enter Record ID (e.g., 001xxx, 003xxx)"
                    className="h-8 text-xs bg-input border-green-500/20 text-foreground font-mono flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 bg-green-600 hover:bg-green-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!sfToolInput.trim()) {
                        toast.error('Please enter a Record ID');
                        return;
                      }
                      const recordId = sfToolInput.trim();
                      const prefix = recordId.substring(0, 3);
                      const prefixMap: Record<string, string> = {
                        '001': 'Account', '003': 'Contact', '006': 'Opportunity', '00Q': 'Lead',
                        '500': 'Case', '00T': 'Task', '00U': 'Event', '005': 'User',
                        '701': 'Campaign', '01t': 'Product2', '0Q0': 'Quote', '800': 'Contract'
                      };
                      const objectType = prefixMap[prefix] || 'sObject';
                      const lightningPath = `/lightning/r/${objectType}/${recordId}/view`;
                      const action: RecordedAction = {
                        id: `nav_${Date.now()}`,
                        qword: 'NavigateToRecordById',
                        args: [recordId, objectType, lightningPath],
                        description: `Navigate to ${objectType}: ${recordId}`,
                        timestamp: Date.now(),
                        type: 'sf-navigate-record'
                      };
                      setActions(prev => [...prev, action]);
                      toast.success(`Added: Navigate to ${objectType} ${recordId}`);
                      setSfToolInput('');
                    }}
                  >
                    <Compass className="h-3.5 w-3.5 mr-1" />
                    Add Step
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">
                  Supports: Account (001), Contact (003), Opportunity (006), Lead (00Q), Case (500), User (005), and more
                </p>
              </div>

              {/* ===== NAVIGATE VIA SOQL ===== */}
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-2.5">
                <h4 className="text-[10px] font-medium text-cyan-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Database className="h-3 w-3" />
                  Navigate via SOQL Query
                </h4>
                <div className="space-y-2">
                  <Select value={sfToolInput2 || 'Account'} onValueChange={setSfToolInput2}>
                    <SelectTrigger className="h-7 text-xs bg-input border-cyan-500/20">
                      <SelectValue placeholder="Select Object" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Account">Account</SelectItem>
                      <SelectItem value="Contact">Contact</SelectItem>
                      <SelectItem value="Opportunity">Opportunity</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Case">Case</SelectItem>
                      <SelectItem value="User">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={sfToolInput3}
                    onChange={(e) => setSfToolInput3(e.target.value)}
                    placeholder="WHERE clause (e.g., Name = 'Acme Corp')"
                    className="h-8 text-xs bg-input border-cyan-500/20 text-foreground font-mono"
                  />
                  <Button
                    size="sm"
                    className="w-full h-8 bg-cyan-600 hover:bg-cyan-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const objectType = sfToolInput2 || 'Account';
                      const whereClause = sfToolInput3.trim();
                      const soqlQ = whereClause
                        ? `SELECT Id FROM ${objectType} WHERE ${whereClause} LIMIT 1`
                        : `SELECT Id FROM ${objectType} LIMIT 1`;
                      const action: RecordedAction = {
                        id: `soqlnav_${Date.now()}`,
                        qword: 'NavigateToRecordBySOQL',
                        args: [objectType, soqlQ],
                        description: `Query ${objectType} and navigate to result`,
                        timestamp: Date.now(),
                        type: 'sf-navigate-soql'
                      };
                      setActions(prev => [...prev, action]);
                      toast.success(`Added: Navigate to ${objectType} via SOQL`);
                      setSfToolInput3('');
                    }}
                  >
                    <Database className="h-3.5 w-3.5 mr-1.5" />
                    Add SOQL Navigate Step
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">
                  Runs SOQL query to get record ID, then navigates to that record.
                </p>
              </div>

              {/* ===== QUICK OBJECT NAVIGATION ===== */}
              <div>
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1 flex items-center gap-1.5">
                  <Navigation className="h-3 w-3" />
                  Quick Navigate - Sales Objects
                </h4>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { name: 'Accounts', obj: 'Account', icon: Building2, color: 'blue' },
                    { name: 'Contacts', obj: 'Contact', icon: Contact, color: 'green' },
                    { name: 'Opportunities', obj: 'Opportunity', icon: Briefcase, color: 'yellow' },
                    { name: 'Leads', obj: 'Lead', icon: Users, color: 'purple' },
                    { name: 'Campaigns', obj: 'Campaign', icon: Search, color: 'pink' },
                    { name: 'Products', obj: 'Product2', icon: FileBox, color: 'cyan' },
                    { name: 'Quotes', obj: 'Quote', icon: FileText, color: 'orange' },
                    { name: 'Contracts', obj: 'Contract', icon: FileText, color: 'teal' }
                  ].map(({ name, obj, icon: Icon, color }) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      className={`h-9 text-[9px] border-border hover:border-${color}-500/50 hover:bg-${color}-500/5 flex-col gap-0.5 justify-center`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const lightningPath = `/lightning/o/${obj}/list`;
                        const action: RecordedAction = {
                          id: `nav_${Date.now()}`,
                          qword: 'NavigateToObjectList',
                          args: [obj, lightningPath],
                          description: `Navigate to ${name} list view`,
                          timestamp: Date.now(),
                          type: 'sf-navigate-list'
                        };
                        setActions(prev => [...prev, action]);
                        toast.success(`Added: Navigate to ${name}`);
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* ===== SERVICE & ADMIN NAVIGATION ===== */}
              <div>
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                  Quick Navigate - Service & Admin
                </h4>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { name: 'Cases', obj: 'Case' },
                    { name: 'Tasks', obj: 'Task' },
                    { name: 'Events', obj: 'Event' },
                    { name: 'Reports', obj: 'Report' },
                    { name: 'Dashboards', obj: 'Dashboard' },
                    { name: 'Files', obj: 'ContentDocument' },
                    { name: 'Users', obj: 'User' },
                    { name: 'Setup', obj: 'SetupOneHome' }
                  ].map(({ name, obj }) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[9px] border-border hover:bg-accent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const lightningPath = name === 'Setup'
                          ? '/lightning/setup/SetupOneHome/home'
                          : `/lightning/o/${obj}/list`;
                        const action: RecordedAction = {
                          id: `nav_${Date.now()}`,
                          qword: 'NavigateToObjectList',
                          args: [obj, lightningPath],
                          description: `Navigate to ${name}`,
                          timestamp: Date.now(),
                          type: 'sf-navigate-list'
                        };
                        setActions(prev => [...prev, action]);
                        toast.success(`Added: Navigate to ${name}`);
                      }}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* ===== QUICK CREATE RECORDS ===== */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5">
                <h4 className="text-[10px] font-medium text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  Quick Create Record
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { name: 'Account', prefix: '001', color: 'blue' },
                    { name: 'Contact', prefix: '003', color: 'green' },
                    { name: 'Opportunity', prefix: '006', color: 'yellow' },
                    { name: 'Lead', prefix: '00Q', color: 'purple' },
                    { name: 'Case', prefix: '500', color: 'red' },
                    { name: 'Task', prefix: '00T', color: 'cyan' }
                  ].map(({ name, prefix, color }) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      className={`h-10 text-[10px] border-border hover:border-${color}-500/50 hover:bg-${color}-500/5 flex-col gap-0.5 justify-center`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const lightningPath = `/lightning/o/${name}/new`;
                        const action: RecordedAction = {
                          id: `create_${Date.now()}`,
                          qword: 'NavigateToNewRecord',
                          args: [name, lightningPath],
                          description: `Create New ${name}`,
                          timestamp: Date.now(),
                          type: 'sf-navigate-new'
                        };
                        setActions(prev => [...prev, action]);
                        toast.success(`Added: Create New ${name}`);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      New {name}
                    </Button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground mt-2">
                  These steps navigate to the New record form. Use recording to capture field inputs.
                </p>
              </div>

              {/* ===== GLOBAL SEARCH ===== */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5">
                <h4 className="text-[10px] font-medium text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Search className="h-3 w-3" />
                  Global Search
                </h4>
                <div className="flex gap-1.5">
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Enter search term..."
                    className="h-8 text-xs bg-input border-purple-500/20 text-foreground flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 bg-purple-600 hover:bg-purple-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const searchTerm = sfToolInput.trim();
                      if (!searchTerm) {
                        toast.error('Please enter a search term');
                        return;
                      }
                      const action: RecordedAction = {
                        id: `gsearch_${Date.now()}`,
                        qword: 'SalesforceGlobalSearch',
                        args: [searchTerm],
                        description: `Global search for: "${searchTerm}"`,
                        timestamp: Date.now(),
                        type: 'sf-global-search'
                      };
                      setActions(prev => [...prev, action]);
                      toast.success(`Added: Global search "${searchTerm}"`);
                      setSfToolInput('');
                    }}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    Add Step
                  </Button>
                </div>
              </div>

              {/* ===== COMMON TEST WORKFLOWS ===== */}
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-2.5">
                <h4 className="text-[10px] font-medium text-orange-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Route className="h-3 w-3" />
                  Common Test Workflows (Multi-Step)
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { name: 'Account', obj: 'Account', icon: Building2 },
                    { name: 'Contact', obj: 'Contact', icon: Contact },
                    { name: 'Opportunity', obj: 'Opportunity', icon: Briefcase },
                    { name: 'Case', obj: 'Case', icon: FileBox }
                  ].map(({ name, obj, icon: Icon }) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      className="h-11 text-[10px] border-border hover:border-orange-500/50 hover:bg-orange-500/5 flex-col gap-0.5 justify-center"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const now = Date.now();
                        const steps: RecordedAction[] = [
                          {
                            id: `flow_${now}_1`,
                            qword: 'NavigateToObjectList',
                            args: [obj, `/lightning/o/${obj}/list`],
                            description: `Navigate to ${name}s list`,
                            timestamp: now,
                            type: 'sf-navigate-list'
                          },
                          {
                            id: `flow_${now}_2`,
                            qword: 'NavigateToNewRecord',
                            args: [obj, `/lightning/o/${obj}/new`],
                            description: `Open New ${name} form`,
                            timestamp: now + 1,
                            type: 'sf-navigate-new'
                          },
                          {
                            id: `flow_${now}_3`,
                            qword: 'WaitForSalesforceReady',
                            args: ['3000'],
                            description: 'Wait for form to load',
                            timestamp: now + 2,
                            type: 'sf-wait'
                          }
                        ];
                        setActions(prev => [...prev, ...steps]);
                        toast.success(`Added: Create ${name} workflow (3 steps)`);
                      }}
                    >
                      <Icon className="h-4 w-4 text-orange-400" />
                      <span>Create {name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* ===== RECORD TABS NAVIGATION ===== */}
              <div>
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                  Navigate Record Tabs
                </h4>
                <div className="grid grid-cols-5 gap-1">
                  {['Details', 'Related', 'Activity', 'News', 'Chatter'].map(tab => (
                    <Button
                      key={tab}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[9px] border-border hover:bg-accent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const action: RecordedAction = {
                          id: `tab_${Date.now()}`,
                          qword: 'ClickRecordTab',
                          args: [tab],
                          description: `Click ${tab} tab`,
                          timestamp: Date.now(),
                          type: 'sf-click-tab'
                        };
                        setActions(prev => [...prev, action]);
                        toast.success(`Added: Click ${tab} tab`);
                      }}
                    >
                      {tab}
                    </Button>
                  ))}
                </div>
              </div>

              {/* ===== UTILITY ACTIONS ===== */}
              <div>
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                  Utility Actions
                </h4>
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const action: RecordedAction = { id: `util_${Date.now()}`, qword: 'OpenAppLauncher', args: [], description: 'Open App Launcher', timestamp: Date.now(), type: 'sf-app-launcher' };
                      setActions(prev => [...prev, action]);
                      toast.success('Added: Open App Launcher');
                    }}
                  >
                    <LayoutGrid className="h-3 w-3" />
                    App Launcher
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const action: RecordedAction = { id: `util_${Date.now()}`, qword: 'OpenGlobalSearch', args: [], description: 'Open Global Search', timestamp: Date.now(), type: 'sf-open-search' };
                      setActions(prev => [...prev, action]);
                      toast.success('Added: Open Global Search');
                    }}
                  >
                    <Search className="h-3 w-3" />
                    Search
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const action: RecordedAction = { id: `util_${Date.now()}`, qword: 'WaitForSalesforceReady', args: ['3000'], description: 'Wait 3 seconds', timestamp: Date.now(), type: 'sf-wait' };
                      setActions(prev => [...prev, action]);
                      toast.success('Added: Wait 3 seconds');
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Wait 3s
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const action: RecordedAction = { id: `util_${Date.now()}`, qword: 'TakeScreenshot', args: [`screenshot_${Date.now()}.png`], description: 'Take screenshot', timestamp: Date.now(), type: 'screenshot' };
                      setActions(prev => [...prev, action]);
                      toast.success('Added: Take screenshot');
                    }}
                  >
                    <Eye className="h-3 w-3" />
                    Screenshot
                  </Button>
                </div>
              </div>

              {/* ===== SAVE/EDIT/DELETE ACTIONS ===== */}
              <div>
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                  Record Actions
                </h4>
                <div className="grid grid-cols-4 gap-1">
                  <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:border-green-500/50 hover:bg-green-500/5"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); const action: RecordedAction = { id: `rec_${Date.now()}`, qword: 'ClickSaveButton', args: [], description: 'Click Save button', timestamp: Date.now(), type: 'sf-click-save' }; setActions(prev => [...prev, action]); toast.success('Added: Click Save'); }}>
                    <Save className="h-3 w-3 mr-1 text-green-400" />Save
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:border-blue-500/50 hover:bg-blue-500/5"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); const action: RecordedAction = { id: `rec_${Date.now()}`, qword: 'ClickEditButton', args: [], description: 'Click Edit button', timestamp: Date.now(), type: 'sf-click-edit' }; setActions(prev => [...prev, action]); toast.success('Added: Click Edit'); }}>
                    <PenLine className="h-3 w-3 mr-1 text-blue-400" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:border-red-500/50 hover:bg-red-500/5"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); const action: RecordedAction = { id: `rec_${Date.now()}`, qword: 'ClickDeleteButton', args: [], description: 'Click Delete button', timestamp: Date.now(), type: 'sf-click-delete' }; setActions(prev => [...prev, action]); toast.success('Added: Click Delete'); }}>
                    <Trash2 className="h-3 w-3 mr-1 text-red-400" />Delete
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:border-purple-500/50 hover:bg-purple-500/5"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); const action: RecordedAction = { id: `rec_${Date.now()}`, qword: 'ClickCloneButton', args: [], description: 'Click Clone button', timestamp: Date.now(), type: 'sf-click-clone' }; setActions(prev => [...prev, action]); toast.success('Added: Click Clone'); }}>
                    <Copy className="h-3 w-3 mr-1 text-purple-400" />Clone
                  </Button>
                </div>
              </div>

            </div>
          </ScrollArea>
        )}

      </div>
    </>
  );
}
