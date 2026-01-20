# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in EVA, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: [security@example.com] (replace with actual email)
3. Or use GitHub's private vulnerability reporting feature

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 24-48 hours
  - High: Within 7 days
  - Medium: Within 30 days
  - Low: Next regular release

## Security Measures

### Config File Security

EVA only accepts JSON configuration files. JavaScript/TypeScript config files are not supported to prevent arbitrary code execution.

```bash
# Supported
eva --config ./eva.config.json

# Not supported (for security)
eva --config ./eva.config.js
```

### Credential Handling

**Recommended**: Use environment variables for sensitive credentials:

```bash
# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-key

# Run EVA (credentials read from environment)
eva http://localhost:3000
```

**Avoid**: Passing secrets via CLI arguments (visible in process lists):

```bash
# Not recommended - visible in `ps aux`
eva http://localhost:3000 --supabase-key your-key
```

### URL Validation

EVA only navigates to `http://` and `https://` URLs. Other protocols (file://, javascript:, etc.) are blocked.

### Output Path Validation

EVA validates that output directories are within the current working directory to prevent path traversal attacks.

### HTML Report Security

- All user-controlled content is HTML-escaped
- Help URLs are validated against a whitelist of trusted domains
- Reports include `rel="noopener noreferrer"` on external links

## Known Limitations

1. **Console Error Capture**: Console errors from scanned pages are captured and may appear in reports. If you're scanning untrusted sites, review reports before sharing.

2. **Screenshot Content**: Screenshots capture the full page content, which may include sensitive data displayed on the page.

3. **Authentication State**: Playwright auth state files contain session tokens. Keep these files secure and don't commit them to version control.

## Dependency Security

Run `npm audit` regularly to check for vulnerabilities in dependencies:

```bash
npm audit
```

Current status: All runtime dependencies are from reputable sources with no known critical vulnerabilities.

## Security Updates

Security updates are released as patch versions (e.g., 0.1.1, 0.1.2). Always use the latest patch version.

```bash
npm update eva-qa
```

## Secure Usage Recommendations

1. **Don't scan untrusted URLs** without reviewing the output
2. **Keep auth files private** - add `playwright/.auth/` to `.gitignore`
3. **Use environment variables** for API keys and secrets
4. **Review HTML reports** before sharing with others
5. **Run in CI with --ci flag** for automated security gates

## Version History

| Version | Security Notes |
|---------|----------------|
| 0.1.0   | Initial release with security hardening |
