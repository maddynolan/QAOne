/**
 * SuggestionsTabContent - Suggestions panel showing page elements for test building.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Play, Plus, Search, Loader2, RefreshCw,
  Zap, Eye, CheckSquare, Lightbulb,
  Hand, PenLine, Link, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Suggestion, SuggestResult } from "@/modules/recorder/types/recorder.types";

interface SuggestionsTabContentProps {
  editingActionIndex: number | null;
  setEditingActionIndex: (idx: number | null) => void;
  setEditSelectorModalOpen: (open: boolean) => void;
  totalSuggestions: number;
  suggestResult: SuggestResult | null;
  isLoadingSuggestions: boolean;
  handleRefreshSuggestions: () => void;
  elementFilter: string;
  setElementFilter: (filter: string) => void;
  suggestionSearch: string;
  setSuggestionSearch: (search: string) => void;
  categoryCounts: { buttons: number; links: number; inputs: number; headings: number };
  executeAction: (s: Suggestion) => void;
  addToTest: (s: Suggestion) => void;
  replaceStepWithSuggestion: (idx: number, s: Suggestion) => void;
}

export default function SuggestionsTabContent({
  editingActionIndex,
  setEditingActionIndex,
  setEditSelectorModalOpen,
  totalSuggestions,
  suggestResult,
  isLoadingSuggestions,
  handleRefreshSuggestions,
  elementFilter,
  setElementFilter,
  suggestionSearch,
  setSuggestionSearch,
  categoryCounts,
  executeAction,
  addToTest,
  replaceStepWithSuggestion,
}: SuggestionsTabContentProps) {
  return (
    <>
      {/* REPLACE MODE BANNER - shown when fixing a step */}
      {editingActionIndex !== null && (
        <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/30 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium text-orange-400">
            Replace Mode: Click an element to replace Step {editingActionIndex + 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-[10px] text-orange-400 hover:bg-orange-500/20"
            onClick={() => {
              setEditingActionIndex(null);
              setEditSelectorModalOpen(false);
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Compact Header Row */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Suggested Actions</span>
          {totalSuggestions > 0 && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
              {totalSuggestions}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
            <CheckSquare className="h-3 w-3 mr-1" />
            All
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            <Eye className="h-3 w-3 mr-1" />
            Assert
          </Button>
          <Button
            onClick={handleRefreshSuggestions}
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            disabled={isLoadingSuggestions}
          >
            {isLoadingSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Category Filter & Search Row - Combined */}
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 flex-wrap sticky top-[42px] bg-card z-10">
        <div className="flex gap-1.5 flex-wrap">
          <Badge
            className={cn(
              "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
              elementFilter === 'buttons' ? "bg-emerald-500/30 border-emerald-500 text-emerald-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400/70"
            )}
            onClick={() => setElementFilter(elementFilter === 'buttons' ? 'all' : 'buttons')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
            Buttons {categoryCounts.buttons}
          </Badge>
          <Badge
            className={cn(
              "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
              elementFilter === 'links' ? "bg-blue-500/30 border-blue-500 text-blue-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400/70"
            )}
            onClick={() => setElementFilter(elementFilter === 'links' ? 'all' : 'links')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />
            Links {categoryCounts.links}
          </Badge>
          <Badge
            className={cn(
              "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
              elementFilter === 'inputs' ? "bg-purple-500/30 border-purple-500 text-purple-400" : "bg-purple-500/10 border-purple-500/30 text-purple-400/70"
            )}
            onClick={() => setElementFilter(elementFilter === 'inputs' ? 'all' : 'inputs')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1" />
            Inputs {categoryCounts.inputs}
          </Badge>
          <Badge
            className={cn(
              "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
              elementFilter === 'headings' ? "bg-warning/30 border-warning text-warning" : "bg-warning/10 border-warning/30 text-warning/70"
            )}
            onClick={() => setElementFilter(elementFilter === 'headings' ? 'all' : 'headings')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-warning mr-1" />
            Headings {categoryCounts.headings}
          </Badge>
        </div>
        <div className="flex-1 relative min-w-[120px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={suggestionSearch}
            onChange={(e) => setSuggestionSearch(e.target.value)}
            placeholder="Search..."
            className="pl-7 h-6 bg-input border-border text-foreground text-[10px]"
          />
        </div>
      </div>

      {/* Suggestions List - Scrollable, fills remaining space */}
      <div className="flex-1 overflow-auto">
        <div className="p-2 min-h-full">
        {isLoadingSuggestions && !suggestResult?.suggestions?.length && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-xs mt-2 text-muted-foreground">Analyzing page...</p>
          </div>
        )}

        {suggestResult?.suggestions && suggestResult.suggestions.length > 0 && (
          <div className="space-y-1.5">
            {/* Filter suggestions based on elementFilter and search */}
            {suggestResult.suggestions
              .filter(s => {
                // Apply category filter
                if (elementFilter === 'buttons' && s.category !== 'button') return false;
                if (elementFilter === 'links' && s.category !== 'link') return false;
                if (elementFilter === 'inputs' && s.category !== 'input') return false;
                if (elementFilter === 'headings' && s.category !== 'heading') return false;
                // Apply search filter
                if (suggestionSearch.trim()) {
                  const query = suggestionSearch.toLowerCase();
                  const text = (s.element || s.description || s.args?.[0] || '').toLowerCase();
                  if (!text.includes(query)) return false;
                }
                return true;
              })
              .map((s, i) => (
                <div
                  key={`${s.element}-${i}`}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary hover:bg-accent border border-transparent hover:border-primary/20 group transition-colors"
                >
                  {/* Icon based on category */}
                  <div className={cn(
                    "p-1.5 rounded shrink-0",
                    s.category === 'input' && 'bg-purple-500/20 text-purple-400',
                    s.category === 'link' && 'bg-blue-500/20 text-blue-400',
                    s.category === 'heading' && 'bg-warning/20 text-warning',
                    s.category === 'button' && 'bg-emerald-500/20 text-emerald-400',
                    !['input', 'link', 'heading', 'button'].includes(s.category || '') && 'bg-muted/20 text-muted-foreground'
                  )}>
                    {s.category === 'input' ? <PenLine className="h-3.5 w-3.5" /> :
                     s.category === 'link' ? <Link className="h-3.5 w-3.5" /> :
                     s.category === 'heading' ? <Type className="h-3.5 w-3.5" /> :
                     <Hand className="h-3.5 w-3.5" />}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate font-medium">{s.element || s.description || s.args?.[0] || 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{s.qword || s.type || s.category}</p>
                  </div>

                  {/* Action buttons - always visible on mobile, hover on desktop */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={() => executeAction(s)}
                    title={s.category === 'input' ? 'Click to highlight input on page' : 'Execute action on page'}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                  {/* Show REPLACE button when fixing a step, otherwise show ADD button */}
                  {editingActionIndex !== null ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      onClick={() => replaceStepWithSuggestion(editingActionIndex, s)}
                      title={`Replace step ${editingActionIndex + 1} with this element`}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      onClick={() => addToTest(s)}
                      title={s.category === 'input' ? 'Add fill step (will prompt for value)' : 'Add to test steps'}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}

            {/* Show message if filter results in no items */}
            {suggestResult.suggestions.filter(s => {
              if (elementFilter === 'buttons' && s.category !== 'button') return false;
              if (elementFilter === 'links' && s.category !== 'link') return false;
              if (elementFilter === 'inputs' && s.category !== 'input') return false;
              if (elementFilter === 'headings' && s.category !== 'heading') return false;
              if (suggestionSearch.trim()) {
                const query = suggestionSearch.toLowerCase();
                const text = (s.element || s.description || '').toLowerCase();
                if (!text.includes(query)) return false;
              }
              return true;
            }).length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-xs">No {elementFilter !== 'all' ? elementFilter : 'elements'} match{suggestionSearch ? ` "${suggestionSearch}"` : ''}</p>
                <Button
                  onClick={() => { setElementFilter('all'); setSuggestionSearch(''); }}
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs text-muted-foreground"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}

        {!isLoadingSuggestions && (!suggestResult?.suggestions || suggestResult.suggestions.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No suggestions yet</p>
            <p className="text-xs mt-1">Start recording to see page elements</p>
            <Button
              onClick={handleRefreshSuggestions}
              variant="outline"
              size="sm"
              className="mt-4 text-xs border-primary/30 text-primary"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Analyze Page
            </Button>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
