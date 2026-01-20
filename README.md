# EVA - Explore, Validate, Analyze

Zero-config UI testing that crawls your app and finds accessibility, responsive, and functional issues.

## Quick Start

```bash
# Just run it
npx eva-qa http://localhost:3000
```

That's it. No config needed. You'll get:
- Accessibility issues (WCAG 2.1 AA)
- Responsive problems (overflow, touch targets)
- A visual HTML report

## How It Works

EVA explores your app like a user would - clicking buttons, filling forms, navigating links. At each state, it validates:

| Check | What It Finds |
|-------|---------------|
| **Accessibility** | Missing alt text, color contrast, keyboard navigation, ARIA issues |
| **Responsive** | Horizontal overflow, touch targets too small (<44px), layout breaks |
| **Console** | JavaScript errors, unhandled exceptions |
| **Network** | Failed requests, slow responses |

### Key Concepts

- **States**: Each unique UI view (page, modal, dropdown open, etc.)
- **Depth**: How many clicks deep from the starting page
- **Actions**: Buttons, links, form interactions EVA discovers and executes

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

# CI mode - exit 1 on critical/serious issues
npx eva-qa http://localhost:3000 --ci

# See the browser
npx eva-qa http://localhost:3000 --no-headless

# Ignore certain elements
npx eva-qa http://localhost:3000 --ignore "button:has-text('Logout')"

# Override preset settings
npx eva-qa http://localhost:3000 --depth 5 --states 100
```

## Output

Reports are saved to `./eva-qa-reports/`:
- `report.html` - Visual report with issue details
- `report.json` - Machine-readable for CI integration

## Auth Setup

For apps that require login, you need a Playwright auth state file:

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

```yaml
# GitHub Actions
- name: Install Playwright
  run: npx playwright install chromium

- name: Run EVA
  run: npx eva-qa ${{ env.PREVIEW_URL }} --ci
```

EVA exits with code 1 when critical or serious issues are found.

## Advanced: Database Verification

For full-stack testing, add Supabase credentials:

```bash
npx eva-qa full http://localhost:3000 \
  --supabase-url $SUPABASE_URL \
  --supabase-key $SUPABASE_SERVICE_KEY
```

This verifies database changes after actions (row inserts, RLS policies, etc).

## Advanced: Config File

For complex setups, create `eva.config.js`:

```javascript
export default {
  baseUrl: 'http://localhost:5173',
  auth: './playwright/.auth/user.json',

  // Define expected side-effects for specific actions
  actionSchemas: [
    {
      match: { selector: 'button', text: /add song/i },
      setup: [
        { fill: '[placeholder*="title"]', value: 'Test Song' },
      ],
      expects: [
        { database: { table: 'songs', change: 'insert' } },
        { ui: { hidden: ['[role="dialog"]'] } },
      ],
    },
  ],

  ignore: ['button:has-text("Logout")'],
}
```

Then run:

```bash
npx eva-qa --config ./eva.config.js
```

## Programmatic API

```typescript
import { Explorer, createConfig } from 'eva-qa'

const explorer = new Explorer(createConfig({
  baseUrl: 'http://localhost:3000',
}))

const result = await explorer.explore()
console.log(`Found ${result.summary.issuesFound} issues`)
```

## What EVA Does NOT Do

- **Visual regression testing** - Use Percy, Chromatic, or Playwright's visual comparison
- **Unit/integration tests** - Use Vitest, Jest, or Testing Library
- **API testing** - Use Postman, Hoppscotch, or REST clients
- **Load testing** - Use k6, Artillery, or Locust

EVA is focused on exploratory UI quality: accessibility, responsiveness, and catching issues that manual testing often misses.

## Troubleshooting

### "Timeout waiting for network idle"
Your app may have long-polling or websockets. Add `--timeout 15000` or configure `exploration.timeout` in the config file.

### "No states explored"
EVA couldn't find any actions on the page. Make sure the app is running and the URL is correct. Try `--no-headless` to watch what's happening.

### "Auth state expired"
Re-run your auth setup script to generate a fresh `user.json` file.

## License

MIT
