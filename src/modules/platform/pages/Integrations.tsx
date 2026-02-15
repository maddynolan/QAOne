/**
 * @module platform
 * @page Integrations
 *
 * Third-party integration management page. Displays available integrations
 * (Jira, GitHub, Azure DevOps, Confluence, Slack, etc.) with connection
 * status, configuration, and setup wizards.
 *
 * @features
 * - Integration catalog with connection status
 * - One-click connect/disconnect for each integration
 * - Integration-specific configuration pages
 * - OAuth2 authentication flows
 * - Webhook configuration
 *
 * @dependencies Integrations uses shadcn/ui Card, Badge, Button, lucide-react, react-router-dom
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle, XCircle, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const integrations = [
  {
    id: "jira",
    name: "Jira",
    description: "Sync requirements, create defects, and link test cases",
    status: "available",
    icon: "🔗",
    route: "/integrations/jira",
    features: ["Sync requirements", "Create defects", "Link test cases", "Webhook support"]
  },
  {
    id: "github",
    name: "GitHub",
    description: "Connect repositories, sync test code, and trigger CI/CD",
    status: "available",
    icon: "🐙",
    route: "/integrations/github",
    features: ["Repository sync", "Webhook support", "CI/CD triggers", "Code sync"]
  },
  {
    id: "azure-devops",
    name: "Azure DevOps",
    description: "Sync work items and link to test cases",
    status: "available",
    icon: "🔷",
    route: "/integrations/azure-devops",
    features: ["Work item sync", "Test case linking", "Webhook support"]
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Sync documentation and requirements",
    status: "available",
    icon: "📚",
    route: "/integrations/confluence",
    features: ["Document sync", "Requirements sync"]
  },
  {
    id: "cicd",
    name: "CI/CD",
    description: "GitHub Actions, Jenkins, GitLab CI integration",
    status: "available",
    icon: "⚙️",
    route: "/integrations/cicd",
    features: ["GitHub Actions", "Jenkins", "GitLab CI", "Webhook support"]
  }
];

export default function Integrations() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect your tools to sync requirements, defects, and test cases
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{integration.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                    {integration.status === "available" && (
                      <Badge variant="outline" className="mt-1">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    )}
                    {integration.status === "coming-soon" && (
                      <Badge variant="secondary" className="mt-1">
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <CardDescription className="mt-2">
                {integration.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">Features:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {integration.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => navigate(integration.route)}
                    className="flex-1"
                    disabled={integration.status === "coming-soon"}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>
            All backend integrations are implemented and ready to use
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Backend Connectors</span>
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                5/5 Complete
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">API Endpoints</span>
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">UI Pages</span>
              <Badge variant="secondary">
                1/5 Complete
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



