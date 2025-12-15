/**
 * Blackbox Locator Strategies Component
 * 
 * When standard selectors fail, provide alternative strategies for 
 * locating elements in blackbox/third-party applications:
 * 
 * 1. Visual/Image-based locators (OCR + Image matching)
 * 2. Coordinate-based clicking (X,Y positions)
 * 3. Relative positioning (to known elements)
 * 4. Text-based OCR detection
 * 5. AI-powered element detection
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  Image,
  MousePointer,
  Type,
  Target,
  Sparkles,
  Camera,
  Move,
  Eye,
  Crosshair,
  AlertTriangle,
  Info,
  Wand2
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
  // Image-based
  imageTemplate?: string;  // Base64 or path
  confidence?: number;     // 0-1 match confidence
  // OCR
  searchText?: string;
  caseSensitive?: boolean;
  // Coordinates
  x?: number;
  y?: number;
  // Relative
  anchorSelector?: string;
  offsetX?: number;
  offsetY?: number;
  direction?: 'left' | 'right' | 'above' | 'below';
  // Region
  regionX?: number;
  regionY?: number;
  regionWidth?: number;
  regionHeight?: number;
  // AI
  aiPrompt?: string;
  elementDescription?: string;
  // Color
  targetColor?: string;
  colorTolerance?: number;
}

interface BlackboxLocatorStrategiesProps {
  onLocatorSelected: (locator: BlackboxLocator, generatedCode: string) => void;
  framework: string;  // playwright-python, etc.
  currentScreenshot?: string;  // Base64 screenshot for reference
}

const STRATEGY_INFO = {
  image: {
    label: 'Image Matching',
    icon: Image,
    description: 'Find element by matching a screenshot template',
    reliability: 'Medium',
    pros: ['Works with any UI', 'Visual accuracy'],
    cons: ['Breaks with UI changes', 'Resolution dependent']
  },
  ocr_text: {
    label: 'OCR Text Detection',
    icon: Type,
    description: 'Find element by visible text using OCR',
    reliability: 'High',
    pros: ['Language-based', 'Readable tests'],
    cons: ['Requires clear text', 'Slow']
  },
  coordinates: {
    label: 'Fixed Coordinates',
    icon: Crosshair,
    description: 'Click at specific X,Y screen position',
    reliability: 'Low',
    pros: ['Always works', 'Simple'],
    cons: ['Breaks with layout changes', 'Not portable']
  },
  relative: {
    label: 'Relative Position',
    icon: Move,
    description: 'Position relative to a known anchor element',
    reliability: 'Medium-High',
    pros: ['More resilient', 'Adapts to layout'],
    cons: ['Needs anchor element']
  },
  ai_detect: {
    label: 'AI Detection',
    icon: Sparkles,
    description: 'Use AI to find element by description',
    reliability: 'High',
    pros: ['Most flexible', 'Natural language'],
    cons: ['Slower', 'API costs']
  },
  region_click: {
    label: 'Region Click',
    icon: Target,
    description: 'Click within a defined screen region',
    reliability: 'Medium',
    pros: ['Flexible within region', 'Fault tolerant'],
    cons: ['Less precise']
  },
  color_match: {
    label: 'Color Matching',
    icon: Eye,
    description: 'Find element by its color',
    reliability: 'Low-Medium',
    pros: ['Works for colored buttons', 'No text needed'],
    cons: ['Theme dependent', 'Color blind issues']
  }
};

export function BlackboxLocatorStrategies({
  onLocatorSelected,
  framework,
  currentScreenshot
}: BlackboxLocatorStrategiesProps) {
  const { toast } = useToast();
  
  const [selectedStrategy, setSelectedStrategy] = useState<BlackboxLocatorType>('ocr_text');
  const [locator, setLocator] = useState<BlackboxLocator>({
    type: 'ocr_text',
    confidence: 0.8,
    caseSensitive: false,
    colorTolerance: 10
  });

  // Generate Playwright code for the blackbox locator
  const generateCode = useCallback((loc: BlackboxLocator): string => {
    const isPython = framework.includes('python');
    
    switch (loc.type) {
      case 'ocr_text':
        if (isPython) {
          return `# OCR Text-based click (requires pytesseract)
import pytesseract
from PIL import Image
import pyautogui

# Take screenshot and find text
screenshot = pyautogui.screenshot()
text_locations = pytesseract.image_to_data(screenshot, output_type=pytesseract.Output.DICT)

# Find the target text
target_text = "${loc.searchText || 'Button Text'}"
for i, text in enumerate(text_locations['text']):
    if ${loc.caseSensitive ? 'text == target_text' : 'text.lower() == target_text.lower()'}:
        x = text_locations['left'][i] + text_locations['width'][i] // 2
        y = text_locations['top'][i] + text_locations['height'][i] // 2
        pyautogui.click(x, y)
        break`;
        }
        return `// OCR Text-based click (requires Tesseract.js)
const Tesseract = require('tesseract.js');
// ... implementation`;

      case 'coordinates':
        if (isPython) {
          return `# Fixed coordinate click (use with caution - fragile)
import pyautogui

# Click at fixed coordinates
pyautogui.click(${loc.x || 100}, ${loc.y || 100})

# Alternative: Use Playwright's page.mouse
# page.mouse.click(${loc.x || 100}, ${loc.y || 100})`;
        }
        return `// Fixed coordinate click
await page.mouse.click(${loc.x || 100}, ${loc.y || 100});`;

      case 'relative':
        if (isPython) {
          return `# Relative position click (relative to anchor element)
# Find the anchor element first
anchor = page.locator("${loc.anchorSelector || '#known-element'}")
anchor_box = anchor.bounding_box()

# Calculate relative position
target_x = anchor_box['x'] ${loc.direction === 'left' ? '-' : '+'} ${Math.abs(loc.offsetX || 50)}
target_y = anchor_box['y'] ${loc.direction === 'above' ? '-' : '+'} ${Math.abs(loc.offsetY || 0)}

# Click at calculated position
page.mouse.click(target_x, target_y)`;
        }
        return `// Relative position click
const anchor = page.locator("${loc.anchorSelector || '#known-element'}");
const box = await anchor.boundingBox();
await page.mouse.click(box.x ${loc.direction === 'left' ? '-' : '+'} ${Math.abs(loc.offsetX || 50)}, box.y ${loc.direction === 'above' ? '-' : '+'} ${Math.abs(loc.offsetY || 0)});`;

      case 'image':
        if (isPython) {
          return `# Image template matching click (requires pyautogui + opencv)
import pyautogui

# Find image on screen (save template as 'button_template.png')
location = pyautogui.locateOnScreen('button_template.png', confidence=${loc.confidence || 0.8})

if location:
    center = pyautogui.center(location)
    pyautogui.click(center)
else:
    raise Exception("Image template not found on screen")`;
        }
        return `// Image template matching (requires additional setup)
// Use a visual testing library like pixelmatch`;

      case 'ai_detect':
        if (isPython) {
          return `# AI-powered element detection
# Uses GPT-4 Vision or similar to find element by description

import base64
from openai import OpenAI

# Take screenshot
page.screenshot(path='current_screen.png')

# Ask AI to find element
client = OpenAI()
with open('current_screen.png', 'rb') as f:
    image_data = base64.b64encode(f.read()).decode()

response = client.chat.completions.create(
    model="gpt-4-vision-preview",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Find the ${loc.elementDescription || 'submit button'} in this screenshot. Return the approximate x,y coordinates as JSON: {x: number, y: number}"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_data}"}}
        ]
    }]
)

# Parse coordinates and click
import json
coords = json.loads(response.choices[0].message.content)
page.mouse.click(coords['x'], coords['y'])`;
        }
        return `// AI-powered element detection
// Implementation depends on AI service used`;

      case 'region_click':
        if (isPython) {
          return `# Region-based click (click center of a defined region)
import pyautogui
import random

# Define the region where the element should be
region_x = ${loc.regionX || 100}
region_y = ${loc.regionY || 100}
region_width = ${loc.regionWidth || 200}
region_height = ${loc.regionHeight || 50}

# Click center of region (or random point for variation)
center_x = region_x + region_width // 2
center_y = region_y + region_height // 2

# Option: Add small random offset for more realistic clicks
# center_x += random.randint(-10, 10)
# center_y += random.randint(-5, 5)

pyautogui.click(center_x, center_y)`;
        }
        return `// Region-based click
await page.mouse.click(${(loc.regionX || 100) + (loc.regionWidth || 200) / 2}, ${(loc.regionY || 100) + (loc.regionHeight || 50) / 2});`;

      case 'color_match':
        if (isPython) {
          return `# Color-based element detection
import pyautogui
from PIL import Image

# Take screenshot
screenshot = pyautogui.screenshot()

# Target color (RGB)
target_color = (${parseInt((loc.targetColor || '#FF0000').slice(1, 3), 16)}, ${parseInt((loc.targetColor || '#FF0000').slice(3, 5), 16)}, ${parseInt((loc.targetColor || '#FF0000').slice(5, 7), 16)})
tolerance = ${loc.colorTolerance || 10}

# Find pixels matching the color
pixels = screenshot.load()
width, height = screenshot.size

for y in range(height):
    for x in range(width):
        r, g, b = pixels[x, y][:3]
        if (abs(r - target_color[0]) < tolerance and 
            abs(g - target_color[1]) < tolerance and 
            abs(b - target_color[2]) < tolerance):
            pyautogui.click(x, y)
            break
    else:
        continue
    break`;
        }
        return `// Color-based detection
// Requires image processing library`;

      default:
        return '# Unknown locator type';
    }
  }, [framework]);

  // Apply the current locator
  const applyLocator = () => {
    const code = generateCode(locator);
    onLocatorSelected(locator, code);
    toast({
      title: 'Blackbox locator applied',
      description: `Using ${STRATEGY_INFO[locator.type].label} strategy`
    });
  };

  const updateLocator = (updates: Partial<BlackboxLocator>) => {
    setLocator(prev => ({ ...prev, ...updates }));
  };

  const strategyInfo = STRATEGY_INFO[selectedStrategy];

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Blackbox Fallback Strategies</CardTitle>
          </div>
          <Badge variant="outline" className="bg-orange-100 text-orange-700">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Last Resort
          </Badge>
        </div>
        <CardDescription>
          When standard selectors fail, use these strategies for blackbox/third-party apps
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Strategy Selection */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(STRATEGY_INFO) as BlackboxLocatorType[]).map(type => {
            const info = STRATEGY_INFO[type];
            const IconComponent = info.icon;
            return (
              <Button
                key={type}
                variant={selectedStrategy === type ? 'default' : 'outline'}
                className="flex flex-col h-auto py-2 px-2"
                onClick={() => {
                  setSelectedStrategy(type);
                  updateLocator({ type });
                }}
              >
                <IconComponent className="h-4 w-4 mb-1" />
                <span className="text-xs text-center">{info.label.split(' ')[0]}</span>
              </Button>
            );
          })}
        </div>

        {/* Strategy Info */}
        <div className="p-3 bg-white rounded border">
          <div className="flex items-center gap-2 mb-2">
            <strategyInfo.icon className="h-5 w-5 text-orange-600" />
            <span className="font-medium">{strategyInfo.label}</span>
            <Badge variant="outline" className={
              strategyInfo.reliability === 'High' ? 'bg-green-50 text-green-700' :
              strategyInfo.reliability === 'Medium' ? 'bg-yellow-50 text-yellow-700' :
              strategyInfo.reliability === 'Medium-High' ? 'bg-lime-50 text-lime-700' :
              'bg-red-50 text-red-700'
            }>
              {strategyInfo.reliability} Reliability
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{strategyInfo.description}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-green-700">
              <strong>Pros:</strong>
              <ul className="list-disc list-inside">
                {strategyInfo.pros.map((pro, i) => <li key={i}>{pro}</li>)}
              </ul>
            </div>
            <div className="text-red-700">
              <strong>Cons:</strong>
              <ul className="list-disc list-inside">
                {strategyInfo.cons.map((con, i) => <li key={i}>{con}</li>)}
              </ul>
            </div>
          </div>
        </div>

        {/* Strategy-specific Configuration */}
        <div className="space-y-3 p-3 bg-white rounded border">
          {selectedStrategy === 'ocr_text' && (
            <>
              <div className="grid gap-2">
                <Label>Text to Find</Label>
                <Input
                  value={locator.searchText || ''}
                  onChange={(e) => updateLocator({ searchText: e.target.value })}
                  placeholder="e.g., Submit, Save, Continue"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={locator.caseSensitive}
                  onChange={(e) => updateLocator({ caseSensitive: e.target.checked })}
                  className="rounded"
                />
                <Label className="text-sm">Case sensitive</Label>
              </div>
            </>
          )}

          {selectedStrategy === 'coordinates' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>X Position</Label>
                <Input
                  type="number"
                  value={locator.x || ''}
                  onChange={(e) => updateLocator({ x: parseInt(e.target.value) })}
                  placeholder="100"
                />
              </div>
              <div className="grid gap-2">
                <Label>Y Position</Label>
                <Input
                  type="number"
                  value={locator.y || ''}
                  onChange={(e) => updateLocator({ y: parseInt(e.target.value) })}
                  placeholder="200"
                />
              </div>
              <p className="col-span-2 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Fixed coordinates are fragile - use only as last resort
              </p>
            </div>
          )}

          {selectedStrategy === 'relative' && (
            <>
              <div className="grid gap-2">
                <Label>Anchor Element Selector</Label>
                <Input
                  value={locator.anchorSelector || ''}
                  onChange={(e) => updateLocator({ anchorSelector: e.target.value })}
                  placeholder="#logo, .header, [data-id='nav']"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Direction</Label>
                  <Select
                    value={locator.direction || 'right'}
                    onValueChange={(v) => updateLocator({ direction: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left of anchor</SelectItem>
                      <SelectItem value="right">Right of anchor</SelectItem>
                      <SelectItem value="above">Above anchor</SelectItem>
                      <SelectItem value="below">Below anchor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Offset (pixels)</Label>
                  <Input
                    type="number"
                    value={locator.offsetX || locator.offsetY || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (locator.direction === 'left' || locator.direction === 'right') {
                        updateLocator({ offsetX: val, offsetY: 0 });
                      } else {
                        updateLocator({ offsetX: 0, offsetY: val });
                      }
                    }}
                    placeholder="50"
                  />
                </div>
              </div>
            </>
          )}

          {selectedStrategy === 'image' && (
            <>
              <div className="grid gap-2">
                <Label>Confidence Threshold</Label>
                <Slider
                  value={[locator.confidence || 0.8]}
                  onValueChange={([v]) => updateLocator({ confidence: v })}
                  min={0.5}
                  max={1}
                  step={0.05}
                />
                <span className="text-xs text-muted-foreground">
                  {((locator.confidence || 0.8) * 100).toFixed(0)}% match required
                </span>
              </div>
              <div className="grid gap-2">
                <Label>Image Template</Label>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture from Screen
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Image className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                </div>
              </div>
            </>
          )}

          {selectedStrategy === 'ai_detect' && (
            <div className="grid gap-2">
              <Label>Describe the Element</Label>
              <Textarea
                value={locator.elementDescription || ''}
                onChange={(e) => updateLocator({ elementDescription: e.target.value })}
                placeholder="e.g., The blue 'Submit' button in the bottom right corner of the form"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />
                AI will analyze the screenshot and find the element matching your description
              </p>
            </div>
          )}

          {selectedStrategy === 'region_click' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Region X</Label>
                <Input
                  type="number"
                  value={locator.regionX || ''}
                  onChange={(e) => updateLocator({ regionX: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Region Y</Label>
                <Input
                  type="number"
                  value={locator.regionY || ''}
                  onChange={(e) => updateLocator({ regionY: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Width</Label>
                <Input
                  type="number"
                  value={locator.regionWidth || ''}
                  onChange={(e) => updateLocator({ regionWidth: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Height</Label>
                <Input
                  type="number"
                  value={locator.regionHeight || ''}
                  onChange={(e) => updateLocator({ regionHeight: parseInt(e.target.value) })}
                />
              </div>
            </div>
          )}

          {selectedStrategy === 'color_match' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Target Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={locator.targetColor || '#FF0000'}
                    onChange={(e) => updateLocator({ targetColor: e.target.value })}
                    className="w-12 h-9 rounded border cursor-pointer"
                  />
                  <Input
                    value={locator.targetColor || '#FF0000'}
                    onChange={(e) => updateLocator({ targetColor: e.target.value })}
                    placeholder="#FF0000"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Tolerance (0-255)</Label>
                <Input
                  type="number"
                  value={locator.colorTolerance || 10}
                  onChange={(e) => updateLocator({ colorTolerance: parseInt(e.target.value) })}
                  min={0}
                  max={255}
                />
              </div>
            </div>
          )}
        </div>

        {/* Generated Code Preview */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Generated Code Preview:</Label>
          <pre className="p-3 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto max-h-[150px]">
            {generateCode(locator)}
          </pre>
        </div>

        {/* Apply Button */}
        <Button onClick={applyLocator} className="w-full">
          <Wand2 className="h-4 w-4 mr-2" />
          Apply {STRATEGY_INFO[selectedStrategy].label} Strategy
        </Button>
      </CardContent>
    </Card>
  );
}

export default BlackboxLocatorStrategies;
