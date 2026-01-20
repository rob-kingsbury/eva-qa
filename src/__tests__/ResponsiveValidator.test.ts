/**
 * ResponsiveValidator Tests
 *
 * Tests for responsive design validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResponsiveValidator } from '../validators/ResponsiveValidator.js'
import type { Issue } from '../core/types.js'

// Mock Playwright Page
function createMockPage(overrides: {
  viewportSize?: { width: number; height: number } | null
  evalResults?: Record<string, unknown>
} = {}) {
  const viewportSize = overrides.viewportSize ?? { width: 375, height: 667 }
  const evalResults = overrides.evalResults || {}

  return {
    viewportSize: vi.fn().mockReturnValue(viewportSize),
    evaluate: vi.fn().mockImplementation((fn: unknown, args?: unknown) => {
      // Return different results based on args or call order
      if (typeof args === 'number') {
        // Touch target check - returns array of small targets
        return evalResults.touchTargets || []
      }
      if (args && typeof args === 'object' && 'vw' in args) {
        // Out of bounds check
        return evalResults.outOfBounds || []
      }
      if (typeof args === 'number' && args > 100) {
        // Horizontal overflow check (vw > 100)
        return evalResults.overflow || {
          hasOverflow: false,
          maxWidth: viewportSize?.width || 375,
          viewportWidth: viewportSize?.width || 375,
          overflowingElements: [],
        }
      }
      // Text truncation check
      return evalResults.truncation || []
    }),
  }
}

describe('ResponsiveValidator', () => {
  let validator: ResponsiveValidator

  beforeEach(() => {
    validator = new ResponsiveValidator()
  })

  describe('constructor', () => {
    it('should use default config', () => {
      const v = new ResponsiveValidator()
      expect(v).toBeDefined()
    })

    it('should accept custom config', () => {
      const v = new ResponsiveValidator({
        enabled: true,
        checkOverflow: true,
        checkTouchTargets: true,
        minTouchTarget: 48,
        checkTruncation: false,
        checkOutOfBounds: false,
        overflowTolerance: 10,
      })
      expect(v).toBeDefined()
    })

    it('should allow disabling', () => {
      const v = new ResponsiveValidator({ enabled: false })
      expect(v).toBeDefined()
    })
  })

  describe('validate', () => {
    it('should return empty results when disabled', async () => {
      const v = new ResponsiveValidator({ enabled: false })
      const mockPage = createMockPage()

      const result = await v.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      expect(result.validator).toBe('responsive')
      expect(result.issues).toHaveLength(0)
      expect(result.duration).toBe(0)
    })

    it('should return empty results when no viewport', async () => {
      const mockPage = createMockPage({ viewportSize: null })

      const result = await validator.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      expect(result.issues).toHaveLength(0)
    })

    it('should detect horizontal overflow', async () => {
      const mockPage = createMockPage({
        viewportSize: { width: 375, height: 667 },
        evalResults: {
          overflow: {
            hasOverflow: true,
            maxWidth: 500,
            viewportWidth: 375,
            overflowingElements: [
              { selector: '.wide-element', width: 500, overflow: 125 },
            ],
          },
        },
      })

      // Override evaluate to return overflow data first
      mockPage.evaluate.mockResolvedValueOnce({
        hasOverflow: true,
        maxWidth: 500,
        viewportWidth: 375,
        overflowingElements: [
          { selector: '.wide-element', width: 500, overflow: 125 },
        ],
      })

      const result = await validator.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      const overflowIssue = result.issues.find(i => i.rule === 'no-horizontal-scroll')
      expect(overflowIssue).toBeDefined()
      expect(overflowIssue?.severity).toBe('serious')
      expect(overflowIssue?.description).toContain('horizontal overflow')
    })

    it('should detect small touch targets on mobile', async () => {
      const mockPage = createMockPage({
        viewportSize: { width: 375, height: 667 },
      })

      // First call: overflow check
      mockPage.evaluate.mockResolvedValueOnce({
        hasOverflow: false,
        maxWidth: 375,
        viewportWidth: 375,
        overflowingElements: [],
      })

      // Second call: touch targets
      mockPage.evaluate.mockResolvedValueOnce([
        { selector: '#small-btn', width: 30, height: 30, label: 'Small Button' },
      ])

      // Third call: truncation
      mockPage.evaluate.mockResolvedValueOnce([])

      // Fourth call: out of bounds
      mockPage.evaluate.mockResolvedValueOnce([])

      const result = await validator.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      const touchIssue = result.issues.find(i => i.rule === 'touch-target-size')
      expect(touchIssue).toBeDefined()
      expect(touchIssue?.severity).toBe('moderate')
      expect(touchIssue?.description).toContain('30x30')
      expect(touchIssue?.description).toContain('44x44')
    })

    it('should skip touch target check on desktop', async () => {
      const mockPage = createMockPage({
        viewportSize: { width: 1280, height: 720 },
      })

      // Overflow check only
      mockPage.evaluate.mockResolvedValueOnce({
        hasOverflow: false,
        maxWidth: 1280,
        viewportWidth: 1280,
        overflowingElements: [],
      })

      // Truncation
      mockPage.evaluate.mockResolvedValueOnce([])

      // Out of bounds
      mockPage.evaluate.mockResolvedValueOnce([])

      const v = new ResponsiveValidator({
        enabled: true,
        checkOverflow: true,
        checkTouchTargets: true, // Enabled but should be skipped for desktop
      })

      const result = await v.validate(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )

      // No touch target issues on desktop
      const touchIssue = result.issues.find(i => i.rule === 'touch-target-size')
      expect(touchIssue).toBeUndefined()
    })

    it('should detect text truncation', async () => {
      const mockPage = createMockPage({
        viewportSize: { width: 375, height: 667 },
      })

      // Overflow check
      mockPage.evaluate.mockResolvedValueOnce({
        hasOverflow: false,
        maxWidth: 375,
        viewportWidth: 375,
        overflowingElements: [],
      })

      // Touch targets
      mockPage.evaluate.mockResolvedValueOnce([])

      // Truncation
      mockPage.evaluate.mockResolvedValueOnce([
        { selector: '.truncated-title', text: 'This is a very long...' },
      ])

      // Out of bounds
      mockPage.evaluate.mockResolvedValueOnce([])

      const result = await validator.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      const truncationIssue = result.issues.find(i => i.rule === 'text-truncation')
      expect(truncationIssue).toBeDefined()
      expect(truncationIssue?.severity).toBe('minor')
    })

    it('should detect elements outside viewport', async () => {
      const mockPage = createMockPage({
        viewportSize: { width: 375, height: 667 },
      })

      // Overflow check
      mockPage.evaluate.mockResolvedValueOnce({
        hasOverflow: false,
        maxWidth: 375,
        viewportWidth: 375,
        overflowingElements: [],
      })

      // Touch targets
      mockPage.evaluate.mockResolvedValueOnce([])

      // Truncation
      mockPage.evaluate.mockResolvedValueOnce([])

      // Out of bounds
      mockPage.evaluate.mockResolvedValueOnce([
        { selector: '#hidden-btn', position: { x: -100, y: 50 }, reason: 'left of viewport' },
      ])

      const result = await validator.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      const boundsIssue = result.issues.find(i => i.rule === 'element-out-of-bounds')
      expect(boundsIssue).toBeDefined()
      expect(boundsIssue?.severity).toBe('serious')
      expect(boundsIssue?.description).toContain('left of viewport')
    })

    it('should track duration', async () => {
      const mockPage = createMockPage()

      // Overflow
      mockPage.evaluate.mockResolvedValueOnce({
        hasOverflow: false,
        maxWidth: 375,
        viewportWidth: 375,
        overflowingElements: [],
      })
      // Touch targets
      mockPage.evaluate.mockResolvedValueOnce([])
      // Truncation
      mockPage.evaluate.mockResolvedValueOnce([])
      // Out of bounds
      mockPage.evaluate.mockResolvedValueOnce([])

      const result = await validator.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should respect disabled checks', async () => {
      const v = new ResponsiveValidator({
        enabled: true,
        checkOverflow: false,
        checkTouchTargets: false,
        checkTruncation: false,
        checkOutOfBounds: false,
      })

      const mockPage = createMockPage()

      const result = await v.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      expect(result.issues).toHaveLength(0)
      expect(mockPage.evaluate).not.toHaveBeenCalled()
    })
  })

  describe('generateReport', () => {
    it('should generate report for empty issues', () => {
      const report = validator.generateReport([])

      expect(report).toContain('# Responsive Design Report')
      expect(report).toContain('No responsive issues found')
    })

    it('should include summary by rule', () => {
      const issues: Issue[] = [
        {
          type: 'responsive',
          severity: 'serious',
          rule: 'no-horizontal-scroll',
          description: 'Overflow issue',
          viewport: 'mobile',
        },
        {
          type: 'responsive',
          severity: 'moderate',
          rule: 'touch-target-size',
          description: 'Small button 1',
          viewport: 'mobile',
        },
        {
          type: 'responsive',
          severity: 'moderate',
          rule: 'touch-target-size',
          description: 'Small button 2',
          viewport: 'mobile',
        },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('## Summary')
      expect(report).toContain('**no-horizontal-scroll**: 1 issue(s)')
      expect(report).toContain('**touch-target-size**: 2 issue(s)')
    })

    it('should show worst severity per rule', () => {
      const issues: Issue[] = [
        {
          type: 'responsive',
          severity: 'moderate',
          rule: 'element-out-of-bounds',
          description: 'Issue 1',
          viewport: 'mobile',
        },
        {
          type: 'responsive',
          severity: 'serious',
          rule: 'element-out-of-bounds',
          description: 'Issue 2',
          viewport: 'mobile',
        },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('(serious)')
    })

    it('should include details section', () => {
      const issues: Issue[] = [
        {
          type: 'responsive',
          severity: 'moderate',
          rule: 'touch-target-size',
          description: 'Button is 30x30px',
          viewport: 'mobile',
          elements: ['#small-btn'],
        },
      ]

      const report = validator.generateReport(issues)

      expect(report).toContain('## Details')
      expect(report).toContain('### touch-target-size')
      expect(report).toContain('Button is 30x30px')
      expect(report).toContain('#small-btn')
    })

    it('should truncate long issue lists', () => {
      const issues: Issue[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'responsive' as const,
        severity: 'moderate' as const,
        rule: 'touch-target-size',
        description: `Issue ${i}`,
        viewport: 'mobile' as const,
      }))

      const report = validator.generateReport(issues)

      expect(report).toContain('... and 5 more')
    })

    it('should only include responsive issues', () => {
      const issues: Issue[] = [
        { type: 'responsive', severity: 'serious', rule: 'overflow', description: 'Overflow' },
        { type: 'accessibility', severity: 'critical', rule: 'a11y', description: 'A11y issue' },
      ]

      const report = validator.generateReport(issues)

      expect(report).not.toContain('a11y')
    })
  })

  describe('custom touch target size', () => {
    it('should use custom minimum touch target size', async () => {
      const v = new ResponsiveValidator({
        enabled: true,
        checkTouchTargets: true,
        minTouchTarget: 48, // Custom size
      })

      const mockPage = createMockPage({
        viewportSize: { width: 375, height: 667 },
      })

      // Overflow check
      mockPage.evaluate.mockResolvedValueOnce({
        hasOverflow: false,
        maxWidth: 375,
        viewportWidth: 375,
        overflowingElements: [],
      })

      // Touch targets with size between 44 and 48
      mockPage.evaluate.mockResolvedValueOnce([
        { selector: '#btn', width: 46, height: 46, label: 'Button' },
      ])

      // Truncation
      mockPage.evaluate.mockResolvedValueOnce([])

      // Out of bounds
      mockPage.evaluate.mockResolvedValueOnce([])

      const result = await v.validate(
        mockPage as unknown as import('playwright').Page,
        'mobile'
      )

      const touchIssue = result.issues.find(i => i.rule === 'touch-target-size')
      expect(touchIssue).toBeDefined()
      expect(touchIssue?.description).toContain('48x48')
    })
  })
})
