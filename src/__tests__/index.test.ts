/**
 * Index / Config Tests
 *
 * Tests for createConfig and module exports
 */

import { describe, it, expect } from 'vitest'
import { createConfig, Explorer, StateManager, ActionDiscovery } from '../index.js'
import { AccessibilityValidator } from '../validators/AccessibilityValidator.js'
import { ResponsiveValidator } from '../validators/ResponsiveValidator.js'
import { SupabaseAdapter } from '../adapters/SupabaseAdapter.js'

describe('Module Exports', () => {
  it('should export Explorer', () => {
    expect(Explorer).toBeDefined()
    expect(typeof Explorer).toBe('function')
  })

  it('should export StateManager', () => {
    expect(StateManager).toBeDefined()
    expect(typeof StateManager).toBe('function')
  })

  it('should export ActionDiscovery', () => {
    expect(ActionDiscovery).toBeDefined()
    expect(typeof ActionDiscovery).toBe('function')
  })

  it('should export AccessibilityValidator', () => {
    expect(AccessibilityValidator).toBeDefined()
    expect(typeof AccessibilityValidator).toBe('function')
  })

  it('should export ResponsiveValidator', () => {
    expect(ResponsiveValidator).toBeDefined()
    expect(typeof ResponsiveValidator).toBe('function')
  })

  it('should export SupabaseAdapter', () => {
    expect(SupabaseAdapter).toBeDefined()
    expect(typeof SupabaseAdapter).toBe('function')
  })

  it('should export createConfig', () => {
    expect(createConfig).toBeDefined()
    expect(typeof createConfig).toBe('function')
  })
})

describe('createConfig', () => {
  it('should require baseUrl', () => {
    expect(() => createConfig({} as any)).toThrow('baseUrl is required')
  })

  it('should create config with minimal options', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
    })

    expect(config.baseUrl).toBe('http://localhost:3000')
  })

  it('should set default exploration options', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
    })

    expect(config.exploration?.maxDepth).toBe(10)
    expect(config.exploration?.maxStates).toBe(500)
    expect(config.exploration?.maxActionsPerState).toBe(50)
    expect(config.exploration?.timeout).toBe(10000)
    expect(config.exploration?.viewports).toEqual(['mobile', 'desktop'])
    expect(config.exploration?.waitForNetworkIdle).toBe(true)
    expect(config.exploration?.actionDelay).toBe(100)
  })

  it('should set default validator options', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
    })

    expect(config.validators?.accessibility?.enabled).toBe(true)
    expect(config.validators?.accessibility?.rules).toEqual(['wcag21aa'])
    expect(config.validators?.responsive?.enabled).toBe(true)
    expect(config.validators?.responsive?.checkOverflow).toBe(true)
    expect(config.validators?.responsive?.checkTouchTargets).toBe(true)
    expect(config.validators?.responsive?.minTouchTarget).toBe(44)
    expect(config.validators?.console?.enabled).toBe(true)
    expect(config.validators?.console?.failOnError).toBe(false)
    expect(config.validators?.network?.enabled).toBe(true)
    expect(config.validators?.network?.maxResponseTime).toBe(5000)
  })

  it('should set default output options', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
    })

    expect(config.output?.dir).toBe('./eva-qa-reports')
    expect(config.output?.formats).toEqual(['html', 'json'])
    expect(config.output?.screenshots).toBe(true)
    expect(config.output?.screenshotFormat).toBe('png')
  })

  it('should set default headless mode', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
    })

    expect(config.headless).toBe(true)
  })

  it('should set default browser', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
    })

    expect(config.browser).toBe('chromium')
  })

  it('should allow overriding defaults', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      headless: false,
      browser: 'firefox',
      exploration: {
        maxDepth: 5,
        maxStates: 100,
        viewports: ['tablet'],
      },
      validators: {
        accessibility: {
          enabled: false,
        },
      },
      output: {
        dir: './custom-reports',
        formats: ['json'],
      },
    })

    expect(config.headless).toBe(false)
    expect(config.browser).toBe('firefox')
    expect(config.exploration?.maxDepth).toBe(5)
    expect(config.exploration?.maxStates).toBe(100)
    expect(config.exploration?.viewports).toEqual(['tablet'])
    expect(config.validators?.accessibility?.enabled).toBe(false)
    expect(config.output?.dir).toBe('./custom-reports')
  })

  it('should accept auth path', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      auth: './playwright/.auth/user.json',
    })

    expect(config.auth).toBe('./playwright/.auth/user.json')
  })

  it('should accept start URLs', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      startUrls: ['/dashboard', '/settings'],
    })

    expect(config.startUrls).toEqual(['/dashboard', '/settings'])
  })

  it('should accept adapter config', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      adapters: {
        supabase: {
          url: 'https://test.supabase.co',
          serviceKey: 'test-key',
        },
      },
    })

    expect(config.adapters?.supabase?.url).toBe('https://test.supabase.co')
    expect(config.adapters?.supabase?.serviceKey).toBe('test-key')
  })

  it('should accept action schemas', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      actionSchemas: [
        {
          match: { selector: 'button', text: /submit/i },
          expects: [
            { database: { table: 'submissions', change: 'insert' } },
          ],
        },
      ],
    })

    expect(config.actionSchemas).toHaveLength(1)
    expect(config.actionSchemas?.[0].match.selector).toBe('button')
  })

  it('should accept test data config', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      testData: {
        email: 'test@example.com',
        password: 'test-password',
        randomId: () => Math.random().toString(36),
      },
    })

    expect(config.testData?.email).toBe('test@example.com')
    expect(typeof config.testData?.randomId).toBe('function')
  })

  it('should accept ignore selectors', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      ignore: ['#logout', '.skip-me'],
    })

    expect(config.ignore).toEqual(['#logout', '.skip-me'])
  })

  it('should default ignore to empty array', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
    })

    expect(config.ignore).toEqual([])
  })

  it('should accept setup steps', () => {
    const config = createConfig({
      baseUrl: 'http://localhost:3000',
      setup: [
        { click: '#accept-cookies' },
        { waitFor: '#main-content' },
      ],
    })

    expect(config.setup).toHaveLength(2)
  })
})

describe('Type exports', () => {
  it('should export VIEWPORTS constant', async () => {
    const { VIEWPORTS } = await import('../core/types.js')

    expect(VIEWPORTS).toBeDefined()
    expect(VIEWPORTS.mobile).toEqual({ name: 'mobile', width: 375, height: 667 })
    expect(VIEWPORTS.tablet).toEqual({ name: 'tablet', width: 768, height: 1024 })
    expect(VIEWPORTS.desktop).toEqual({ name: 'desktop', width: 1280, height: 720 })
  })
})
