# Contributing to EVA

Thank you for your interest in contributing to EVA! This document provides guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/eva-qa.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

```bash
# Build the project
npm run build

# Watch mode during development
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Testing

All new features and bug fixes should include tests. We use Vitest for testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run a specific test file
npm test -- src/__tests__/StateManager.test.ts
```

## Code Style

- Use TypeScript with strict mode
- Follow existing code patterns
- Keep functions focused and small
- Add JSDoc comments for public APIs

## Pull Request Process

1. Ensure all tests pass: `npm test`
2. Ensure code lints: `npm run lint`
3. Update documentation if needed
4. Write a clear PR description explaining the change

## Commit Messages

Use conventional commit format:

```
feat: add new validator for form inputs
fix: resolve timeout issue in ActionDiscovery
docs: update README with new CLI options
test: add tests for ResponsiveValidator
```

## Reporting Issues

When reporting issues, please include:

- EVA version (`npm list eva-qa`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant error messages or logs

## Questions?

Open an issue with the "question" label or start a discussion on GitHub.
