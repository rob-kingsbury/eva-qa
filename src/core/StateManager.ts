/**
 * StateManager - Captures and identifies unique application states
 *
 * A "state" combines:
 * - URL (pathname + search params)
 * - DOM fingerprint (hash of interactive elements)
 * - Modal/dialog state
 * - Viewport size
 */

import { createHash } from 'crypto'
import type { Page } from 'playwright'
import type {
  AppState,
  ViewportName,
  DatabaseSnapshot,
  AuthState,
  BaseAdapterInterface,
} from './types.js'

export interface StateManagerOptions {
  /** Include query params in state identity */
  includeQueryParams?: boolean
  /** Include hash in state identity */
  includeHash?: boolean
  /** Sensitivity for DOM fingerprinting (higher = more states) */
  sensitivity?: 'low' | 'medium' | 'high'
  /** Custom state identity function */
  customIdentity?: (state: Partial<AppState>) => string
}

const DEFAULT_OPTIONS: StateManagerOptions = {
  includeQueryParams: true,
  includeHash: false,
  sensitivity: 'medium',
}

/**
 * Manages state capture, identification, and storage
 */
export class StateManager {
  private options: StateManagerOptions
  private stateCache: Map<string, AppState> = new Map()

  constructor(options: StateManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Capture the current state of the page
   */
  async captureState(
    page: Page,
    viewport: ViewportName,
    adapters?: Map<string, BaseAdapterInterface>
  ): Promise<AppState> {
    const [url, title, domFingerprint, modalOpen, formState] = await Promise.all([
      page.url(),
      page.title(),
      this.captureDomFingerprint(page),
      this.detectModal(page),
      this.captureFormState(page),
    ])

    const parsedUrl = new URL(url)
    let pathname = parsedUrl.pathname

    if (this.options.includeQueryParams && parsedUrl.search) {
      pathname += parsedUrl.search
    }
    if (this.options.includeHash && parsedUrl.hash) {
      pathname += parsedUrl.hash
    }

    // Capture backend state via adapters
    let dbSnapshot: DatabaseSnapshot | undefined
    let authState: AuthState | undefined

    if (adapters) {
      const supabaseAdapter = adapters.get('supabase')
      if (supabaseAdapter) {
        try {
          const state = (await supabaseAdapter.captureState()) as {
            database?: DatabaseSnapshot
            auth?: AuthState
          }
          dbSnapshot = state.database
          authState = state.auth
        } catch {
          // Adapter state capture failed, continue without it
        }
      }
    }

    const state: AppState = {
      id: '', // Will be computed below
      url,
      pathname,
      title,
      domFingerprint,
      modalOpen,
      formState: formState || undefined,
      dbSnapshot,
      authState,
      viewport,
      timestamp: Date.now(),
    }

    // Compute state ID
    state.id = this.computeStateId(state)

    // Cache the state
    this.stateCache.set(state.id, state)

    return state
  }

  /**
   * Compute a unique identifier for a state
   */
  computeStateId(state: Partial<AppState>): string {
    if (this.options.customIdentity) {
      return this.options.customIdentity(state)
    }

    const components = [
      state.pathname || '',
      state.domFingerprint || '',
      state.modalOpen || '',
      state.viewport || '',
    ]

    const hash = createHash('sha256')
    hash.update(components.join('|'))
    return hash.digest('hex').slice(0, 16)
  }

  /**
   * Create a fingerprint of the DOM's interactive elements
   */
  private async captureDomFingerprint(page: Page): Promise<string> {
    const sensitivity = this.options.sensitivity || 'medium'

    const fingerprint = await page.evaluate((sens) => {
      const getInteractiveElements = () => {
        const selectors = [
          'button',
          'a[href]',
          'input',
          'select',
          'textarea',
          '[role="button"]',
          '[role="link"]',
          '[role="tab"]',
          '[role="menuitem"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[onclick]',
          '[tabindex]:not([tabindex="-1"])',
        ]

        return document.querySelectorAll(selectors.join(','))
      }

      const elements = getInteractiveElements()
      const signatures: string[] = []

      elements.forEach((el) => {
        const htmlEl = el as HTMLElement
        if (!htmlEl.offsetParent && htmlEl.style.display !== 'none') {
          return // Skip hidden elements
        }

        // Build element signature based on sensitivity
        let signature = ''

        // Always include tag and role
        signature += el.tagName.toLowerCase()
        signature += el.getAttribute('role') || ''

        if (sens === 'medium' || sens === 'high') {
          // Include text content (truncated)
          const text = (el.textContent || '').trim().slice(0, 50)
          signature += text
        }

        if (sens === 'high') {
          // Include position info
          const rect = el.getBoundingClientRect()
          signature += `${Math.round(rect.x)},${Math.round(rect.y)}`
        }

        // Include key attributes
        const attrs = ['id', 'name', 'type', 'href', 'aria-label', 'data-testid']
        attrs.forEach((attr) => {
          const value = el.getAttribute(attr)
          if (value) {
            signature += `[${attr}=${value.slice(0, 30)}]`
          }
        })

        signatures.push(signature)
      })

      // Sort for consistency, then join
      return signatures.sort().join('|')
    }, sensitivity)

    // Hash the fingerprint for a shorter ID
    const hash = createHash('md5')
    hash.update(fingerprint)
    return hash.digest('hex').slice(0, 12)
  }

  /**
   * Detect if a modal/dialog is currently open
   */
  private async detectModal(page: Page): Promise<string | null> {
    const modal = await page.evaluate(() => {
      // Check for common modal patterns
      const modalSelectors = [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '[aria-modal="true"]',
        '.modal.show',
        '.modal.open',
        '[data-state="open"]',
        '.ReactModal__Content',
      ]

      for (const selector of modalSelectors) {
        const el = document.querySelector(selector)
        if (el && (el as HTMLElement).offsetParent !== null) {
          // Return a stable identifier for the modal
          const id =
            el.id ||
            el.getAttribute('aria-labelledby') ||
            el.getAttribute('aria-label') ||
            el.className.split(' ')[0] ||
            'modal'
          return id
        }
      }

      return null
    })

    return modal
  }

  /**
   * Capture the current state of any visible forms
   */
  private async captureFormState(
    page: Page
  ): Promise<{ selector: string; fields: Record<string, string> } | null> {
    const formState = await page.evaluate(() => {
      // Find the most relevant form (visible, inside modal if present, or main form)
      const modal = document.querySelector(
        '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
      )
      const container = modal || document

      const form = container.querySelector('form')
      if (!form) return null

      const fields: Record<string, string> = {}
      const inputs = form.querySelectorAll('input, select, textarea')

      inputs.forEach((input) => {
        const el = input as HTMLInputElement
        const name =
          el.name ||
          el.id ||
          el.getAttribute('aria-label') ||
          el.placeholder ||
          `field-${Object.keys(fields).length}`

        if (el.type === 'password' || el.type === 'hidden') {
          return // Skip sensitive fields
        }

        if (el.type === 'checkbox' || el.type === 'radio') {
          fields[name] = el.checked ? 'checked' : 'unchecked'
        } else {
          fields[name] = el.value || ''
        }
      })

      // Generate a selector for the form
      let selector = 'form'
      if (form.id) {
        selector = `#${form.id}`
      } else if (form.name) {
        selector = `form[name="${form.name}"]`
      } else if (form.action) {
        selector = `form[action*="${new URL(form.action).pathname}"]`
      }

      return { selector, fields }
    })

    return formState
  }

  /**
   * Compare two states for equality
   */
  areStatesEqual(state1: AppState, state2: AppState): boolean {
    return state1.id === state2.id
  }

  /**
   * Get a cached state by ID
   */
  getState(id: string): AppState | undefined {
    return this.stateCache.get(id)
  }

  /**
   * Get all cached states
   */
  getAllStates(): AppState[] {
    return Array.from(this.stateCache.values())
  }

  /**
   * Clear the state cache
   */
  clearCache(): void {
    this.stateCache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalStates: number; uniqueUrls: number } {
    const states = this.getAllStates()
    const uniqueUrls = new Set(states.map((s) => s.pathname))

    return {
      totalStates: states.length,
      uniqueUrls: uniqueUrls.size,
    }
  }
}
