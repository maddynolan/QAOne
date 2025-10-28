export interface JiraConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  projectKey: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee?: string;
  created: string;
  updated: string;
  labels: string[];
}

export interface CreateJiraIssueRequest {
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  labels?: string[];
  assignee?: string;
}

export class JiraIntegrationService {
  private config: JiraConfig | null = null;

  setConfig(config: JiraConfig) {
    this.config = config;
  }

  getConfig(): JiraConfig | null {
    return this.config;
  }

  async testConnection(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Jira configuration not set');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/rest/api/3/myself`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.username}:${this.config.apiToken}`)}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Jira connection test failed:', error);
      return false;
    }
  }

  async createIssue(request: CreateJiraIssueRequest): Promise<JiraIssue> {
    if (!this.config) {
      throw new Error('Jira configuration not set');
    }

    const issueData = {
      fields: {
        project: {
          key: this.config.projectKey
        },
        summary: request.summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: request.description
                }
              ]
            }
          ]
        },
        issuetype: {
          name: request.issueType
        },
        priority: {
          name: request.priority
        },
        labels: request.labels || [],
        ...(request.assignee && {
          assignee: {
            name: request.assignee
          }
        })
      }
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.username}:${this.config.apiToken}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(issueData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create Jira issue: ${response.statusText}`);
      }

      const result = await response.json();
      return await this.getIssue(result.key);
    } catch (error) {
      console.error('Failed to create Jira issue:', error);
      throw error;
    }
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    if (!this.config) {
      throw new Error('Jira configuration not set');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/rest/api/3/issue/${issueKey}`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.username}:${this.config.apiToken}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get Jira issue: ${response.statusText}`);
      }

      const issue = await response.json();
      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
        status: issue.fields.status.name,
        priority: issue.fields.priority.name,
        assignee: issue.fields.assignee?.displayName,
        created: issue.fields.created,
        updated: issue.fields.updated,
        labels: issue.fields.labels || []
      };
    } catch (error) {
      console.error('Failed to get Jira issue:', error);
      throw error;
    }
  }

  async updateIssue(issueKey: string, updates: Partial<CreateJiraIssueRequest>): Promise<JiraIssue> {
    if (!this.config) {
      throw new Error('Jira configuration not set');
    }

    const updateData: any = {};

    if (updates.summary) {
      updateData.summary = updates.summary;
    }

    if (updates.description) {
      updateData.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: updates.description
              }
            ]
          }
        ]
      };
    }

    if (updates.priority) {
      updateData.priority = {
        name: updates.priority
      };
    }

    if (updates.labels) {
      updateData.labels = updates.labels;
    }

    if (updates.assignee) {
      updateData.assignee = {
        name: updates.assignee
      };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/rest/api/3/issue/${issueKey}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.username}:${this.config.apiToken}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: updateData })
      });

      if (!response.ok) {
        throw new Error(`Failed to update Jira issue: ${response.statusText}`);
      }

      return await this.getIssue(issueKey);
    } catch (error) {
      console.error('Failed to update Jira issue:', error);
      throw error;
    }
  }

  async searchIssues(jql: string): Promise<JiraIssue[]> {
    if (!this.config) {
      throw new Error('Jira configuration not set');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/rest/api/3/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.username}:${this.config.apiToken}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql,
          maxResults: 100
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to search Jira issues: ${response.statusText}`);
      }

      const result = await response.json();
      return result.issues.map((issue: any) => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
        status: issue.fields.status.name,
        priority: issue.fields.priority.name,
        assignee: issue.fields.assignee?.displayName,
        created: issue.fields.created,
        updated: issue.fields.updated,
        labels: issue.fields.labels || []
      }));
    } catch (error) {
      console.error('Failed to search Jira issues:', error);
      throw error;
    }
  }
}

export const jiraIntegrationService = new JiraIntegrationService();
