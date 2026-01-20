/**
 * StateManager Tests
 *
 * Tests for state capture, identification, and caching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StateManager } from '../core/StateManager.js'
import type { AppState, ViewportName } from '../core/types.js'

// Mock Playwright Page
function createMockPage(overrides: Partial<{
  url: string
  title: string
  evalResult: unknown
}> = {}) {
  const url = overrides.url || 'http://localhost:3000/dashboard'
  const title = overrides.title || 'Dashboard'

  return {
    url: vi.fn().mockResolvedValue(url),
    title: vi.fn().mockResolvedValue(title),
    evaluate: vi.fn().mockResolvedValue(overrides.evalResult || 'button|a|input'),
  }
}

describe('StateManager', () => {
  let stateManager: StateManager

  beforeEach(() => {
    stateManager = new StateManager()
  })

  describe('constructor', () => {
    it('should use default options', () => {
      const sm = new StateManager()
      expect(sm).toBeDefined()
    })

    it('should accept custom options', () => {
      const sm = new StateManager({
        includeQueryParams: false,
        includeHash: true,
        sensitivity: 'high',
      })
      expect(sm).toBeDefined()
    })

    it('should accept custom identity function', () => {
      const customIdentity = (state: Partial<AppState>) => `custom-${state.pathname}`
      const sm = new StateManager({ customIdentity })
      expect(sm).toBeDefined()
    })
  })

  describe('computeStateId', () => {
    it('should compute deterministic state ID', () => {
      const state: Partial<AppState> = {
        pathname: '/dashboard',
        domFingerprint: 'abc123',
        modalOpen: null,
        viewport: 'desktop',
      }

      const id1 = stateManager.computeStateId(state)
      const id2 = stateManager.computeStateId(state)

      expect(id1).toBe(id2)
      expect(id1).toHaveLength(16) // SHA256 truncated to 16 chars
    })

    it('should produce different IDs for different states', () => {
      const state1: Partial<AppState> = {
        pathname: '/dashboard',
        domFingerprint: 'abc123',
        viewport: 'desktop',
      }

      const state2: Partial<AppState> = {
        pathname: '/settings',
        domFingerprint: 'abc123',
        viewport: 'desktop',
      }

      const id1 = stateManager.computeStateId(state1)
      const id2 = stateManager.computeStateId(state2)

      expect(id1).not.toBe(id2)
    })

    it('should include viewport in state identity', () => {
      const baseState: Partial<AppState> = {
        pathname: '/dashboard',
        domFingerprint: 'abc123',
        modalOpen: null,
      }

      const desktopId = stateManager.computeStateId({ ...baseState, viewport: 'desktop' })
      const mobileId = stateManager.computeStateId({ ...baseState, viewport: 'mobile' })

      expect(desktopId).not.toBe(mobileId)
    })

    it('should include modal state in identity', () => {
      const baseState: Partial<AppState> = {
        pathname: '/dashboard',
        domFingerprint: 'abc123',
        viewport: 'desktop',
      }

      const noModalId = stateManager.computeStateId({ ...baseState, modalOpen: null })
      const modalId = stateManager.computeStateId({ ...baseState, modalOpen: 'confirm-dialog' })

      expect(noModalId).not.toBe(modalId)
    })

    it('should use custom identity function when provided', () => {
      const sm = new StateManager({
        customIdentity: (state) => `custom-${state.pathname}`,
      })

      const id = sm.computeStateId({ pathname: '/test' })
      expect(id).toBe('custom-/test')
    })
  })

  describe('captureState', () => {
    it('should capture basic state from page', async () => {
      const mockPage = createMockPage({
        url: 'http://localhost:3000/dashboard?tab=overview',
        title: 'Dashboard - My App',
      })

      // Mock evaluate calls in order
      mockPage.evaluate
        .mockResolvedValueOnce('button|a[href]|input') // domFingerprint
        .mockResolvedValueOnce(null) // detectModal
        .mockResolvedValueOnce(null) // captureFormState

      const state = await stateManager.captureState(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )

      expect(state.url).toBe('http://localhost:3000/dashboard?tab=overview')
      expect(state.pathname).toBe('/dashboard?tab=overview')
      expect(state.title).toBe('Dashboard - My App')
      expect(state.viewport).toBe('desktop')
      expect(state.id).toBeDefined()
      expect(state.timestamp).toBeDefined()
    })

    it('should exclude query params when configured', async () => {
      const sm = new StateManager({ includeQueryParams: false })
      const mockPage = createMockPage({
        url: 'http://localhost:3000/dashboard?tab=overview',
      })

      mockPage.evaluate
        .mockResolvedValueOnce('button')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const state = await sm.captureState(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )

      expect(state.pathname).toBe('/dashboard')
    })

    it('should include hash when configured', async () => {
      const sm = new StateManager({ includeHash: true })
      const mockPage = createMockPage({
        url: 'http://localhost:3000/dashboard#section1',
      })

      mockPage.evaluate
        .mockResolvedValueOnce('button')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const state = await sm.captureState(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )

      expect(state.pathname).toBe('/dashboard#section1')
    })

    it('should cache captured states', async () => {
      const mockPage = createMockPage()

      mockPage.evaluate
        .mockResolvedValueOnce('button')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const state = await stateManager.captureState(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )

      const cached = stateManager.getState(state.id)
      expect(cached).toBeDefined()
      expect(cached?.id).toBe(state.id)
    })
  })

  describe('areStatesEqual', () => {
    it('should return true for states with same ID', () => {
      const state1: AppState = {
        id: 'abc123',
        url: 'http://localhost/a',
        pathname: '/a',
        title: 'A',
        domFingerprint: 'fp1',
        modalOpen: null,
        viewport: 'desktop',
        timestamp: Date.now(),
      }

      const state2: AppState = {
        ...state1,
        timestamp: Date.now() + 1000, // Different timestamp
      }

      expect(stateManager.areStatesEqual(state1, state2)).toBe(true)
    })

    it('should return false for states with different IDs', () => {
      const state1: AppState = {
        id: 'abc123',
        url: 'http://localhost/a',
        pathname: '/a',
        title: 'A',
        domFingerprint: 'fp1',
        modalOpen: null,
        viewport: 'desktop',
        timestamp: Date.now(),
      }

      const state2: AppState = {
        ...state1,
        id: 'def456',
      }

      expect(stateManager.areStatesEqual(state1, state2)).toBe(false)
    })
  })

  describe('cache operations', () => {
    const mockState: AppState = {
      id: 'test-state-1',
      url: 'http://localhost:3000/test',
      pathname: '/test',
      title: 'Test',
      domFingerprint: 'fp123',
      modalOpen: null,
      viewport: 'desktop',
      timestamp: Date.now(),
    }

    beforeEach(async () => {
      // Manually add to cache via captureState
      const mockPage = createMockPage({ url: 'http://localhost:3000/test' })
      mockPage.evaluate
        .mockResolvedValueOnce('button')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      await stateManager.captureState(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )
    })

    it('should retrieve cached state by ID', () => {
      const states = stateManager.getAllStates()
      expect(states.length).toBeGreaterThan(0)

      const cachedState = stateManager.getState(states[0].id)
      expect(cachedState).toBeDefined()
    })

    it('should return undefined for non-existent state', () => {
      const state = stateManager.getState('non-existent-id')
      expect(state).toBeUndefined()
    })

    it('should return all cached states', () => {
      const states = stateManager.getAllStates()
      expect(Array.isArray(states)).toBe(true)
      expect(states.length).toBeGreaterThan(0)
    })

    it('should clear cache', () => {
      stateManager.clearCache()
      const states = stateManager.getAllStates()
      expect(states.length).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const mockPage1 = createMockPage({ url: 'http://localhost:3000/page1' })
      const mockPage2 = createMockPage({ url: 'http://localhost:3000/page2' })
      const mockPage3 = createMockPage({ url: 'http://localhost:3000/page1' }) // Same URL as page1

      // Setup mocks for all pages
      for (const page of [mockPage1, mockPage2, mockPage3]) {
        page.evaluate
          .mockResolvedValueOnce('button')
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
      }

      await stateManager.captureState(mockPage1 as unknown as import('playwright').Page, 'desktop')
      await stateManager.captureState(mockPage2 as unknown as import('playwright').Page, 'desktop')
      await stateManager.captureState(mockPage3 as unknown as import('playwright').Page, 'mobile')

      const stats = stateManager.getStats()

      expect(stats.totalStates).toBe(3)
      expect(stats.uniqueUrls).toBe(2) // /page1 and /page2
    })

    it('should return zero stats when cache is empty', () => {
      stateManager.clearCache()
      const stats = stateManager.getStats()

      expect(stats.totalStates).toBe(0)
      expect(stats.uniqueUrls).toBe(0)
    })
  })

  describe('sensitivity levels', () => {
    it('should work with low sensitivity', async () => {
      const sm = new StateManager({ sensitivity: 'low' })
      const mockPage = createMockPage()

      mockPage.evaluate
        .mockResolvedValueOnce('button')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const state = await sm.captureState(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )

      expect(state.domFingerprint).toBeDefined()
    })

    it('should work with high sensitivity', async () => {
      const sm = new StateManager({ sensitivity: 'high' })
      const mockPage = createMockPage()

      mockPage.evaluate
        .mockResolvedValueOnce('button[x=100,y=200]')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const state = await sm.captureState(
        mockPage as unknown as import('playwright').Page,
        'desktop'
      )

      expect(state.domFingerprint).toBeDefined()
    })
  })
})
