/**
 * DesktopRequiredCard - Shown when the recorder is accessed outside Electron.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Download, MousePointer, Sparkles, Cloud, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export default function DesktopRequiredCard() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <Card className="max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
              <Download className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-foreground">Desktop App Required</h2>
            <p className="text-muted-foreground mb-6">
              The Smart Recorder requires the Flowstral Desktop app for browser automation capabilities.
            </p>

            {/* Steps */}
            <div className="text-left space-y-4 mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Quick Setup</h3>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                <div>
                  <p className="text-sm font-medium text-foreground">Download Flowstral Desktop</p>
                  <p className="text-xs text-muted-foreground">One-click installer with bundled browser</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                <div>
                  <p className="text-sm font-medium text-foreground">Install & Sign In</p>
                  <p className="text-xs text-muted-foreground">Use your existing account credentials</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                <div>
                  <p className="text-sm font-medium text-foreground">Click Record</p>
                  <p className="text-xs text-muted-foreground">Browser launches automatically, start recording!</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-3 mb-8 text-left">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/30">
                <MousePointer className="w-4 h-4 text-amber-600 mb-1" />
                <p className="text-xs font-medium text-foreground">Smart Element Recognition</p>
              </div>
              <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-800/30">
                <Sparkles className="w-4 h-4 text-violet-600 mb-1" />
                <p className="text-xs font-medium text-foreground">41+ Auto Suggestions</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                <Cloud className="w-4 h-4 text-emerald-600 mb-1" />
                <p className="text-xs font-medium text-foreground">Salesforce Metadata Aware</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                <Wand2 className="w-4 h-4 text-blue-600 mb-1" />
                <p className="text-xs font-medium text-foreground">One-Click Test Creation</p>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={() => navigate('/welcome')}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Desktop App
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Available for Windows, macOS & Linux
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
