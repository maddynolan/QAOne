# Integrations Router

Backend API router for third-party integration webhooks. Currently contains Jira webhook handling for bidirectional issue synchronization.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `jira_webhook.py` | 186 | -- | -- | Jira webhook receiver -- processes issue create/update/delete events for bidirectional sync with defect tracking |

## Webhook Events Handled

- Issue created -- creates corresponding defect in QAAI
- Issue updated -- syncs status, priority, and assignment changes
- Issue deleted -- marks linked defect as removed

## Related Frontend Module

- `src/modules/platform/` -- JiraIntegration page for webhook configuration
