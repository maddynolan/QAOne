# Master Document Maintenance Guide

## Quick Reference: How to Update MASTER_DOCUMENT.md

### When to Update

Update `MASTER_DOCUMENT.md` whenever you:
- ✅ Add a new feature
- ✅ Modify existing functionality
- ✅ Add new API endpoints
- ✅ Change database schema
- ✅ Update dependencies
- ✅ Add new configuration options
- ✅ Fix critical bugs
- ✅ Add new integrations

### How to Update

#### 1. Update Version History & Changelog

Add a new entry at the top of the changelog section:

```markdown
### Version 2.0.X - YYYY-MM-DD

#### Feature Name
- ✅ **Description of what was added**
  - Detail 1
  - Detail 2
  - Files: `path/to/file1.py`, `path/to/file2.ts`

#### Bug Fixes
- ✅ Fixed issue with [description]
  - Files: `path/to/fix.py`

#### Configuration Changes
- ✅ Added new environment variable `NEW_VAR`
  - File: `env.example`
```

#### 2. Update Relevant Sections

- **Core Features**: Add new features to the list
- **Enterprise Features**: Add enterprise-grade features
- **API Endpoints**: Add new endpoints
- **Database Schema**: Add new tables/columns
- **Configuration**: Add new environment variables
- **Setup & Installation**: Update if setup process changes

#### 3. Update Metadata

- Update "Last Updated" date at the top
- Update version number if major/minor version change

### Changelog Entry Template

Copy this template for new entries:

```markdown
### Version X.Y.Z - YYYY-MM-DD

#### [Category: Feature/Bug Fix/Configuration/Refactor]

- ✅ **[Feature Name]**
  - Description of what was implemented
  - Key technical details
  - Impact/benefits
  - Files: `path/to/file1`, `path/to/file2`
  
- ✅ **[Another Feature]**
  - Description
  - Files: `path/to/file`
```

### Categories

- **Feature**: New functionality added
- **Bug Fix**: Bug fixes and corrections
- **Configuration**: Environment variables, config changes
- **Refactor**: Code improvements without feature changes
- **Security**: Security enhancements
- **Performance**: Performance optimizations
- **Documentation**: Documentation updates

### File Path Format

Always include file paths in changelog entries:
- Use relative paths from repository root
- Include both frontend and backend files if applicable
- Group related files together

Example:
```
Files: `src/pages/NewPage.tsx`, `backend/app/routers/new_api.py`, `supabase/migrations/029_new_feature.sql`
```

### Commit Message Format

When updating the master document, use this commit message format:

```
Update MASTER_DOCUMENT.md: [Brief description of changes]
```

Examples:
- `Update MASTER_DOCUMENT.md: Add new API endpoint for test execution`
- `Update MASTER_DOCUMENT.md: Document secrets management feature`
- `Update MASTER_DOCUMENT.md: Add Tier-1 roadmap items`

### Best Practices

1. **Update Immediately**: Update the document as you make changes, not after
2. **Be Specific**: Include file paths, endpoint URLs, configuration keys
3. **Link to Details**: Link to detailed documentation when available
4. **Keep Organized**: Maintain clear sections and consistent formatting
5. **Review Regularly**: Review and update outdated sections periodically

### Quick Update Checklist

- [ ] Added changelog entry with version number
- [ ] Updated relevant feature sections
- [ ] Updated API endpoints if applicable
- [ ] Updated database schema if applicable
- [ ] Updated configuration section if applicable
- [ ] Updated "Last Updated" date
- [ ] Committed with descriptive message

### Example Workflow

1. Make code changes
2. Open `MASTER_DOCUMENT.md`
3. Add changelog entry at top
4. Update relevant sections
5. Update date
6. Commit: `git commit -m "Update MASTER_DOCUMENT.md: [description]"`
7. Push changes

---

**Remember**: This document is the single source of truth. Keep it accurate and up-to-date!

