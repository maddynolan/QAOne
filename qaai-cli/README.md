# QA AI Platform CLI Tool

Command-line interface for QA AI Platform, designed for CI/CD integration.

## Installation

```bash
npm install -g qaai-cli
```

Or use locally:
```bash
npm install
npm run build
```

## Configuration

Set environment variables:
```bash
export QAAI_API_URL=http://localhost:8000
export QAAI_API_KEY=your-api-key-here
```

## Usage

### Run a test plan

```bash
qaai-cli run --plan "Smoke Test" --wait --exit-code-on-fail
```

Options:
- `--plan <name>`: Test plan name (required)
- `--wait`: Wait for execution to complete
- `--exit-code-on-fail`: Exit with non-zero code on failure
- `--environment <env>`: Environment (dev, staging, prod)
- `--browser <browser>`: Browser (chromium, firefox, webkit)

### Check test run status

```bash
qaai-cli status --run-id <run-id>
```

### List test plans

```bash
qaai-cli plans --list
```

## CI/CD Integration

### GitHub Actions

```yaml
name: QA Tests

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run QA Tests
        env:
          QAAI_API_URL: ${{ secrets.QAAI_API_URL }}
          QAAI_API_KEY: ${{ secrets.QAAI_API_KEY }}
        run: |
          npm install -g qaai-cli
          qaai-cli run --plan "Smoke Test" --wait --exit-code-on-fail
```

### GitLab CI

```yaml
test:
  script:
    - npm install -g qaai-cli
    - qaai-cli run --plan "Smoke Test" --wait --exit-code-on-fail
  variables:
    QAAI_API_URL: "http://qaai.example.com"
    QAAI_API_KEY: "${QAAI_API_KEY}"
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh '''
                    npm install -g qaai-cli
                    qaai-cli run --plan "Smoke Test" --wait --exit-code-on-fail
                '''
            }
            environment {
                QAAI_API_URL = 'http://qaai.example.com'
                QAAI_API_KEY = credentials('qaai-api-key')
            }
        }
    }
}
```

