# EVA QA Roadmap

> Last updated: 2026-01-20

## Vision

EVA is a **complementary "second opinion" tool** for web application quality assurance. It won't replace Lighthouse, axe, or Playwright test suites - but it catches what they miss through state-based exploration.

**The pitch:** *"Run EVA in 15 seconds before you push. It catches what your other tools miss."*

---

## Current State (v0.1.1)

### Features
- 5 validators: Accessibility (axe-core), Responsive, Network, BrokenLinks, Console
- 5 CLI presets: quick, a11y, responsive, links, full
- Baseline/regression tracking
- Multi-viewport support (mobile, tablet, desktop)
- Output formats: HTML, JSON, JUnit XML
- Authentication: Playwright state, cookies, headers
- Supabase adapter for database verification

### Gaps
- Sequential exploration (slow)
- Touch target false positives
- No GitHub Action
- No guided setup (`eva init`)
- API verification incomplete

---

## Phase 1: Quality & Accuracy
*Status: In Progress*

### 1.1 Smart Touch Target Detection
**Problem:** False positives on decorative icons, icons inside buttons

**Solution:** Add heuristics to skip:
- `aria-hidden="true"` (decorative)
- `role="presentation"` or `role="none"`
- `pointer-events: none`
- Icons inside larger clickable parents (the parent is the real target)

**File:** `src/validators/ResponsiveValidator.ts`

### 1.2 Configurable Severity Thresholds
**Problem:** One-size-fits-all severity doesn't match all projects

**Solution:** Allow per-validator severity overrides in config

### 1.3 Better Error Messages
**Problem:** Some errors are technical, not actionable

**Solution:** Add "how to fix" suggestions to common issues

---

## Phase 2: Performance
*Status: Planned*

### 2.1 Parallel State Exploration
**Problem:** Sequential BFS is slow (~50s for 4 states)

**Solution:** Worker pool for multi-page parallel exploration
- Spawn N browser contexts (default: 3)
- Each worker pulls from shared queue
- Merge results at end

**Expected speedup:** 3-5x (target: <15s for same coverage)

**Files:** `src/core/Explorer.ts`, new `src/core/WorkerPool.ts`

### 2.2 Lazy Validator Loading
**Problem:** All validators instantiated even if disabled

**Solution:** Only load enabled validators

### 2.3 Smart Screenshot Capture
**Problem:** Full-page screenshots for every state

**Solution:** Viewport-only by default, full-page on error only

---

## Phase 3: Adoption
*Status: Planned*

### 3.1 GitHub Action
**Problem:** Manual CLI invocation in CI

**Solution:** Official GitHub Action

```yaml
- uses: eva-qa/action@v1
  with:
    url: ${{ env.PREVIEW_URL }}
    mode: quick
```

### 3.2 PR Comment Integration
**Problem:** Reports only in artifacts

**Solution:** Post summary as PR comment with issue counts

### 3.3 `eva init` Command
**Problem:** No guided setup

**Solution:** Interactive config generator

```bash
eva init
# ? What framework? (React, Vue, Next.js, Other)
# ? Use authentication? (Yes/No)
# ? Output directory? (./eva-qa-reports)
# Created eva.config.json
```

---

## Phase 4: Differentiation
*Status: Future*

### 4.1 Interaction-Triggered A11y Detection
**Problem:** axe only scans static page

**Solution:** Re-run axe after each interaction, diff results

**Use case:** Modal opens without focus trap, dropdown has no keyboard nav

### 4.2 Cross-Page Consistency Checking
**Problem:** No tool checks design consistency across routes

**Solution:** Track element styles across states, flag inconsistencies

**Use case:** Button is blue on /home but green on /settings

### 4.3 Playwright Test Export
**Problem:** Findings don't convert to regression tests

**Solution:** Generate .spec.ts from exploration path

```typescript
test('navigation to /settings', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Settings');
  await expect(page).toHaveURL(/settings/);
});
```

---

## What We Won't Build

| Feature | Reason |
|---------|--------|
| Performance metrics (LCP, CLS) | Lighthouse does this better |
| SEO analysis | Not EVA's niche, many tools exist |
| Visual regression (screenshot diff) | Percy, Chromatic are purpose-built |
| Unit test generation | Different problem domain |
| Code coverage | Istanbul/c8 exist |

---

## Priority Order

| # | Enhancement | ROI | Effort |
|---|-------------|-----|--------|
| 1 | Smart touch target detection | High | Low |
| 2 | Parallel exploration | High | Medium |
| 3 | GitHub Action | High | Low |
| 4 | `eva init` command | Medium | Low |
| 5 | Interaction-triggered a11y | Medium | Medium |
| 6 | PR comment integration | Medium | Low |
| 7 | Playwright test export | Low | Medium |
| 8 | Consistency validator | Low | High |

---

## Contributing

See GitHub Issues for specific tasks. Each phase item should have a corresponding issue for tracking.
