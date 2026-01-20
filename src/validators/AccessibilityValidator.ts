/**
 * AccessibilityValidator - WCAG compliance testing via axe-core
 *
 * Runs accessibility scans at each state and reports violations.
 */

import type { Page } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import type { Issue, IssueSeverity, ValidatorResult, ViewportName } from '../core/types.js'

export interface AccessibilityValidatorConfig {
  /** Enable accessibility validation */
  enabled: boolean
  /** WCAG rule sets to test against */
  rules?: string[]
  /** Elements to exclude from scanning */
  exclude?: string[]
  /** Additional rules to disable */
  disableRules?: string[]
  /** Axe rules to ignore (issues will be filtered out of results) */
  ignoredRules?: string[]
  /** Only report issues at or above this severity */
  minSeverity?: IssueSeverity
}

const DEFAULT_CONFIG: AccessibilityValidatorConfig = {
  enabled: true,
  rules: ['wcag21aa'],
  exclude: [],
  disableRules: [],
  ignoredRules: [],
  minSeverity: 'minor',
}

// Map axe-core impact to our severity levels
const IMPACT_TO_SEVERITY: Record<string, IssueSeverity> = {
  critical: 'critical',
  serious: 'serious',
  moderate: 'moderate',
  minor: 'minor',
}

const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'serious', 'moderate', 'minor']

export class AccessibilityValidator {
  private config: AccessibilityValidatorConfig

  constructor(config: Partial<AccessibilityValidatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Run accessibility scan on the current page
   */
  async validate(page: Page, viewport: ViewportName): Promise<ValidatorResult> {
    if (!this.config.enabled) {
      return { validator: 'accessibility', issues: [], duration: 0 }
    }

    const startTime = Date.now()
    const issues: Issue[] = []

    try {
      // Build the axe scanner
      let builder = new AxeBuilder({ page })

      // Apply WCAG rule sets
      if (this.config.rules && this.config.rules.length > 0) {
        builder = builder.withTags(this.config.rules)
      }

      // Exclude elements
      if (this.config.exclude) {
        for (const selector of this.config.exclude) {
          builder = builder.exclude(selector)
        }
      }

      // Disable specific rules
      if (this.config.disableRules && this.config.disableRules.length > 0) {
        builder = builder.disableRules(this.config.disableRules)
      }

      // Run the scan
      const results = await builder.analyze()

      // Convert violations to issues
      for (const violation of results.violations) {
        // Skip ignored rules
        if (this.config.ignoredRules && this.config.ignoredRules.includes(violation.id)) {
          continue
        }

        const severity = IMPACT_TO_SEVERITY[violation.impact || 'minor'] || 'minor'

        // Filter by minimum severity
        if (this.config.minSeverity) {
          const minIndex = SEVERITY_ORDER.indexOf(this.config.minSeverity)
          const currentIndex = SEVERITY_ORDER.indexOf(severity)
          if (currentIndex > minIndex) continue
        }

        // Create an issue for each violation
        const issue: Issue = {
          type: 'accessibility',
          severity,
          rule: violation.id,
          description: violation.description,
          helpUrl: violation.helpUrl,
          viewport,
          elements: violation.nodes.map((node) => node.target.join(' > ')),
          details: {
            help: violation.help,
            impact: violation.impact,
            tags: violation.tags,
            nodes: violation.nodes.map((node) => ({
              html: node.html,
              target: node.target,
              failureSummary: node.failureSummary,
            })),
          },
        }

        issues.push(issue)
      }

      // Also capture incomplete checks (need manual review)
      for (const incomplete of results.incomplete) {
        // Only report as minor issues
        const issue: Issue = {
          type: 'accessibility',
          severity: 'minor',
          rule: `${incomplete.id}-incomplete`,
          description: `Manual review needed: ${incomplete.description}`,
          helpUrl: incomplete.helpUrl,
          viewport,
          elements: incomplete.nodes.map((node) => node.target.join(' > ')),
          details: {
            help: incomplete.help,
            needsReview: true,
            nodes: incomplete.nodes.length,
          },
        }

        issues.push(issue)
      }
    } catch (err) {
      // Report scan failure as an issue
      issues.push({
        type: 'accessibility',
        severity: 'moderate',
        rule: 'scan-error',
        description: `Accessibility scan failed: ${(err as Error).message}`,
        viewport,
        details: { error: (err as Error).message },
      })
    }

    return {
      validator: 'accessibility',
      issues,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Get a summary of issues by severity
   */
  summarizeIssues(issues: Issue[]): Record<IssueSeverity, number> {
    const summary: Record<IssueSeverity, number> = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    }

    for (const issue of issues) {
      if (issue.type === 'accessibility') {
        summary[issue.severity]++
      }
    }

    return summary
  }

  /**
   * Check if issues meet a minimum passing threshold
   */
  meetsThreshold(
    issues: Issue[],
    maxCritical = 0,
    maxSerious = 0
  ): boolean {
    const summary = this.summarizeIssues(issues)
    return summary.critical <= maxCritical && summary.serious <= maxSerious
  }

  /**
   * Generate a report of accessibility issues
   */
  generateReport(issues: Issue[]): string {
    const a11yIssues = issues.filter((i) => i.type === 'accessibility')

    if (a11yIssues.length === 0) {
      return '# Accessibility Report\n\nNo accessibility issues found.'
    }

    let report = '# Accessibility Report\n\n'

    const summary = this.summarizeIssues(a11yIssues)
    report += '## Summary\n\n'
    report += `- Critical: ${summary.critical}\n`
    report += `- Serious: ${summary.serious}\n`
    report += `- Moderate: ${summary.moderate}\n`
    report += `- Minor: ${summary.minor}\n\n`

    // Group by rule
    const byRule = new Map<string, Issue[]>()
    for (const issue of a11yIssues) {
      const existing = byRule.get(issue.rule) || []
      existing.push(issue)
      byRule.set(issue.rule, existing)
    }

    report += '## Issues by Rule\n\n'

    for (const [rule, ruleIssues] of byRule) {
      const first = ruleIssues[0]
      report += `### ${rule} (${ruleIssues.length} occurrence(s))\n\n`
      report += `**Severity:** ${first.severity}\n\n`
      report += `${first.description}\n\n`

      if (first.helpUrl) {
        report += `[Learn more](${first.helpUrl})\n\n`
      }

      report += '**Affected Elements:**\n\n'
      const allElements = ruleIssues.flatMap((i) => i.elements || [])
      for (const element of allElements.slice(0, 5)) {
        report += `- \`${element}\`\n`
      }
      if (allElements.length > 5) {
        report += `- ... and ${allElements.length - 5} more\n`
      }

      report += '\n'
    }

    return report
  }
}
