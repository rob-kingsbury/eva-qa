# EVA - Explore, Validate, Analyze

Zero-config UI testing that crawls your app and finds accessibility, responsive, and functional issues. Works with **any framework** - React, Vue, Angular, Django, Rails, or plain HTML.

## Quick Start

```bash
# Just run it
npx eva-qa http://localhost:3000
```

That's it. No config needed. You'll get:
- **Accessibility issues** (WCAG 2.1 AA)
- **Responsive problems** (overflow, touch targets)
- **Compliance score** (e.g., "87% - Grade B")
- **Visual HTML report**

## Concepts Glossary

New to web testing? Here's what the terms mean:

| Term | Plain English |
|------|---------------|
| **Viewport** | Screen size EVA tests at (mobile = phone, tablet = iPad, desktop = laptop) |
| **Headless** | Browser runs invisibly in background. Use `--no-headless` to see it |
| **WCAG** | Web Content Accessibility Guidelines - rules for making sites usable by everyone |
| **Axe-core** | Industry-standard accessibility testing engine (used by EVA) |
| **States** | Each unique screen in your app (home page, modal open, form filled, etc.) |
| **Depth** | How many clicks deep from start page (depth 3 = click → click → click) |
| **Touch targets** | Buttons/links - should be at least 44x44px for fingers to tap |
| **Zoom testing** | Verifying site works when users zoom in (WCAG requires 200% support) |
| **Baseline** | Snapshot of issues at a point in time, used to track regressions |

## How It Works

EVA explores your app like a user would - clicking buttons, filling forms, navigating links. At each state, it validates:

| Check | What It Finds |
|-------|---------------|
| **Accessibility** | Missing alt text, color contrast, keyboard navigation, ARIA issues |
| **Responsive** | Horizontal overflow, touch targets too small (<44px), layout breaks |
| **Console** | JavaScript errors, unhandled exceptions |
| **Network** | Failed requests, slow responses |

## Preset Modes

Pick what you need:

```bash
# Quick scan (default) - fast a11y + responsive check
npx eva-qa http://localhost:3000

# Accessibility only - WCAG 2.1 AA validation
npx eva-qa a11y http://localhost:3000

# Responsive only - overflow and touch targets on mobile/tablet/desktop
npx eva-qa responsive http://localhost:3000

# Full exploration - deep crawl with all validators
npx eva-qa full http://localhost:3000
```

### Preset Details

| Mode | Depth | States | Viewports | Validators |
|------|-------|--------|-----------|------------|
| `quick` | 3 | 50 | mobile, desktop | a11y, responsive |
| `a11y` | 5 | 100 | desktop | a11y only |
| `responsive` | 5 | 100 | mobile, tablet, desktop | responsive only |
| `full` | 10 | 500 | mobile, desktop | all |

## Common Options

```bash
# With authentication (see Auth Setup below)
npx eva-qa http://localhost:3000 --auth ./playwright/.auth/user.json

# Simple cookie-based auth (Django, Rails, PHP sessions)
npx eva-qa http://localhost:3000 --cookie "sessionid=abc123" --cookie "csrftoken=xyz789"

# Header-based auth (API tokens, Bearer tokens)
npx eva-qa http://localhost:3000 --header "Authorization: Bearer your-token"

# CI mode - exit 1 on critical/serious issues
npx eva-qa http://localhost:3000 --ci

# Show compliance score
npx eva-qa http://localhost:3000 --score

# Custom timeout (default: 10000ms)
npx eva-qa http://localhost:3000 --timeout 30000

# See the browser
npx eva-qa http://localhost:3000 --no-headless

# Ignore certain elements
npx eva-qa http://localhost:3000 --ignore "button:has-text('Logout')"

# Override preset settings
npx eva-qa http://localhost:3000 --depth 5 --states 100

# Choose output formats (html, json, junit)
npx eva-qa http://localhost:3000 --format html,json,junit

# Test at different zoom levels (WCAG 2.1 requires 200% zoom support)
npx eva-qa http://localhost:3000 --zoom "100,150,200"
```

## Zoom Level Testing

WCAG 2.1 Success Criterion 1.4.4 requires content to remain functional at 200% zoom. EVA can test your site at multiple zoom levels:

```bash
# Test at common zoom levels
npx eva-qa http://localhost:3000 --zoom "100,150,200"

# Test at higher zoom for low-vision users
npx eva-qa http://localhost:3000 --zoom "200,300,400"

# Combine with accessibility checks
npx eva-qa a11y http://localhost:3000 --zoom "150,200"
```

### What Zoom Testing Detects

| Issue | Description |
|-------|-------------|
| `zoom-overflow` | Content extends beyond viewport, requiring horizontal scroll |
| `zoom-interactive-overlap` | Buttons/links overlap, making them hard to click |
| `zoom-text-truncation` | Important text gets cut off at higher zoom |

Zoom issues at 200% or below are marked as **serious** (WCAG requirement). Issues at higher zoom levels are marked as **moderate** (best practice).

## Output

Reports are saved to `./eva-qa-reports/`:

| File | Purpose | Who Uses It |
|------|---------|-------------|
| `report.html` | Visual report with score and screenshots | Developers, designers, PMs |
| `report.json` | Machine-readable with compliance score | Scripts, dashboards, tracking |
| `report.xml` | JUnit XML format | Jenkins, GitLab CI, TestRail |

### Compliance Score

EVA calculates a compliance percentage and letter grade:

```
Compliance Score: 87% (B)
  Accessibility: 90%
  Responsive: 82%
  Good baseline. 2 critical/serious issues to address.
```

Grading: A (90-100%), B (80-89%), C (70-79%), D (60-69%), F (<60%)

## Auth Setup

### Simple: Cookie/Header Auth

For session-based apps (Django, Rails, PHP, Express):

```bash
# Single cookie
npx eva-qa http://localhost:3000 --cookie "sessionid=abc123"

# Multiple cookies (Django with CSRF)
npx eva-qa http://localhost:3000 --cookie "sessionid=abc123" --cookie "csrftoken=xyz789"

# API token
npx eva-qa http://localhost:3000 --header "Authorization: Bearer your-token"

# Multiple headers
npx eva-qa http://localhost:3000 --header "Authorization: Bearer token" --header "X-API-Key: key123"
```

### Advanced: Playwright Auth State

For complex login flows (OAuth, 2FA, CAPTCHAs):

```bash
# 1. Install Playwright (if not already)
npm install -D @playwright/test

# 2. Create a setup script (auth-setup.js)
```

```javascript
// auth-setup.js
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://localhost:3000/login');
await page.fill('input[type="email"]', 'your@email.com');
await page.fill('input[type="password"]', 'your-password');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');

// Save the authenticated state
await context.storageState({ path: './playwright/.auth/user.json' });
await browser.close();
```

```bash
# 3. Run it once
node auth-setup.js

# 4. Use with EVA
npx eva-qa http://localhost:3000 --auth ./playwright/.auth/user.json
```

## CI Integration

### GitHub Actions

```yaml
- name: Install Playwright
  run: npx playwright install chromium

- name: Run EVA
  run: npx eva-qa ${{ env.PREVIEW_URL }} --ci --format html,json,junit

- name: Upload reports
  uses: actions/upload-artifact@v4
  with:
    name: eva-reports
    path: eva-qa-reports/
```

### Jenkins (with JUnit)

```groovy
stage('Accessibility') {
  steps {
    sh 'npx eva-qa $STAGING_URL --ci --format junit'
    junit 'eva-qa-reports/report.xml'
  }
}
```

EVA exits with code 1 when critical or serious issues are found.

## Baseline & Regression Tracking

Track accessibility progress over time by saving baselines and comparing against them:

```bash
# Create a baseline (saves current issues)
npx eva-qa baseline http://localhost:3000

# Make changes to your app, then compare
npx eva-qa compare http://localhost:3000

# Use in CI - fails if new issues are introduced
npx eva-qa compare http://localhost:3000 --ci

# Name baselines for different environments
npx eva-qa baseline http://localhost:3000 --name "v2.0-release"
npx eva-qa compare http://localhost:3000 --baseline "v2.0-release"

# List all saved baselines
npx eva-qa baselines
```

### What Baselines Track

| Metric | Description |
|--------|-------------|
| **Regressions** | New issues not in the baseline (bad) |
| **Fixed** | Issues in baseline that are now resolved (good) |
| **Unchanged** | Issues present in both (no change) |
| **Score Delta** | Change in compliance percentage |

### CI Integration with Baselines

```yaml
# GitHub Actions
- name: Check for regressions
  run: |
    npx eva-qa compare ${{ env.PREVIEW_URL }} --ci
    # Fails if new issues introduced
```

Baselines are stored in `./eva-qa-reports/baselines/` as JSON files.

## Docker

For air-gapped environments or CI without Node.js:

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/your-username/ui-explorer:latest

# Run against host machine
docker run --rm ghcr.io/your-username/ui-explorer http://host.docker.internal:3000

# With authentication
docker run --rm \
  -e "EVA_COOKIE=sessionid=abc123" \
  ghcr.io/your-username/ui-explorer http://host.docker.internal:3000

# Mount volume for reports
docker run --rm \
  -v $(pwd)/reports:/app/eva-qa-reports \
  ghcr.io/your-username/ui-explorer http://host.docker.internal:3000
```

### Build Locally

```bash
# Build from source
docker build -t eva-qa .

# Run local image
docker run --rm eva-qa http://host.docker.internal:3000
```

## Advanced: Database Verification

For full-stack testing, set Supabase credentials via environment variables:

```bash
# Set credentials (recommended for security)
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-key

# Run EVA - credentials are read automatically
npx eva-qa full http://localhost:3000
```

This verifies database changes after actions (row inserts, RLS policies, etc).

## Advanced: Config File

For complex setups, create `eva.config.json` (JSON format required for security):

```json
{
  "baseUrl": "http://localhost:5173",
  "auth": "./playwright/.auth/user.json",
  "actionSchemas": [
    {
      "match": { "selector": "button", "text": "add song" },
      "setup": [
        { "fill": "[placeholder*=\"title\"]", "value": "Test Song" }
      ],
      "expects": [
        { "database": { "table": "songs", "change": "insert" } },
        { "ui": { "hidden": ["[role=\"dialog\"]"] } }
      ]
    }
  ],
  "ignore": ["button:has-text(\"Logout\")"]
}
```

Then run:

```bash
npx eva-qa --config ./eva.config.json
```

> **Note**: Only JSON config files are supported. JavaScript config files are not allowed for security reasons.

## Programmatic API

```typescript
import { Explorer } from 'eva-qa'
import type { ExplorerConfig, ExplorerEvent, ExplorationResult } from 'eva-qa'

// Basic usage
const config: ExplorerConfig = {
  baseUrl: 'http://localhost:3000',
  exploration: {
    maxDepth: 5,
    maxStates: 100,
    viewports: ['mobile', 'desktop'],
  },
  validators: {
    accessibility: { enabled: true },
    responsive: { enabled: true },
  },
}

const explorer = new Explorer(config)

// Optional: Listen to events
explorer.on((event: ExplorerEvent) => {
  if (event.type === 'state:visited') {
    console.log(`Visited: ${event.state.url}`)
  }
})

const result: ExplorationResult = await explorer.explore()

console.log(`Score: ${result.summary.issuesFound} issues`)
console.log(`States: ${result.summary.statesExplored}`)
```

See [types.ts](./src/core/types.ts) for full type definitions.

## What EVA Does NOT Do

- **Visual regression testing** - Use Percy, Chromatic, or Playwright's visual comparison
- **Unit/integration tests** - Use Vitest, Jest, or Testing Library
- **API testing** - Use Postman, Hoppscotch, or REST clients
- **Load testing** - Use k6, Artillery, or Locust

EVA is focused on exploratory UI quality: accessibility, responsiveness, and catching issues that manual testing often misses.

## Troubleshooting

### "Connection refused" or "Could not connect"
Your dev server isn't running. Start it first (`npm run dev`), then run EVA.

### "Timeout waiting for network idle"
Your app may have long-polling or websockets. Add `--timeout 15000` or configure `exploration.timeout` in the config file.

### "No states explored"
EVA couldn't find any actions on the page. Make sure the app is running and the URL is correct. Try `--no-headless` to watch what's happening.

### "Auth state expired"
Re-run your auth setup script to generate a fresh `user.json` file. Or use `--cookie` for simpler session auth.

## Framework Compatibility

EVA is framework-agnostic - it tests URLs, not source code:

| Framework | Status | Notes |
|-----------|--------|-------|
| React/Next.js | ✅ | Works great |
| Vue/Nuxt | ✅ | Works great |
| Angular | ✅ | Works great |
| Svelte/SvelteKit | ✅ | Works great |
| Django/Rails/PHP | ✅ | Use `--cookie` for session auth |
| Static HTML | ✅ | Works great |

## License

MIT
