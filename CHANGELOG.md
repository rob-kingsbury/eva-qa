# Changelog

All notable changes to EVA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-20

### Added

- Initial release of EVA (Explore, Validate, Analyze)
- **Core Explorer** - State machine-based UI exploration
  - Automatic action discovery (buttons, links, forms)
  - Configurable depth and state limits
  - Multi-viewport testing support
- **Accessibility Validator** - WCAG 2.1 AA compliance checking
  - Powered by axe-core
  - Color contrast validation
  - ARIA attribute checking
  - Keyboard navigation issues
- **Responsive Validator** - Layout and touch target validation
  - Horizontal overflow detection
  - Touch target size checking (44px minimum)
  - Multi-viewport testing (mobile, tablet, desktop)
- **State Manager** - Smart state fingerprinting
  - DOM-based state identification
  - Duplicate state detection
  - State graph building
- **CLI Interface** - Zero-config command line tool
  - Preset modes: quick, a11y, responsive, full
  - Authentication support via Playwright storage state
  - CI mode with exit codes
  - HTML and JSON report generation
- **Programmatic API** - For custom integrations
  - `Explorer` class for exploration
  - `createConfig()` helper for configuration
  - Full TypeScript support with type exports
- **Supabase Adapter** - Database verification for full-stack testing
  - Row change detection
  - RLS policy verification

### Technical

- TypeScript with strict mode
- ESM-first with NodeNext module resolution
- 146 passing tests
- Playwright-based browser automation
