# UI Explorer

Exhaustive UI exploration testing tool that automatically crawls web applications, building a state-machine graph while running accessibility and responsive validation at each state.

## Features

- **Exhaustive Exploration**: Discovers and clicks every interactive element, building a complete state graph
- **Accessibility Testing**: WCAG 2.1 AA validation via axe-core at every state
- **Responsive Validation**: Detects horizontal overflow, undersized touch targets
- **Multi-Viewport**: Tests at mobile (375px), tablet (768px), and desktop (1280px)
- **Playwright Test Generation**: Outputs regression tests for discovered paths
- **Visual Reports**: Interactive HTML report with state graph visualization

## Installation

```bash
npm install -g ui-explorer
```

Or run directly with npx:

```bash
npx ui-explorer http://localhost:3000
```

## Quick Start

```bash
# Basic exploration
ui-explorer http://localhost:5173

# With authentication
ui-explorer http://localhost:5173 --auth ./playwright/.auth/user.json

# Multiple starting points
ui-explorer http://localhost:5173/songs http://localhost:5173/setlists

# Limit exploration
ui-explorer http://localhost:5173 --max-depth 5 --max-states 100
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--auth <path>` | Playwright storage state for authentication | - |
| `--output <dir>` | Output directory for reports | `./ui-explorer-reports` |
| `--format <types>` | Output formats (html,json,playwright) | `html,json` |
| `--viewports <sizes>` | Viewports to test (mobile,tablet,desktop) | `mobile,desktop` |
| `--max-depth <n>` | Maximum actions from start state | `10` |
| `--max-states <n>` | Maximum unique states to explore | `500` |
| `--timeout <ms>` | Action timeout | `5000` |
| `--headless` | Run in headless mode | `true` |
| `--ignore <selectors>` | CSS selectors to ignore (comma-separated) | - |

## Configuration File

Create `ui-explorer.config.js` in your project:

```javascript
export default {
  baseUrl: 'http://localhost:5173',
  auth: './playwright/.auth/user.json',

  viewports: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 720 },
  },

  exploration: {
    maxDepth: 10,
    maxStates: 500,
    timeout: 5000,
  },

  validators: {
    accessibility: {
      enabled: true,
      rules: ['wcag2aa'],
    },
    responsive: {
      enabled: true,
      checkOverflow: true,
      minTouchTarget: 44,
    },
  },

  ignore: [
    'button:has-text("Logout")',
    'a[href*="logout"]',
  ],

  output: {
    dir: './ui-explorer-reports',
    formats: ['html', 'json', 'playwright'],
  },
}
```

## How It Works

1. **State Capture**: At each URL/DOM state, captures a fingerprint (URL + DOM hash)
2. **Action Discovery**: Finds all interactive elements (buttons, links, inputs, etc.)
3. **Exploration**: BFS traversal - click each element, record resulting state
4. **Validation**: At each state, runs accessibility and responsive validators
5. **Graph Building**: Constructs state-flow graph of all transitions
6. **Reporting**: Generates HTML report and optionally Playwright tests

## Output

### HTML Report
Interactive visualization showing:
- State graph (nodes = pages, edges = actions)
- Click nodes to see screenshots and issues
- Filter by issue severity
- Highlight coverage gaps

### JSON Report
Machine-readable format for CI integration:
```json
{
  "states": [...],
  "transitions": [...],
  "issues": {
    "accessibility": [...],
    "responsive": [...],
    "functional": [...]
  },
  "coverage": {
    "statesExplored": 45,
    "actionsPerformed": 123,
    "issuesFound": 7
  }
}
```

### Playwright Tests
Generated regression tests for each discovered path:
```typescript
test('path-songs-add-modal-submit', async ({ page }) => {
  await page.goto('/songs')
  await page.getByRole('button', { name: 'Add Song' }).click()
  // ... assertions
})
```

## Programmatic API

```typescript
import { Explorer, createConfig } from 'ui-explorer'

const config = createConfig({
  baseUrl: 'http://localhost:5173',
  auth: './auth.json',
})

const explorer = new Explorer(config)
const graph = await explorer.explore()

console.log(`Found ${graph.states.size} states`)
console.log(`Issues: ${graph.getAllIssues().length}`)
```

## License

MIT
