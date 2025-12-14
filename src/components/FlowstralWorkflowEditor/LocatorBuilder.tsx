import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wand2, Search, MousePointer, Type, Eye, CheckCircle, 
  Sparkles, Copy, Check, AlertCircle, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { ApplicationDetector } from '@/lib/application-detector';

interface LocatorBuilderProps {
  nodeType: 'click' | 'input' | 'assert';
  onLocatorGenerated: (locator: string) => void;
  currentLocator?: string;
  applicationType?: 'salesforce' | 'react' | 'angular' | 'vue' | 'generic' | 'unknown';
  elementData?: {
    tagName?: string;
    attributes?: Record<string, string>;
    textContent?: string;
    className?: string;
  };
}

interface LocatorSuggestion {
  locator: string;
  strategy: string;
  description: string;
  quality: 'high' | 'medium' | 'low';
  reason: string;
}

export default function LocatorBuilder({ 
  nodeType, 
  onLocatorGenerated, 
  currentLocator,
  applicationType = 'generic',
  elementData
}: LocatorBuilderProps) {
  // Parse initial locator if provided
  const parseInitialLocator = (loc: string) => {
    if (!loc) return { strategy: 'auto' as const, role: 'button', name: '', text: '', label: '', testId: '', cssSelector: '' };
    
    const cleanLoc = loc.replace(/^page\./, '');
    
    // Try to parse
    const roleMatch = cleanLoc.match(/getByRole\(['"]([^'"]+)['"]\s*(?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?\)/);
    if (roleMatch) {
      return {
        strategy: 'role' as const,
        role: roleMatch[1] || 'button',
        name: roleMatch[2] || '',
        text: roleMatch[2] || '',
        label: '',
        testId: '',
        cssSelector: ''
      };
    }
    
    const labelMatch = cleanLoc.match(/getByLabel\(['"]([^'"]+)['"]\)/);
    if (labelMatch) {
      return {
        strategy: 'label' as const,
        role: 'button',
        name: labelMatch[1],
        text: labelMatch[1],
        label: labelMatch[1],
        testId: '',
        cssSelector: ''
      };
    }
    
    const textMatch = cleanLoc.match(/getByText\(['"]([^'"]+)['"]\)/);
    if (textMatch) {
      return {
        strategy: 'text' as const,
        role: 'button',
        name: textMatch[1],
        text: textMatch[1],
        label: '',
        testId: '',
        cssSelector: ''
      };
    }
    
    const testIdMatch = cleanLoc.match(/getByTestId\(['"]([^'"]+)['"]\)/);
    if (testIdMatch) {
      return {
        strategy: 'testid' as const,
        role: 'button',
        name: '',
        text: '',
        label: '',
        testId: testIdMatch[1],
        cssSelector: ''
      };
    }
    
    const cssMatch = cleanLoc.match(/locator\(['"]([^'"]+)['"]\)/);
    if (cssMatch) {
      return {
        strategy: 'css' as const,
        role: 'button',
        name: '',
        text: '',
        label: '',
        testId: '',
        cssSelector: cssMatch[1]
      };
    }
    
    return { strategy: 'auto' as const, role: 'button', name: '', text: '', label: '', testId: '', cssSelector: '' };
  };

  const initialData = parseInitialLocator(currentLocator || '');
  
  const [strategy, setStrategy] = useState<'role' | 'text' | 'label' | 'testid' | 'css' | 'auto'>(initialData.strategy);
  const [role, setRole] = useState(initialData.role);
  const [name, setName] = useState(initialData.name);
  const [text, setText] = useState(initialData.text);
  const [label, setLabel] = useState(initialData.label);
  const [testId, setTestId] = useState(initialData.testId);
  const [cssSelector, setCssSelector] = useState(initialData.cssSelector);
  const [suggestions, setSuggestions] = useState<LocatorSuggestion[]>([]);
  const [generatedLocator, setGeneratedLocator] = useState(currentLocator || '');

  // Parse existing locator to populate fields when currentLocator changes
  React.useEffect(() => {
    if (currentLocator) {
      setGeneratedLocator(currentLocator);
      parseLocator(currentLocator);
    } else {
      // Reset if no locator
      setGeneratedLocator('');
      setName('');
      setText('');
      setLabel('');
      setTestId('');
      setCssSelector('');
      setStrategy('auto');
    }
  }, [currentLocator]);

  // Parse locator string to extract values
  const parseLocator = (locator: string) => {
    if (!locator) return;

    // Remove "page." prefix if present
    const cleanLocator = locator.replace(/^page\./, '');

    // Parse getByRole('button', { name: 'Submit' })
    const roleMatch = cleanLocator.match(/getByRole\(['"]([^'"]+)['"]\s*(?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?\)/);
    if (roleMatch) {
      setRole(roleMatch[1] || 'button');
      if (roleMatch[2]) {
        setName(roleMatch[2]);
        setText(roleMatch[2]);
      }
      setStrategy('role');
      return;
    }

    // Parse getByLabel('Email Address')
    const labelMatch = cleanLocator.match(/getByLabel\(['"]([^'"]+)['"]\)/);
    if (labelMatch) {
      setLabel(labelMatch[1]);
      setName(labelMatch[1]); // Also set name for consistency
      setText(labelMatch[1]);
      setStrategy('label');
      return;
    }

    // Parse getByText('Click me')
    const textMatch = cleanLocator.match(/getByText\(['"]([^'"]+)['"]\)/);
    if (textMatch) {
      setText(textMatch[1]);
      setName(textMatch[1]);
      setStrategy('text');
      return;
    }

    // Parse getByTestId('submit-button')
    const testIdMatch = cleanLocator.match(/getByTestId\(['"]([^'"]+)['"]\)/);
    if (testIdMatch) {
      setTestId(testIdMatch[1]);
      setStrategy('testid');
      return;
    }

    // Parse page.locator('button.primary') or locator('button.primary')
    const cssMatch = cleanLocator.match(/locator\(['"]([^'"]+)['"]\)/);
    if (cssMatch) {
      setCssSelector(cssMatch[1]);
      setStrategy('css');
      return;
    }

    // If we can't parse it, just show it in generatedLocator
    // Don't reset fields - keep what was there
  };

  // Auto-generate suggestions based on inputs
  React.useEffect(() => {
    generateSuggestions();
  }, [strategy, role, name, text, label, testId, cssSelector, nodeType]);

  const generateSuggestions = () => {
    const newSuggestions: LocatorSuggestion[] = [];
    
    // If we have element data and application type, use app-specific analysis
    if (elementData && applicationType) {
      const recommendations = ApplicationDetector.analyzeElement(elementData, applicationType);
      
      recommendations.forEach((rec, index) => {
        let quality: 'high' | 'medium' | 'low' = 'medium';
        if (rec.priority === 1) quality = 'high';
        else if (rec.priority >= 4) quality = 'low';
        
        newSuggestions.push({
          locator: rec.type === 'semantic' ? rec.selector : `page.locator('${rec.selector}')`,
          strategy: `${applicationType}_${rec.type}`,
          description: `${rec.type} selector (${applicationType})`,
          quality,
          reason: rec.reason
        });
      });
    }

    // Salesforce-specific strategies (if Salesforce detected)
    if (applicationType === 'salesforce') {
      // For Salesforce, prioritize title attribute
      if (name || text) {
        newSuggestions.push({
          locator: `page.locator('[title="${name || text}"]')`,
          strategy: 'salesforce_title',
          description: 'Salesforce: By title attribute',
          quality: 'high',
          reason: 'Title attribute is most stable in Salesforce LWC'
        });
      }
      
      // Data attributes
      if (cssSelector && cssSelector.includes('data-')) {
        newSuggestions.push({
          locator: `page.locator('${cssSelector}')`,
          strategy: 'salesforce_data',
          description: 'Salesforce: By data attributes',
          quality: 'high',
          reason: 'Data attributes are stable in Salesforce'
        });
      }
    }

    // Strategy 1: Role + Name (Highest Quality for non-Salesforce)
    if (applicationType !== 'salesforce' && (name || text)) {
      const roleName = name || text;
      if (nodeType === 'click') {
        // Try button first, then link
        newSuggestions.push({
          locator: `page.getByRole('button', { name: '${roleName}' })`,
          strategy: 'role_button',
          description: 'Button by role and name',
          quality: 'high',
          reason: 'Most reliable - uses semantic role and accessible name'
        });
        newSuggestions.push({
          locator: `page.getByRole('link', { name: '${roleName}' })`,
          strategy: 'role_link',
          description: 'Link by role and name',
          quality: 'high',
          reason: 'Reliable for navigation links'
        });
      } else if (nodeType === 'input') {
        newSuggestions.push({
          locator: `page.getByRole('textbox', { name: '${roleName}' })`,
          strategy: 'role_textbox',
          description: 'Textbox by role and name',
          quality: 'high',
          reason: 'Best for form inputs with labels'
        });
      }
    }

    // Strategy 2: Label (High Quality for inputs)
    if (label && nodeType === 'input') {
      newSuggestions.push({
        locator: `page.getByLabel('${label}')`,
        strategy: 'label',
        description: 'Input by label',
        quality: 'high',
        reason: 'Perfect for form fields with associated labels'
      });
    }

    // Strategy 3: Text (Medium Quality)
    if (text) {
      newSuggestions.push({
        locator: `page.getByText('${text}')`,
        strategy: 'text',
        description: 'Element by text content',
        quality: 'medium',
        reason: 'Good for buttons/links with visible text'
      });
    }

    // Strategy 4: Test ID (Highest Quality if available)
    if (testId) {
      newSuggestions.push({
        locator: `page.getByTestId('${testId}')`,
        strategy: 'testid',
        description: 'Element by test ID',
        quality: 'high',
        reason: 'Most stable - requires data-testid attribute'
      });
    }

    // Strategy 5: Role only (if name not provided)
    if (!name && !text && nodeType === 'click') {
      newSuggestions.push({
        locator: `page.getByRole('${role}')`,
        strategy: 'role_only',
        description: `Element by role (${role})`,
        quality: 'medium',
        reason: 'Works if there\'s only one element with this role'
      });
    }

    // Strategy 6: CSS Selector (Lower Quality - fallback)
    if (cssSelector) {
      newSuggestions.push({
        locator: `page.locator('${cssSelector}')`,
        strategy: 'css',
        description: 'Element by CSS selector',
        quality: applicationType === 'salesforce' ? 'low' : 'low',
        reason: applicationType === 'salesforce' 
          ? 'Avoid CSS selectors in Salesforce - use title/data attributes instead'
          : 'Less reliable - may break with UI changes'
      });
    }

    // Auto mode: Generate best suggestion (only if we don't already have a locator)
    if (strategy === 'auto' && newSuggestions.length > 0 && !generatedLocator) {
      // Prioritize: testid > role+name > label > text > role only > css
      const priority = ['testid', 'role_button', 'role_link', 'role_textbox', 'label', 'text', 'role_only', 'css'];
      newSuggestions.sort((a, b) => {
        const aPriority = priority.indexOf(a.strategy);
        const bPriority = priority.indexOf(b.strategy);
        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return 0;
      });
      
      setGeneratedLocator(newSuggestions[0].locator);
      onLocatorGenerated(newSuggestions[0].locator);
    }

    setSuggestions(newSuggestions);
  };

  const handleManualGenerate = () => {
    let locator = '';

    switch (strategy) {
      case 'role':
        if (name) {
          locator = `page.getByRole('${role}', { name: '${name}' })`;
        } else {
          locator = `page.getByRole('${role}')`;
        }
        break;
      case 'text':
        locator = `page.getByText('${text}')`;
        break;
      case 'label':
        locator = `page.getByLabel('${label}')`;
        break;
      case 'testid':
        locator = `page.getByTestId('${testId}')`;
        break;
      case 'css':
        locator = `page.locator('${cssSelector}')`;
        break;
      case 'auto':
        if (suggestions.length > 0) {
          locator = suggestions[0].locator;
        }
        break;
    }

    if (locator) {
      setGeneratedLocator(locator);
      onLocatorGenerated(locator);
      toast.success('Locator generated!');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Intelligent Locator Builder
          </CardTitle>
          <CardDescription>
            Build reliable Playwright locators using best practices. Fill in what you know about the element.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={strategy} onValueChange={(v) => setStrategy(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="auto">
                <Sparkles className="h-4 w-4 mr-2" />
                Auto
              </TabsTrigger>
              <TabsTrigger value="role">Role</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">Auto Mode</p>
                    <p className="text-xs text-blue-700">
                      Fill in any information you know about the element. We'll generate the best locator automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Element Name/Text</Label>
                  <Input
                    placeholder="e.g., Submit, Login, Email"
                    value={name || text}
                    onChange={(e) => {
                      setName(e.target.value);
                      setText(e.target.value);
                    }}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The visible text or accessible name of the element
                  </p>
                </div>

                {nodeType === 'input' && (
                  <div>
                    <Label>Label Text</Label>
                    <Input
                      placeholder="e.g., Email Address, Password"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The label text associated with the input field
                    </p>
                  </div>
                )}

                <div>
                  <Label>Test ID (Optional)</Label>
                  <Input
                    placeholder="e.g., submit-button, login-form"
                    value={testId}
                    onChange={(e) => setTestId(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    data-testid attribute value (most reliable)
                  </p>
                </div>

                <div>
                  <Label>CSS Selector (Fallback)</Label>
                  <Input
                    placeholder="e.g., button.primary, #submit-btn"
                    value={cssSelector}
                    onChange={(e) => setCssSelector(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use only if other methods don't work
                  </p>
                </div>
              </div>

              {generatedLocator && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">Generated Locator</span>
                      </div>
                      <code className="text-sm text-green-800 bg-white px-3 py-2 rounded border block">
                        {generatedLocator}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(generatedLocator)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <Label className="mb-2 block">Suggestions (Best to Worst)</Label>
                  <div className="space-y-2">
                    {suggestions.slice(0, 3).map((suggestion, idx) => (
                      <Card
                        key={idx}
                        className={`cursor-pointer hover:shadow-md transition-all ${
                          suggestion.locator === generatedLocator ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => {
                          setGeneratedLocator(suggestion.locator);
                          onLocatorGenerated(suggestion.locator);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getQualityColor(suggestion.quality)}>
                                  {suggestion.quality}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {suggestion.description}
                                </span>
                              </div>
                              <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                                {suggestion.locator}
                              </code>
                              <p className="text-xs text-muted-foreground mt-1">
                                {suggestion.reason}
                              </p>
                            </div>
                            {suggestion.locator === generatedLocator && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="role" className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="button">Button</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="textbox">Textbox</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="radio">Radio</SelectItem>
                    <SelectItem value="combobox">Combobox</SelectItem>
                    <SelectItem value="option">Option</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name (Accessible Name)</Label>
                <Input
                  placeholder="e.g., Submit, Login, Search"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The accessible name (aria-label, text content, or label)
                </p>
              </div>
              <Button onClick={handleManualGenerate} className="w-full">
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Locator
              </Button>
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <div>
                <Label>Text Content</Label>
                <Input
                  placeholder="e.g., Click me, Submit, Login"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The exact text visible on the element
                </p>
              </div>
              <Button onClick={handleManualGenerate} className="w-full">
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Locator
              </Button>
            </TabsContent>
          </Tabs>

          {generatedLocator && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label>Final Locator</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedLocator)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <code className="text-sm font-mono bg-background px-3 py-2 rounded border block">
                {generatedLocator}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">💡 Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <div>
              <strong>Use Test IDs:</strong> Add data-testid attributes to your elements for the most reliable locators
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <div>
              <strong>Prefer Roles:</strong> getByRole() is more reliable than CSS selectors
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <div>
              <strong>Use Labels:</strong> getByLabel() is perfect for form inputs
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div>
              <strong>Avoid CSS:</strong> CSS selectors break easily with UI changes
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

