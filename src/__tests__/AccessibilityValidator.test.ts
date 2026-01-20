/**
 * AccessibilityValidator Tests
 *
 * Tests for WCAG accessibility validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AccessibilityValidator } from '../validators/AccessibilityValidator.js'
import type { Issue } from '../core/types.js'

// Mock axe-core/playwright
vi.mock('@axe-core/playwright', () => ({
  default: vi.fn().mockImplementation(() => ({
    withTags: vi.fn().mockReturnThis(),
    exclude: vi.fn().mockReturnThis(),
    disableRules: vi.fn().mockReturnThis(),
    analyze: vi.fn().mockResolvedValue({
      violations: [],
      incomplete: [],
      passes: [],
    }),
  })),
}))

describe('AccessibilityValidator', () => {
  let validator: AccessibilityValidator

  beforeEach(() => {
    validator = new AccessibilityValidator()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should use default config', () => {
      const v = new AccessibilityValidator()
      expect(v).toBeDefined()
    })

    it('should accept custom config', () => {
      const v = new AccessibilityValidator({
        enabled: true,
        rules: ['wcag2a'],
        exclude: ['#skip-me'],
        disableRules: ['color-contrast'],
        minSeverity: 'serious',
      })
      expect(v).toBeDefined()
    })

    it('should allow disabling', () => {
      const v = new AccessibilityValidator({ enabled: false })
      expect(v).toBeDefined()
    })
  })

  describe('validate', () => {
    it('should return empty results when disabled', async () => {
      const v = new AccessibilityValidator({ enabled: false })
      const mockPage = {} as import('playwright').Page

      const result = await v.validate(mockPage, 'desktop')

      expect(result.validator).toBe('accessibility')
      expect(result.issues).toHaveLength(0)
      expect(result.duration).toBe(0)
    })

    it('should run axe analysis on page', async () => {
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default

      await validator.validate(mockPage, 'desktop')

      expect(AxeBuilder).toHaveBeenCalledWith({ page: mockPage })
    })

    it('should apply WCAG rule tags', async () => {
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default
      const mockBuilder = {
        withTags: vi.fn().mockReturnThis(),
        exclude: vi.fn().mockReturnThis(),
        disableRules: vi.fn().mockReturnThis(),
        analyze: vi.fn().mockResolvedValue({ violations: [], incomplete: [] }),
      }
      ;(AxeBuilder as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBuilder)

      await validator.validate(mockPage, 'desktop')

      expect(mockBuilder.withTags).toHaveBeenCalledWith(['wcag21aa'])
    })

    it('should exclude specified selectors', async () => {
      const v = new AccessibilityValidator({
        enabled: true,
        exclude: ['#skip-element', '.ignore-me'],
      })
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default
      const mockBuilder = {
        withTags: vi.fn().mockReturnThis(),
        exclude: vi.fn().mockReturnThis(),
        disableRules: vi.fn().mockReturnThis(),
        analyze: vi.fn().mockResolvedValue({ violations: [], incomplete: [] }),
      }
      ;(AxeBuilder as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBuilder)

      await v.validate(mockPage, 'desktop')

      expect(mockBuilder.exclude).toHaveBeenCalledWith('#skip-element')
      expect(mockBuilder.exclude).toHaveBeenCalledWith('.ignore-me')
    })

    it('should convert violations to issues', async () => {
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default
      const mockBuilder = {
        withTags: vi.fn().mockReturnThis(),
        exclude: vi.fn().mockReturnThis(),
        disableRules: vi.fn().mockReturnThis(),
        analyze: vi.fn().mockResolvedValue({
          violations: [
            {
              id: 'color-contrast',
              impact: 'serious',
              description: 'Elements must have sufficient color contrast',
              help: 'Ensure foreground and background colors have sufficient contrast',
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
              tags: ['wcag2aa', 'wcag143'],
              nodes: [
                {
                  target: ['#low-contrast-text'],
                  html: '<p id="low-contrast-text">Hard to read</p>',
                  failureSummary: 'Color contrast ratio is 2.5:1',
                },
              ],
            },
          ],
          incomplete: [],
        }),
      }
      ;(AxeBuilder as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBuilder)

      const result = await validator.validate(mockPage, 'desktop')

      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        type: 'accessibility',
        severity: 'serious',
        rule: 'color-contrast',
        description: 'Elements must have sufficient color contrast',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
        viewport: 'desktop',
      })
    })

    it('should map axe impact to severity correctly', async () => {
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default
      const mockBuilder = {
        withTags: vi.fn().mockReturnThis(),
        exclude: vi.fn().mockReturnThis(),
        disableRules: vi.fn().mockReturnThis(),
        analyze: vi.fn().mockResolvedValue({
          violations: [
            { id: 'critical-issue', impact: 'critical', description: 'Critical', nodes: [], tags: [] },
            { id: 'serious-issue', impact: 'serious', description: 'Serious', nodes: [], tags: [] },
            { id: 'moderate-issue', impact: 'moderate', description: 'Moderate', nodes: [], tags: [] },
            { id: 'minor-issue', impact: 'minor', description: 'Minor', nodes: [], tags: [] },
          ],
          incomplete: [],
        }),
      }
      ;(AxeBuilder as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBuilder)

      const result = await validator.validate(mockPage, 'mobile')

      expect(result.issues.find(i => i.rule === 'critical-issue')?.severity).toBe('critical')
      expect(result.issues.find(i => i.rule === 'serious-issue')?.severity).toBe('serious')
      expect(result.issues.find(i => i.rule === 'moderate-issue')?.severity).toBe('moderate')
      expect(result.issues.find(i => i.rule === 'minor-issue')?.severity).toBe('minor')
    })

    it('should filter by minimum severity', async () => {
      const v = new AccessibilityValidator({
        enabled: true,
        minSeverity: 'serious',
      })
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default
      const mockBuilder = {
        withTags: vi.fn().mockReturnThis(),
        exclude: vi.fn().mockReturnThis(),
        disableRules: vi.fn().mockReturnThis(),
        analyze: vi.fn().mockResolvedValue({
          violations: [
            { id: 'critical-issue', impact: 'critical', description: 'Critical', nodes: [], tags: [] },
            { id: 'minor-issue', impact: 'minor', description: 'Minor', nodes: [], tags: [] },
          ],
          incomplete: [],
        }),
      }
      ;(AxeBuilder as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBuilder)

      const result = await v.validate(mockPage, 'desktop')

      // Should only include critical (above serious threshold)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].severity).toBe('critical')
    })

    it('should include incomplete checks as minor issues', async () => {
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default
      const mockBuilder = {
        withTags: vi.fn().mockReturnThis(),
        exclude: vi.fn().mockReturnThis(),
        disableRules: vi.fn().mockReturnThis(),
        analyze: vi.fn().mockResolvedValue({
          violations: [],
          incomplete: [
            {
              id: 'needs-review',
              description: 'Needs manual verification',
              help: 'Check this manually',
              helpUrl: 'https://example.com',
              nodes: [{ target: ['#element'] }],
            },
          ],
        }),
      }
      ;(AxeBuilder as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBuilder)

      const result = await validator.validate(mockPage, 'desktop')

      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].rule).toBe('needs-review-incomplete')
      expect(result.issues[0].severity).toBe('minor')
      expect(result.issues[0].details?.needsReview).toBe(true)
    })

    it('should handle scan errors gracefully', async () => {
      const mockPage = {} as import('playwright').Page
      const AxeBuilder = (await import('@axe-core/playwright')).default
      const mockBuilder = {
        withTags: vi.fn().mockReturnThis(),
        exclude: vi.fn().mockReturnThis(),
        disableRules: vi.fn().mockReturnThis(),
        analyze: vi.fn().mockRejectedValue(new Error('Scan failed')),
      }
      ;(AxeBuilder as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBuilder)

      const result = await validator.validate(mockPage, 'desktop')

      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].rule).toBe('scan-error')
      expect(result.issues[0].severity).toBe('moderate')
      expect(result.issues[0].description).toContain('Scan failed')
    })

    it('should track duration', async () => {
      const mockPage = {} as import('playwright').Page

      const result = await validator.validate(mockPage, 'desktop')

      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('summarizeIssues', () => {
    it('should count issues by severity', () => {
      const issues: Issue[] = [
        { type: 'accessibility', severity: 'critical', rule: 'a', description: 'a' },
        { type: 'accessibility', severity: 'critical', rule: 'b', description: 'b' },
        { type: 'accessibility', severity: 'serious', rule: 'c', description: 'c' },
        { type: 'accessibility', severity: 'moderate', rule: 'd', description: 'd' },
        { type: 'accessibility', severity: 'minor', rule: 'e', description: 'e' },
        { type: 'accessibility', severity: 'minor', rule: 'f', description: 'f' },
      ]

      const summary = validator.summarizeIssues(issues)

      expect(summary).toEqual({
        critical: 2,
        serious: 1,
        moderate: 1,
        minor: 2,
      })
    })

    it('should only count accessibility issues', () => {
      const issues: Issue[] = [
        { type: 'accessibility', severity: 'critical', rule: 'a', description: 'a' },
        { type: 'responsive', severity: 'critical', rule: 'b', description: 'b' },
        { type: 'console', severity: 'serious', rule: 'c', description: 'c' },
      ]

      const summary = validator.summarizeIssues(issues)

      expect(summary.critical).toBe(1) // Only accessibility issues
      expect(summary.serious).toBe(0)
    })

    it('should return zeros for empty array', () => {
      const summary = validator.summarizeIssues([])

      expect(summary).toEqual({
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      })
    })
  })

  describe('meetsThreshold', () => {
    it('should pass when under thresholds', () => {
      const issues: Issue[] = [
        { type: 'accessibility', severity: 'moderate', rule: 'a', description: 'a' },
        { type: 'accessibility', severity: 'minor', rule: 'b', description: 'b' },
      ]

      expect(validator.meetsThreshold(issues, 0, 0)).toBe(true)
    })

    it('should fail when critical threshold exceeded', () => {
      const issues: Issue[] = [
        { type: 'accessibility', severity: 'critical', rule: 'a', description: 'a' },
        { type: 'accessibility', severity: 'critical', rule: 'b', description: 'b' },
      ]

      expect(validator.meetsThreshold(issues, 1, 10)).toBe(false)
    })

    it('should fail when serious threshold exceeded', () => {
      const issues: Issue[] = [
        { type: 'accessibility', severity: 'serious', rule: 'a', description: 'a' },
        { type: 'accessibility', severity: 'serious', rule: 'b', description: 'b' },
        { type: 'accessibility', severity: 'serious', rule: 'c', description: 'c' },
      ]

      expect(validator.meetsThreshold(issues, 0, 2)).toBe(false)
    })

    it('should pass with default thresholds (0, 0)', () => {
      expect(validator.meetsThreshold([])).toBe(true)
    })
  })

  describe('generateReport', () => {
    it('should generate report for empty issues', () => {
      const report = validator.generateReport([])

      expect(report).toContain('# Accessibility Report')
      expect(report).toContain('No accessibility issues found')
    })

    it('should include summary section', () => {
      const issues: Issue[] = [
        { type: 'accessibility', severity: 'critical', rule: 'a', description: 'Critical issue' },
        { type: 'accessibility', severity: 'serious', rule: 'b', description: 'Serious issue' },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('## Summary')
      expect(report).toContain('Critical: 1')
      expect(report).toContain('Serious: 1')
    })

    it('should group issues by rule', () => {
      const issues: Issue[] = [
        { type: 'accessibility', severity: 'serious', rule: 'color-contrast', description: 'Contrast issue 1', elements: ['#el1'] },
        { type: 'accessibility', severity: 'serious', rule: 'color-contrast', description: 'Contrast issue 2', elements: ['#el2'] },
        { type: 'accessibility', severity: 'critical', rule: 'image-alt', description: 'Missing alt', elements: ['img'] },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('### color-contrast (2 occurrence(s))')
      expect(report).toContain('### image-alt (1 occurrence(s))')
    })

    it('should include help URLs', () => {
      const issues: Issue[] = [
        {
          type: 'accessibility',
          severity: 'serious',
          rule: 'color-contrast',
          description: 'Contrast issue',
          helpUrl: 'https://example.com/help',
        },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('[Learn more](https://example.com/help)')
    })

    it('should list affected elements', () => {
      const issues: Issue[] = [
        {
          type: 'accessibility',
          severity: 'serious',
          rule: 'button-name',
          description: 'Missing name',
          elements: ['#btn1', '#btn2', '#btn3'],
        },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('**Affected Elements:**')
      expect(report).toContain('`#btn1`')
      expect(report).toContain('`#btn2`')
    })

    it('should truncate long element lists', () => {
      const elements = Array.from({ length: 10 }, (_, i) => `#el${i}`)
      const issues: Issue[] = [
        {
          type: 'accessibility',
          severity: 'moderate',
          rule: 'test-rule',
          description: 'Test',
          elements,
        },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('... and 5 more')
    })
  })
})
