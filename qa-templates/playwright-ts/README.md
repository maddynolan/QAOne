# Playwright TypeScript Template

Standard template for Playwright TypeScript test automation.

## Structure

```
playwright-ts/
├── playwright.config.ts    # Playwright configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
├── tests/                   # Test files (model can write here)
│   └── ui/                  # UI tests directory
├── fixtures/                # Test fixtures (shared helpers)
└── helpers/                 # Utility functions
```

## Rules for AI Model

- **ONLY** create test files in `tests/ui/*.spec.ts`
- **MUST** use existing fixtures and helpers
- **MUST** follow the config structure
- **MUST** use TypeScript types

## Usage

```bash
# Install dependencies
npm install

# Run tests
npm test

# List tests (dry-run)
npm run test:list
```




