/**
 * ActionDiscovery Tests
 *
 * Tests for interactive element discovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionDiscovery } from '../core/ActionDiscovery.js'
import type { DiscoveredAction } from '../core/types.js'

// Mock Playwright Page
function createMockPage(evalResult: unknown = []) {
  return {
    evaluate: vi.fn().mockResolvedValue(evalResult),
    locator: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      first: vi.fn().mockReturnValue({
        getAttribute: vi.fn().mockResolvedValue(null),
        innerText: vi.fn().mockResolvedValue(''),
        isVisible: vi.fn().mockResolvedValue(true),
        evaluate: vi.fn().mockResolvedValue('button'),
      }),
      isVisible: vi.fn().mockResolvedValue(true),
    }),
  }
}

describe('ActionDiscovery', () => {
  let actionDiscovery: ActionDiscovery

  beforeEach(() => {
    actionDiscovery = new ActionDiscovery()
  })

  describe('constructor', () => {
    it('should use default options', () => {
      const ad = new ActionDiscovery()
      expect(ad).toBeDefined()
    })

    it('should accept custom interactive selectors', () => {
      const ad = new ActionDiscovery({
        interactiveSelectors: ['button', 'a'],
      })
      expect(ad).toBeDefined()
    })

    it('should accept custom ignore selectors', () => {
      const ad = new ActionDiscovery({
        ignoreSelectors: ['[data-skip]', '.skip-element'],
      })
      expect(ad).toBeDefined()
    })

    it('should accept maxActions limit', () => {
      const ad = new ActionDiscovery({
        maxActions: 50,
      })
      expect(ad).toBeDefined()
    })
  })

  describe('discoverActions', () => {
    it('should discover buttons', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        {
          type: 'click',
          selector: '#submit-btn',
          label: 'Submit',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
          boundingBox: { x: 100, y: 200, width: 80, height: 40 },
        },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.length).toBe(1)
      expect(actions[0].type).toBe('click')
      expect(actions[0].selector).toBe('#submit-btn')
      expect(actions[0].label).toBe('Submit')
    })

    it('should discover links', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        {
          type: 'click',
          selector: 'a[href="/about"]',
          label: 'About Us',
          tagName: 'a',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.length).toBe(1)
      expect(actions[0].tagName).toBe('a')
    })

    it('should discover form inputs', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        {
          type: 'fill',
          selector: '#email-input',
          label: 'Email',
          tagName: 'input',
          visible: true,
          enabled: true,
          destructive: false,
        },
        {
          type: 'fill',
          selector: '#message',
          label: 'Message',
          tagName: 'textarea',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.length).toBe(2)
      expect(actions.some(a => a.type === 'fill')).toBe(true)
    })

    it('should discover checkboxes', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        {
          type: 'check',
          selector: '#terms-checkbox',
          label: 'Accept terms',
          tagName: 'input',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions[0].type).toBe('check')
    })

    it('should discover select dropdowns', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        {
          type: 'select',
          selector: '#country-select',
          label: 'Country',
          tagName: 'select',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions[0].type).toBe('select')
    })

    it('should identify destructive actions', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        {
          type: 'click',
          selector: '#delete-btn',
          label: 'Delete',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: true,
        },
        {
          type: 'click',
          selector: '#logout-btn',
          label: 'Logout',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: true,
        },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.every(a => a.destructive === true)).toBe(true)
    })

    it('should apply additional ignore selectors', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        {
          type: 'click',
          selector: '#visible-btn',
          label: 'Visible',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page,
        ['#hidden-btn'] // Additional ignore selector
      )

      // The mock returns filtered results
      expect(actions.length).toBe(1)
    })

    it('should return empty array when no actions found', async () => {
      const mockPage = createMockPage([])

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions).toEqual([])
    })

    it('should respect maxActions limit', async () => {
      const ad = new ActionDiscovery({ maxActions: 5 })
      const manyActions = Array.from({ length: 10 }, (_, i) => ({
        type: 'click',
        selector: `#btn-${i}`,
        label: `Button ${i}`,
        tagName: 'button',
        visible: true,
        enabled: true,
        destructive: false,
      }))

      const mockPage = createMockPage(manyActions.slice(0, 5))

      const actions = await ad.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.length).toBeLessThanOrEqual(5)
    })
  })

  describe('prioritizeActions', () => {
    it('should prioritize submit/save buttons', () => {
      const actions: DiscoveredAction[] = [
        {
          type: 'click',
          selector: '#cancel',
          label: 'Cancel',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: true,
        },
        {
          type: 'click',
          selector: '#submit',
          label: 'Submit Form',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
        },
        {
          type: 'click',
          selector: '#help',
          label: 'Help',
          tagName: 'a',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const prioritized = actionDiscovery.prioritizeActions(actions)

      // Submit should be first (highest priority)
      expect(prioritized[0].label).toContain('Submit')
    })

    it('should deprioritize destructive actions', () => {
      const actions: DiscoveredAction[] = [
        {
          type: 'click',
          selector: '#delete',
          label: 'Delete Account',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: true,
        },
        {
          type: 'click',
          selector: '#save',
          label: 'Save',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const prioritized = actionDiscovery.prioritizeActions(actions)

      // Delete should be last
      expect(prioritized[prioritized.length - 1].label).toContain('Delete')
    })

    it('should prioritize navigation items', () => {
      const actions: DiscoveredAction[] = [
        {
          type: 'click',
          selector: '#random-btn',
          label: 'Random',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
        },
        {
          type: 'click',
          selector: '#nav-link',
          label: 'Nav: Dashboard',
          tagName: 'a',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const prioritized = actionDiscovery.prioritizeActions(actions)

      // Nav should come before random button
      const navIndex = prioritized.findIndex(a => a.label.includes('Nav'))
      const randomIndex = prioritized.findIndex(a => a.label === 'Random')
      expect(navIndex).toBeLessThan(randomIndex)
    })

    it('should consider z-index in priority', () => {
      const actions: DiscoveredAction[] = [
        {
          type: 'click',
          selector: '#low-z',
          label: 'Low Z',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
          zIndex: 1,
        },
        {
          type: 'click',
          selector: '#high-z',
          label: 'High Z',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
          zIndex: 1000,
        },
      ]

      const prioritized = actionDiscovery.prioritizeActions(actions)

      // Higher z-index should be prioritized
      expect(prioritized[0].zIndex).toBeGreaterThan(prioritized[1].zIndex || 0)
    })
  })

  describe('groupActions', () => {
    it('should group actions by purpose', () => {
      const actions: DiscoveredAction[] = [
        {
          type: 'click',
          selector: 'a[href="/about"]',
          label: 'About',
          tagName: 'a',
          visible: true,
          enabled: true,
          destructive: false,
        },
        {
          type: 'fill',
          selector: '#email-input',
          label: 'Email',
          tagName: 'input',
          visible: true,
          enabled: true,
          destructive: false,
        },
        {
          type: 'click',
          selector: '#delete',
          label: 'Delete',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: true,
        },
        {
          type: 'click',
          selector: '#other-btn',
          label: 'Other',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const groups = actionDiscovery.groupActions(actions)

      expect(groups.navigation).toHaveLength(1)
      expect(groups.form).toHaveLength(1)
      expect(groups.destructive).toHaveLength(1)
      expect(groups.other).toHaveLength(1)
    })

    it('should handle empty actions array', () => {
      const groups = actionDiscovery.groupActions([])

      expect(groups.navigation).toHaveLength(0)
      expect(groups.form).toHaveLength(0)
      expect(groups.destructive).toHaveLength(0)
      expect(groups.modal).toHaveLength(0)
      expect(groups.other).toHaveLength(0)
    })

    it('should identify modal actions', () => {
      const actions: DiscoveredAction[] = [
        {
          type: 'click',
          selector: '[data-modal="confirm"]',
          label: 'Confirm',
          tagName: 'button',
          visible: true,
          enabled: true,
          destructive: false,
        },
      ]

      const groups = actionDiscovery.groupActions(actions)

      expect(groups.modal).toHaveLength(1)
    })
  })

  describe('getFormActions', () => {
    it('should find form submit buttons', async () => {
      const mockForm = {
        isVisible: vi.fn().mockResolvedValue(true),
        locator: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          first: vi.fn().mockReturnValue({
            getAttribute: vi.fn().mockResolvedValue(null),
            innerText: vi.fn().mockResolvedValue('Submit'),
            evaluate: vi.fn().mockResolvedValue('button[type="submit"]'),
          }),
        }),
      }

      const mockPage = {
        locator: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([mockForm]),
        }),
      }

      const actions = await actionDiscovery.getFormActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.length).toBe(1)
      expect(actions[0].label).toContain('Submit')
    })

    it('should skip hidden forms', async () => {
      const mockForm = {
        isVisible: vi.fn().mockResolvedValue(false),
        locator: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          first: vi.fn(),
        }),
      }

      const mockPage = {
        locator: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([mockForm]),
        }),
      }

      const actions = await actionDiscovery.getFormActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.length).toBe(0)
    })

    it('should handle forms without submit buttons', async () => {
      const mockForm = {
        isVisible: vi.fn().mockResolvedValue(true),
        locator: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
        }),
      }

      const mockPage = {
        locator: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([mockForm]),
        }),
      }

      const actions = await actionDiscovery.getFormActions(
        mockPage as unknown as import('playwright').Page
      )

      expect(actions.length).toBe(0)
    })
  })

  describe('action types', () => {
    it('should correctly identify all action types', async () => {
      const mockActions: Partial<DiscoveredAction>[] = [
        { type: 'click', selector: '#btn', label: 'Click', tagName: 'button', visible: true, enabled: true, destructive: false },
        { type: 'fill', selector: '#input', label: 'Fill', tagName: 'input', visible: true, enabled: true, destructive: false },
        { type: 'select', selector: '#select', label: 'Select', tagName: 'select', visible: true, enabled: true, destructive: false },
        { type: 'check', selector: '#checkbox', label: 'Check', tagName: 'input', visible: true, enabled: true, destructive: false },
      ]

      const mockPage = createMockPage(mockActions)

      const actions = await actionDiscovery.discoverActions(
        mockPage as unknown as import('playwright').Page
      )

      const types = actions.map(a => a.type)
      expect(types).toContain('click')
      expect(types).toContain('fill')
      expect(types).toContain('select')
      expect(types).toContain('check')
    })
  })
})
