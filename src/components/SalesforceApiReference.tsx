/**
 * Salesforce API Reference
 * 
 * Comprehensive guide to all Salesforce REST API endpoints
 * with one-click loading into the API playground
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search, Database, FileJson, Users, Shield, Zap, Clock, BarChart,
  Settings, Globe, Layers, Code, ChevronRight, ChevronDown, ExternalLink,
  Play, Copy, BookOpen
} from 'lucide-react';

// All Salesforce REST API endpoints organized by category
const API_CATEGORIES = [
  {
    name: 'Core Resources',
    icon: Database,
    color: 'blue',
    description: 'Basic Salesforce data operations',
    endpoints: [
      {
        method: 'GET',
        path: '/sobjects',
        name: 'List All Objects',
        description: 'Get a list of all available sObjects',
        example: null,
      },
      {
        method: 'GET',
        path: '/sobjects/{ObjectName}',
        name: 'Object Metadata',
        description: 'Basic metadata for an object',
        example: '/sobjects/Account',
      },
      {
        method: 'GET',
        path: '/sobjects/{ObjectName}/describe',
        name: 'Describe Object',
        description: 'Complete metadata including fields, picklists, relationships',
        example: '/sobjects/Account/describe',
      },
      {
        method: 'GET',
        path: '/sobjects/{ObjectName}/{RecordId}',
        name: 'Get Record',
        description: 'Retrieve a specific record by ID',
        example: '/sobjects/Account/001XXXXXXXXXXXXXXX',
      },
      {
        method: 'POST',
        path: '/sobjects/{ObjectName}',
        name: 'Create Record',
        description: 'Create a new record',
        example: '/sobjects/Account',
        body: '{"Name": "Test Account", "Industry": "Technology"}',
      },
      {
        method: 'PATCH',
        path: '/sobjects/{ObjectName}/{RecordId}',
        name: 'Update Record',
        description: 'Update an existing record',
        example: '/sobjects/Account/001XXXXXXXXXXXXXXX',
        body: '{"Name": "Updated Name"}',
      },
      {
        method: 'DELETE',
        path: '/sobjects/{ObjectName}/{RecordId}',
        name: 'Delete Record',
        description: 'Delete a record',
        example: '/sobjects/Account/001XXXXXXXXXXXXXXX',
      },
    ],
  },
  {
    name: 'Query',
    icon: Search,
    color: 'green',
    description: 'SOQL and SOSL queries',
    endpoints: [
      {
        method: 'GET',
        path: '/query?q={SOQL}',
        name: 'Execute SOQL',
        description: 'Run a SOQL query',
        example: '/query?q=SELECT+Id,Name+FROM+Account+LIMIT+10',
      },
      {
        method: 'GET',
        path: '/queryAll?q={SOQL}',
        name: 'Query All (incl. deleted)',
        description: 'Run SOQL including deleted/archived records',
        example: '/queryAll?q=SELECT+Id,Name+FROM+Account+WHERE+IsDeleted=true',
      },
      {
        method: 'GET',
        path: '/search?q={SOSL}',
        name: 'Execute SOSL',
        description: 'Run a SOSL search',
        example: '/search?q=FIND+{test}+IN+ALL+FIELDS',
      },
      {
        method: 'GET',
        path: '/parameterizedSearch',
        name: 'Parameterized Search',
        description: 'Advanced search with parameters',
        example: '/parameterizedSearch?q=test&sobject=Account&Account.fields=Id,Name',
      },
    ],
  },
  {
    name: 'Limits & Resources',
    icon: BarChart,
    color: 'yellow',
    description: 'Org limits and available resources',
    endpoints: [
      {
        method: 'GET',
        path: '/limits',
        name: 'Org Limits',
        description: 'API limits, storage, data limits',
        example: '/limits',
      },
      {
        method: 'GET',
        path: '/',
        name: 'Available Resources',
        description: 'List all available REST resources',
        example: '/',
      },
      {
        method: 'GET',
        path: '/recent',
        name: 'Recent Items',
        description: 'Recently viewed items',
        example: '/recent',
      },
      {
        method: 'GET',
        path: '/sobjects/{ObjectName}/describe/layouts',
        name: 'Object Layouts',
        description: 'Page layouts for an object',
        example: '/sobjects/Account/describe/layouts',
      },
    ],
  },
  {
    name: 'Composite',
    icon: Layers,
    color: 'purple',
    description: 'Batch and composite operations',
    endpoints: [
      {
        method: 'POST',
        path: '/composite',
        name: 'Composite Request',
        description: 'Execute multiple requests in one call',
        example: '/composite',
        body: JSON.stringify({
          allOrNone: true,
          compositeRequest: [
            { method: 'GET', url: '/services/data/v59.0/sobjects/Account/describe', referenceId: 'refAccount' },
          ]
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/composite/batch',
        name: 'Batch Request',
        description: 'Execute up to 25 subrequests',
        example: '/composite/batch',
        body: JSON.stringify({
          batchRequests: [
            { method: 'GET', url: 'v59.0/sobjects/Account/describe' },
          ]
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/composite/tree/{ObjectName}',
        name: 'SObject Tree',
        description: 'Create records with parent-child relationships',
        example: '/composite/tree/Account',
        body: JSON.stringify({
          records: [{
            attributes: { type: 'Account', referenceId: 'ref1' },
            Name: 'Parent Account',
            Contacts: {
              records: [{
                attributes: { type: 'Contact', referenceId: 'ref2' },
                LastName: 'Child Contact'
              }]
            }
          }]
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/composite/sobjects',
        name: 'SObject Collections',
        description: 'Create/update/delete up to 200 records',
        example: '/composite/sobjects',
        body: JSON.stringify({
          allOrNone: false,
          records: [
            { attributes: { type: 'Account' }, Name: 'Account 1' },
            { attributes: { type: 'Account' }, Name: 'Account 2' },
          ]
        }, null, 2),
      },
    ],
  },
  {
    name: 'Tooling API',
    icon: Settings,
    color: 'orange',
    description: 'Metadata and development tools',
    endpoints: [
      {
        method: 'GET',
        path: '/tooling/sobjects',
        name: 'Tooling Objects',
        description: 'List tooling API objects',
        example: '/tooling/sobjects',
      },
      {
        method: 'GET',
        path: '/tooling/query?q={SOQL}',
        name: 'Tooling Query',
        description: 'Query Apex classes, triggers, etc.',
        example: '/tooling/query?q=SELECT+Id,Name+FROM+ApexClass+LIMIT+10',
      },
      {
        method: 'GET',
        path: '/tooling/sobjects/ApexClass/{Id}',
        name: 'Get Apex Class',
        description: 'Retrieve Apex class details',
        example: '/tooling/sobjects/ApexClass/01pXXXXXXXXXXXXXXX',
      },
      {
        method: 'GET',
        path: '/tooling/sobjects/ApexTrigger/{Id}',
        name: 'Get Apex Trigger',
        description: 'Retrieve Apex trigger details',
        example: '/tooling/sobjects/ApexTrigger/01qXXXXXXXXXXXXXXX',
      },
      {
        method: 'POST',
        path: '/tooling/executeAnonymous?anonymousBody={code}',
        name: 'Execute Anonymous Apex',
        description: 'Run anonymous Apex code',
        example: '/tooling/executeAnonymous?anonymousBody=System.debug(\'Hello\');',
      },
      {
        method: 'GET',
        path: '/tooling/completions?type=apex',
        name: 'Apex Completions',
        description: 'Get Apex code completions',
        example: '/tooling/completions?type=apex',
      },
    ],
  },
  {
    name: 'Users & Permissions',
    icon: Users,
    color: 'cyan',
    description: 'User information and permissions',
    endpoints: [
      {
        method: 'GET',
        path: '/sobjects/User/{UserId}',
        name: 'Get User',
        description: 'Get user details',
        example: '/sobjects/User/005XXXXXXXXXXXXXXX',
      },
      {
        method: 'GET',
        path: '/query?q=SELECT+Id,Name+FROM+Profile',
        name: 'List Profiles',
        description: 'Get all profiles',
        example: '/query?q=SELECT+Id,Name+FROM+Profile',
      },
      {
        method: 'GET',
        path: '/query?q=SELECT+Id,Label+FROM+PermissionSet',
        name: 'List Permission Sets',
        description: 'Get all permission sets',
        example: '/query?q=SELECT+Id,Label+FROM+PermissionSet',
      },
      {
        method: 'GET',
        path: '/sobjects/User/{UserId}/password',
        name: 'Check User Password',
        description: 'Check if user has password set',
        example: '/sobjects/User/005XXXXXXXXXXXXXXX/password',
      },
    ],
  },
  {
    name: 'Process & Automation',
    icon: Zap,
    color: 'pink',
    description: 'Flows, approvals, and automation',
    endpoints: [
      {
        method: 'GET',
        path: '/process/approvals',
        name: 'List Approval Processes',
        description: 'Get available approval processes',
        example: '/process/approvals',
      },
      {
        method: 'POST',
        path: '/process/approvals',
        name: 'Submit for Approval',
        description: 'Submit record for approval',
        example: '/process/approvals',
        body: JSON.stringify({
          requests: [{
            actionType: 'Submit',
            contextId: '001XXXXXXXXXXXXXXX',
            comments: 'Please approve'
          }]
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/actions/standard',
        name: 'Standard Actions',
        description: 'List standard invocable actions',
        example: '/actions/standard',
      },
      {
        method: 'GET',
        path: '/actions/custom',
        name: 'Custom Actions',
        description: 'List custom invocable actions',
        example: '/actions/custom',
      },
    ],
  },
  {
    name: 'Analytics',
    icon: BarChart,
    color: 'indigo',
    description: 'Reports and dashboards',
    endpoints: [
      {
        method: 'GET',
        path: '/analytics/reports',
        name: 'List Reports',
        description: 'Get available reports',
        example: '/analytics/reports',
      },
      {
        method: 'GET',
        path: '/analytics/reports/{ReportId}',
        name: 'Report Metadata',
        description: 'Get report metadata',
        example: '/analytics/reports/00OXXXXXXXXXXXXXXX',
      },
      {
        method: 'POST',
        path: '/analytics/reports/{ReportId}',
        name: 'Run Report',
        description: 'Execute a report',
        example: '/analytics/reports/00OXXXXXXXXXXXXXXX',
        body: '{}',
      },
      {
        method: 'GET',
        path: '/analytics/dashboards',
        name: 'List Dashboards',
        description: 'Get available dashboards',
        example: '/analytics/dashboards',
      },
    ],
  },
  {
    name: 'Chatter & Connect',
    icon: Globe,
    color: 'teal',
    description: 'Chatter feeds and communities',
    endpoints: [
      {
        method: 'GET',
        path: '/chatter/feeds/news/me/feed-elements',
        name: 'My News Feed',
        description: 'Get current user\'s news feed',
        example: '/chatter/feeds/news/me/feed-elements',
      },
      {
        method: 'GET',
        path: '/chatter/users/me',
        name: 'Current User Info',
        description: 'Get current user\'s Chatter profile',
        example: '/chatter/users/me',
      },
      {
        method: 'POST',
        path: '/chatter/feed-elements',
        name: 'Post to Feed',
        description: 'Create a Chatter post',
        example: '/chatter/feed-elements',
        body: JSON.stringify({
          body: { messageSegments: [{ type: 'Text', text: 'Hello!' }] },
          feedElementType: 'FeedItem',
          subjectId: 'me'
        }, null, 2),
      },
    ],
  },
];

interface SalesforceApiReferenceProps {
  onSelectEndpoint: (method: string, path: string, body?: string) => void;
  objects?: Array<{ name: string; label: string }>;
}

export function SalesforceApiReference({ onSelectEndpoint, objects = [] }: SalesforceApiReferenceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Core Resources']));
  const [selectedObject, setSelectedObject] = useState('Account');

  // Filter endpoints based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return API_CATEGORIES;
    
    const lower = searchTerm.toLowerCase();
    return API_CATEGORIES.map(cat => ({
      ...cat,
      endpoints: cat.endpoints.filter(ep => 
        ep.name.toLowerCase().includes(lower) ||
        ep.description.toLowerCase().includes(lower) ||
        ep.path.toLowerCase().includes(lower)
      )
    })).filter(cat => cat.endpoints.length > 0);
  }, [searchTerm]);

  const toggleCategory = (name: string) => {
    const next = new Set(expandedCategories);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedCategories(next);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'POST': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PATCH': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'DELETE': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const handleSelect = (endpoint: typeof API_CATEGORIES[0]['endpoints'][0]) => {
    let path = endpoint.example || endpoint.path;
    // Replace placeholders with selected object
    path = path.replace('{ObjectName}', selectedObject);
    onSelectEndpoint(endpoint.method, path, endpoint.body);
  };

  return (
    <div className="space-y-4">
      {/* Search and Object Selector */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search APIs..."
            className="pl-9 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        <select
          value={selectedObject}
          onChange={(e) => setSelectedObject(e.target.value)}
          className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-white text-sm"
        >
          <optgroup label="Standard Objects">
            {['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event', 'User'].map(obj => (
              <option key={obj} value={obj}>{obj}</option>
            ))}
          </optgroup>
          {objects.length > 0 && (
            <optgroup label="From Your Org">
              {objects.slice(0, 20).map(obj => (
                <option key={obj.name} value={obj.name}>{obj.label}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* API Categories */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {filteredCategories.map(category => {
          const Icon = category.icon;
          const isExpanded = expandedCategories.has(category.name);
          
          return (
            <div key={category.name} className="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
              >
                <Icon className={`w-5 h-5 text-${category.color}-400`} />
                <div className="flex-1 text-left">
                  <div className="font-medium text-white">{category.name}</div>
                  <div className="text-xs text-slate-500">{category.description}</div>
                </div>
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  {category.endpoints.length}
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {/* Endpoints */}
              {isExpanded && (
                <div className="border-t border-slate-700">
                  {category.endpoints.map((endpoint, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-700/30 cursor-pointer border-b border-slate-700/50 last:border-0"
                      onClick={() => handleSelect(endpoint)}
                    >
                      <Badge className={`${getMethodColor(endpoint.method)} text-xs font-mono mt-0.5`}>
                        {endpoint.method}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-200">{endpoint.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{endpoint.description}</div>
                        <code className="text-xs text-slate-400 font-mono mt-1 block truncate">
                          {endpoint.path}
                        </code>
                      </div>
                      <Play className="w-4 h-4 text-slate-500 hover:text-green-400 flex-shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Links */}
      <div className="flex items-center gap-4 pt-2 border-t border-slate-700">
        <a
          href="https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
        >
          <BookOpen className="w-3.5 h-3.5" />
          REST API Docs
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
        >
          <Settings className="w-3.5 h-3.5" />
          Tooling API Docs
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}



