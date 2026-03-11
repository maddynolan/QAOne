/**
 * Blackbox Locator Strategies Component
 * 
 * When standard selectors fail, provide alternative strategies for 
 * locating elements in blackbox/third-party applications.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Image,
  Type,
  Target,
  Sparkles,
  Camera,
  Move,
  Eye,
  Crosshair,
  Check,
  Copy,
  Zap,
  Info,
  ChevronRight,
  HelpCircle,
  Trash2,
  MousePointer,
  X
} from 'lucide-react';

// Blackbox locator types
export type BlackboxLocatorType = 
  | 'image'        // Image template matching
  | 'ocr_text'     // OCR text detection
  | 'coordinates'  // Fixed X,Y coordinates
  | 'relative'     // Relative to another element
  | 'ai_detect'    // AI-powered detection
  | 'region_click' // Click within a region
  | 'color_match'  // Color-based detection
  ;

export interface BlackboxLocator {
  type: BlackboxLocatorType;
  imageTemplate?: string;
  confidence?: number;
  searchText?: string;
  caseSensitive?: boolean;
  occurrence?: number;      // Which occurrence to click (1st, 2nd, 3rd, etc.)
  x?: number;
  y?: number;
  anchorSelector?: string;
  offsetX?: number;
  offsetY?: number;
  direction?: 'left' | 'right' | 'above' | 'below';
  regionX?: number;
  regionY?: number;
  regionWidth?: number;
  regionHeight?: number;
  aiPrompt?: string;
  elementDescription?: string;
  targetColor?: string;
  colorTolerance?: number;
}

interface BlackboxLocatorStrategiesProps {
  onLocatorSelected: (locator: BlackboxLocator, generatedCode: string) => void;
  onClear?: () => void;  // Callback to remove/clear the fallback
  framework: string;
  currentScreenshot?: string;
  hasAppliedFallback?: boolean;  // Whether a fallback is currently applied
}

interface StrategyConfig {
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
  reliability: 'High' | 'Medium-High' | 'Medium' | 'Low';
  color: string;
  bgColor: string;
  useCase: string;
  howToFind: string[];  // Instructions on how to find the values
}

const STRATEGY_INFO: Record<BlackboxLocatorType, StrategyConfig> = {
  ocr_text: {
    label: 'OCR Text Detection',
    shortLabel: 'OCR',
    icon: Type,
    description: 'Find element by visible text using optical character recognition',
    reliability: 'High',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
    useCase: 'Best for buttons, labels, and any visible text',
    howToFind: [
      'Look at the screen and identify the exact text',
      'If text appears multiple times, select which occurrence (1st, 2nd, etc.)',
      'For "Cancer" checkbox, it\'s the 4th occurrence since "cancer" appears in header too'
    ]
  },
  image: {
    label: 'Image Template',
    shortLabel: 'Image',
    icon: Image,
    description: 'Match a screenshot template to find the element',
    reliability: 'Medium',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',
    useCase: 'Good for icons, logos, or unique visual elements',
    howToFind: [
      'Use snipping tool (Win+Shift+S) to capture the element',
      'Save as PNG and upload, or use Capture button',
      'Keep image small - just the element, not surrounding area'
    ]
  },
  coordinates: {
    label: 'Fixed Coordinates',
    shortLabel: 'Fixed',
    icon: Crosshair,
    description: 'Click at exact X,Y screen position',
    reliability: 'Low',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20',
    useCase: 'Last resort - breaks easily with layout changes',
    howToFind: [
      '1. Press F12 to open DevTools',
      '2. Click the element selector (arrow icon)',
      '3. Hover over element - coordinates show in tooltip',
      'Or: Use Paint/Screenshot tool with ruler/coordinates'
    ]
  },
  relative: {
    label: 'Relative Position',
    shortLabel: 'Relative',
    icon: Move,
    description: 'Position relative to a known anchor element',
    reliability: 'Medium-High',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20',
    useCase: 'When target is always near a stable element',
    howToFind: [
      '1. Find a stable element near your target (logo, header, etc.)',
      '2. Right-click > Inspect to get its CSS selector',
      '3. Measure pixel distance: target position minus anchor position',
      'Tip: Use DevTools "Elements" panel to see bounding boxes'
    ]
  },
  ai_detect: {
    label: 'AI Detection',
    shortLabel: 'AI',
    icon: Sparkles,
    description: 'Use AI vision to find element by description',
    reliability: 'High',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
    useCase: 'Complex elements that are hard to describe',
    howToFind: [
      'Describe the element as you would to a person',
      'Include: color, size, position, nearby elements',
      'Example: "The unchecked checkbox next to the word Cancer in the medical conditions list"'
    ]
  },
  region_click: {
    label: 'Region Click',
    shortLabel: 'Region',
    icon: Target,
    description: 'Click within a defined screen region',
    reliability: 'Medium',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20',
    useCase: 'When element moves slightly within an area',
    howToFind: [
      '1. Take a screenshot and open in Paint/image editor',
      '2. Note the X,Y of top-left corner of the region',
      '3. Measure width and height of the region',
      'Keep region small but large enough for element movement'
    ]
  },
  color_match: {
    label: 'Color Match',
    shortLabel: 'Color',
    icon: Eye,
    description: 'Find element by its unique color',
    reliability: 'Low',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 border-pink-500/30 hover:bg-pink-500/20',
    useCase: 'Colored buttons or indicators',
    howToFind: [
      '1. Take screenshot and open in Paint/image editor',
      '2. Use color picker tool on the element',
      '3. Note the hex color code (e.g., #FF5722)',
      'Or: Use browser DevTools > Computed styles > background-color'
    ]
  }
};

const RELIABILITY_STYLES = {
  'High': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  'Medium-High': 'bg-lime-500/20 text-lime-700 dark:text-lime-400 border-lime-500/30',
  'Medium': 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'Low': 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30'
};

export function BlackboxLocatorStrategies({
  onLocatorSelected,
  onClear,
  framework,
  hasAppliedFallback
}: BlackboxLocatorStrategiesProps) {
  const { toast } = useToast();
  
  const [selectedStrategy, setSelectedStrategy] = useState<BlackboxLocatorType>('ocr_text');
  const [locator, setLocator] = useState<BlackboxLocator>({
    type: 'ocr_text',
    confidence: 0.8,
    caseSensitive: false,
    colorTolerance: 10,
    occurrence: 1  // Default to 1st occurrence
  });
  const [codeCopied, setCodeCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const generateCode = useCallback((loc: BlackboxLocator): string => {
    const isPython = framework.includes('python');
    
    switch (loc.type) {
      case 'ocr_text':
        if (isPython) {
          return `# OCR Text-based click (requires pytesseract)
import pytesseract
from PIL import Image
import pyautogui

screenshot = pyautogui.screenshot()
text_data = pytesseract.image_to_data(screenshot, output_type=pytesseract.Output.DICT)

# Find "${loc.searchText || 'Button Text'}" - ${loc.occurrence || 1}${loc.occurrence === 1 ? 'st' : loc.occurrence === 2 ? 'nd' : loc.occurrence === 3 ? 'rd' : 'th'} occurrence
target = "${loc.searchText || 'Button Text'}"
occurrence = ${loc.occurrence || 1}
found_count = 0

for i, text in enumerate(text_data['text']):
    if ${loc.caseSensitive ? 'target in text' : 'target.lower() in text.lower()'}:
        found_count += 1
        if found_count == occurrence:
            x = text_data['left'][i] + text_data['width'][i] // 2
            y = text_data['top'][i] + text_data['height'][i] // 2
            pyautogui.click(x, y)
            break`;
        }
        return `// OCR Text-based click (requires Tesseract.js)`;

      case 'coordinates':
        return isPython 
          ? `# Fixed coordinate click
import pyautogui

# Click at (${loc.x || 100}, ${loc.y || 100})
pyautogui.click(${loc.x || 100}, ${loc.y || 100})`
          : `// Fixed coordinate click
await page.mouse.click(${loc.x || 100}, ${loc.y || 100});`;

      case 'relative':
        return isPython
          ? `# Relative position click
# Anchor: "${loc.anchorSelector || '#anchor'}"
# Direction: ${loc.direction || 'right'}, Offset: ${Math.abs(loc.offsetX || loc.offsetY || 50)}px

anchor = page.locator("${loc.anchorSelector || '#anchor'}")
box = anchor.bounding_box()
target_x = box['x'] ${loc.direction === 'left' ? '-' : '+'} ${Math.abs(loc.offsetX || 50)}
target_y = box['y'] ${loc.direction === 'above' ? '-' : '+'} ${Math.abs(loc.offsetY || 0)}
page.mouse.click(target_x, target_y)`
          : `// Relative position click
const box = await page.locator("${loc.anchorSelector || '#anchor'}").boundingBox();
await page.mouse.click(box.x ${loc.direction === 'left' ? '-' : '+'} ${Math.abs(loc.offsetX || 50)}, box.y);`;

      case 'image':
        return isPython
          ? `# Image template matching
import pyautogui

# Confidence: ${((loc.confidence || 0.8) * 100).toFixed(0)}%
location = pyautogui.locateOnScreen('template.png', confidence=${loc.confidence || 0.8})
if location:
    pyautogui.click(pyautogui.center(location))`
          : `// Image template matching`;

      case 'ai_detect':
        return isPython
          ? `# AI-powered element detection
# Description: "${loc.elementDescription || 'the submit button'}"

from openai import OpenAI
import base64

page.screenshot(path='screen.png')
client = OpenAI()

with open('screen.png', 'rb') as f:
    img = base64.b64encode(f.read()).decode()

response = client.chat.completions.create(
    model="gpt-4-vision-preview",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Find '${loc.elementDescription || 'the submit button'}'. Return JSON: {x, y}"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img}"}}
        ]
    }]
)`
          : `// AI-powered detection`;

      case 'region_click':
        const cx = (loc.regionX || 100) + (loc.regionWidth || 200) / 2;
        const cy = (loc.regionY || 100) + (loc.regionHeight || 50) / 2;
        return isPython
          ? `# Region center click
# Region: (${loc.regionX || 100}, ${loc.regionY || 100}) size ${loc.regionWidth || 200}x${loc.regionHeight || 50}
import pyautogui
pyautogui.click(${cx.toFixed(0)}, ${cy.toFixed(0)})`
          : `// Region center click
await page.mouse.click(${cx.toFixed(0)}, ${cy.toFixed(0)});`;

      case 'color_match':
        return isPython
          ? `# Color-based detection
# Target: ${loc.targetColor || '#FF0000'}, Tolerance: ${loc.colorTolerance || 10}
import pyautogui
from PIL import Image

screenshot = pyautogui.screenshot()
target = (${parseInt((loc.targetColor || '#FF0000').slice(1, 3), 16)}, ${parseInt((loc.targetColor || '#FF0000').slice(3, 5), 16)}, ${parseInt((loc.targetColor || '#FF0000').slice(5, 7), 16)})
tolerance = ${loc.colorTolerance || 10}

pixels = screenshot.load()
for y in range(screenshot.height):
    for x in range(screenshot.width):
        r, g, b = pixels[x, y][:3]
        if all(abs(a-b) < tolerance for a, b in zip((r,g,b), target)):
            pyautogui.click(x, y)
            break`
          : `// Color-based detection`;

      default:
        return '# Unknown locator type';
    }
  }, [framework]);

  const applyLocator = () => {
    const code = generateCode(locator);
    onLocatorSelected(locator, code);
    toast({
      title: 'Fallback strategy applied',
      description: `Using ${STRATEGY_INFO[locator.type].label}`
    });
  };

  const clearFallback = () => {
    if (onClear) {
      onClear();
      toast({
        title: 'Fallback removed',
        description: 'Using standard selector strategy'
      });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generateCode(locator));
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const updateLocator = (updates: Partial<BlackboxLocator>) => {
    setLocator(prev => ({ ...prev, ...updates }));
  };

  const info = STRATEGY_INFO[selectedStrategy];
  const IconComponent = info.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Header with Clear button */}
      {hasAppliedFallback && onClear && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
          <span className="text-sm text-amber-700 dark:text-amber-400">
            Fallback strategy is active
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFallback}
            className="h-7 text-red-700 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remove Fallback
          </Button>
        </div>
      )}

      {/* Strategy Selection */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Select Strategy</h3>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(STRATEGY_INFO) as BlackboxLocatorType[]).map(type => {
            const s = STRATEGY_INFO[type];
            const Icon = s.icon;
            const isSelected = selectedStrategy === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setSelectedStrategy(type);
                  updateLocator({ type });
                }}
                className={`
                  flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                  ${isSelected 
                    ? `${s.bgColor} border-current ${s.color}` 
                    : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'}
                `}
              >
                <Icon className="h-5 w-5 mb-1.5" />
                <span className="text-xs font-medium">{s.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Strategy Info */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${info.bgColor} ${info.color}`}>
            <IconComponent className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-foreground">{info.label}</h4>
              <Badge className={`text-xs ${RELIABILITY_STYLES[info.reliability]}`}>
                {info.reliability}
              </Badge>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">{info.description}</p>
          </div>
        </div>

        {/* How to Find Values - Help Section */}
        {showHelp && (
          <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">How to Find Values</span>
            </div>
            <ol className="text-xs text-blue-300/80 space-y-1.5">
              {info.howToFind.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-400 font-medium">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {selectedStrategy === 'ocr_text' && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Text to Find</Label>
                <Input
                  value={locator.searchText || ''}
                  onChange={(e) => updateLocator({ searchText: e.target.value })}
                  placeholder="e.g., Cancer, Submit, Save"
                  className="bg-background border-input"
                />
              </div>
              
              {/* NEW: Occurrence selector for multiple matches */}
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">
                  Which occurrence? 
                  <span className="text-muted-foreground/60 ml-1">(if text appears multiple times)</span>
                </Label>
                <Select
                  value={String(locator.occurrence || 1)}
                  onValueChange={(v) => updateLocator({ occurrence: parseInt(v) })}
                >
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st occurrence (first match)</SelectItem>
                    <SelectItem value="2">2nd occurrence</SelectItem>
                    <SelectItem value="3">3rd occurrence</SelectItem>
                    <SelectItem value="4">4th occurrence</SelectItem>
                    <SelectItem value="5">5th occurrence</SelectItem>
                    <SelectItem value="-1">Last occurrence</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  💡 For "Cancer" checkbox: Try 2nd or 3rd occurrence if first one is in header text
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locator.caseSensitive}
                  onChange={(e) => updateLocator({ caseSensitive: e.target.checked })}
                  className="rounded border-input bg-background"
                />
                <span className="text-sm text-muted-foreground">Case sensitive matching</span>
              </label>
            </div>
          )}

          {selectedStrategy === 'coordinates' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-2 font-medium">📍 How to find coordinates:</p>
                <ol className="text-xs text-blue-300/80 space-y-1">
                  <li>1. Press <kbd className="px-1 py-0.5 bg-muted rounded text-foreground">F12</kbd> to open DevTools</li>
                  <li>2. Click the element selector tool (⬆️ arrow icon)</li>
                  <li>3. Hover over your element - see coordinates in tooltip</li>
                  <li>4. Or right-click element → Copy → Copy element coordinates</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">X Position (pixels)</Label>
                  <Input
                    type="number"
                    value={locator.x || ''}
                    onChange={(e) => updateLocator({ x: parseInt(e.target.value) })}
                    placeholder="100"
                    className="bg-background border-input"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Y Position (pixels)</Label>
                  <Input
                    type="number"
                    value={locator.y || ''}
                    onChange={(e) => updateLocator({ y: parseInt(e.target.value) })}
                    placeholder="200"
                    className="bg-background border-input"
                  />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">
                  ⚠️ Fixed coordinates break when window size or layout changes. Use only as last resort.
                </p>
              </div>
            </div>
          )}

          {selectedStrategy === 'relative' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-2 font-medium">🎯 How to find anchor & offset:</p>
                <ol className="text-xs text-blue-300/80 space-y-1">
                  <li>1. Find a stable element near your target (logo, header, label)</li>
                  <li>2. Right-click → Inspect → Copy → Copy selector</li>
                  <li>3. For offset: Count pixels from anchor to target</li>
                  <li>4. Use DevTools ruler or screenshot with grid</li>
                </ol>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Anchor Element (CSS Selector)</Label>
                <Input
                  value={locator.anchorSelector || ''}
                  onChange={(e) => updateLocator({ anchorSelector: e.target.value })}
                  placeholder="#logo, .page-header, [data-testid='nav']"
                  className="bg-background border-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Direction from Anchor</Label>
                  <Select
                    value={locator.direction || 'right'}
                    onValueChange={(v) => updateLocator({ direction: v as any })}
                  >
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right">→ Right of anchor</SelectItem>
                      <SelectItem value="left">← Left of anchor</SelectItem>
                      <SelectItem value="below">↓ Below anchor</SelectItem>
                      <SelectItem value="above">↑ Above anchor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Distance (pixels)</Label>
                  <Input
                    type="number"
                    value={locator.offsetX || locator.offsetY || 50}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (locator.direction === 'left' || locator.direction === 'right') {
                        updateLocator({ offsetX: val, offsetY: 0 });
                      } else {
                        updateLocator({ offsetX: 0, offsetY: val });
                      }
                    }}
                    className="bg-background border-input"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedStrategy === 'image' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-2 font-medium">🖼️ How to capture image template:</p>
                <ol className="text-xs text-blue-300/80 space-y-1">
                  <li>1. Press <kbd className="px-1 py-0.5 bg-muted rounded text-foreground">Win+Shift+S</kbd> (Windows Snip)</li>
                  <li>2. Select ONLY the element you want to match</li>
                  <li>3. Save as PNG file</li>
                  <li>4. Upload using the button below</li>
                </ol>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">
                  Match Confidence: {((locator.confidence || 0.8) * 100).toFixed(0)}%
                </Label>
                <Slider
                  value={[locator.confidence || 0.8]}
                  onValueChange={([v]) => updateLocator({ confidence: v })}
                  min={0.5}
                  max={1}
                  step={0.05}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  80% recommended. Lower = more flexible, Higher = stricter
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline">
                  <Camera className="h-4 w-4 mr-2" />
                  Capture
                </Button>
                <Button variant="outline">
                  <Image className="h-4 w-4 mr-2" />
                  Upload PNG
                </Button>
              </div>
            </div>
          )}

          {selectedStrategy === 'ai_detect' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-2 font-medium">🤖 Tips for good AI descriptions:</p>
                <ul className="text-xs text-blue-300/80 space-y-1 list-disc list-inside">
                  <li>Be specific: "The checkbox next to 'Cancer' text"</li>
                  <li>Include position: "in the medical conditions list"</li>
                  <li>Mention visual cues: "unchecked square box"</li>
                </ul>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Describe the Element</Label>
                <Textarea
                  value={locator.elementDescription || ''}
                  onChange={(e) => updateLocator({ elementDescription: e.target.value })}
                  placeholder="e.g., The unchecked checkbox next to the word 'Cancer' in the medical conditions list, below 'Brain injury'"
                  rows={4}
                  className="bg-background border-input resize-none"
                />
              </div>
            </div>
          )}

          {selectedStrategy === 'region_click' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-2 font-medium">📐 How to define a region:</p>
                <ol className="text-xs text-blue-300/80 space-y-1">
                  <li>1. Take screenshot of the page</li>
                  <li>2. Open in Paint or image editor</li>
                  <li>3. Note X,Y of top-left corner where element could be</li>
                  <li>4. Measure width and height that covers element</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Start X</Label>
                  <Input
                    type="number"
                    value={locator.regionX || ''}
                    onChange={(e) => updateLocator({ regionX: parseInt(e.target.value) })}
                    placeholder="100"
                    className="bg-background border-input"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Start Y</Label>
                  <Input
                    type="number"
                    value={locator.regionY || ''}
                    onChange={(e) => updateLocator({ regionY: parseInt(e.target.value) })}
                    placeholder="100"
                    className="bg-background border-input"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Width</Label>
                  <Input
                    type="number"
                    value={locator.regionWidth || ''}
                    onChange={(e) => updateLocator({ regionWidth: parseInt(e.target.value) })}
                    placeholder="200"
                    className="bg-background border-input"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Height</Label>
                  <Input
                    type="number"
                    value={locator.regionHeight || ''}
                    onChange={(e) => updateLocator({ regionHeight: parseInt(e.target.value) })}
                    placeholder="50"
                    className="bg-background border-input"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedStrategy === 'color_match' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-2 font-medium">🎨 How to find a color:</p>
                <ol className="text-xs text-blue-300/80 space-y-1">
                  <li>1. Press F12 → Select element → Computed tab</li>
                  <li>2. Find "background-color" or "color"</li>
                  <li>3. Copy the hex value (e.g., #4CAF50)</li>
                  <li>4. Or use browser extension like ColorZilla</li>
                </ol>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Target Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={locator.targetColor || '#FF0000'}
                    onChange={(e) => updateLocator({ targetColor: e.target.value })}
                    className="w-12 h-10 rounded border border-input cursor-pointer bg-transparent"
                  />
                  <Input
                    value={locator.targetColor || '#FF0000'}
                    onChange={(e) => updateLocator({ targetColor: e.target.value })}
                    placeholder="#FF0000"
                    className="bg-background border-input flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">
                  Color Tolerance: {locator.colorTolerance || 10}
                </Label>
                <Slider
                  value={[locator.colorTolerance || 10]}
                  onValueChange={([v]) => updateLocator({ colorTolerance: v })}
                  min={0}
                  max={50}
                  step={1}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher tolerance = matches similar colors too
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Code Preview & Apply */}
      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">Generated Code</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-7 text-xs"
          >
            {codeCopied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {codeCopied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="p-3 bg-muted rounded-lg text-xs text-emerald-700 dark:text-emerald-400 overflow-x-auto max-h-32 font-mono">
          {generateCode(locator)}
        </pre>
        <Button 
          onClick={applyLocator} 
          className={`w-full ${info.bgColor} ${info.color} border hover:opacity-90`}
        >
          <Zap className="h-4 w-4 mr-2" />
          Apply {info.label}
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>
      </div>
    </div>
  );
}

export default BlackboxLocatorStrategies;
