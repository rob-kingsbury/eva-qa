/**
 * ActionDiscovery - Finds all interactive elements on a page
 *
 * Discovers buttons, links, inputs, and other interactive elements
 * that could be clicked/interacted with during exploration.
 */

import type { Page, Locator } from 'playwright'
import type { Action, DiscoveredAction, ActionType } from './types.js'

export interface ActionDiscoveryOptions {
  /** CSS selectors for interactive elements */
  interactiveSelectors?: string[]
  /** Selectors to ignore */
  ignoreSelectors?: string[]
  /** Minimum size for clickable elements (px) */
  minClickableSize?: number
  /** Include disabled elements (for visibility testing) */
  includeDisabled?: boolean
  /** Maximum actions to discover per page */
  maxActions?: number
}

const DEFAULT_INTERACTIVE_SELECTORS = [
  'button:not([disabled])',
  'a[href]:not([href=""])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
  'summary', // For <details> elements
  'label[for]', // Clickable labels
]

const DEFAULT_IGNORE_SELECTORS = [
  '[aria-hidden="true"]',
  '[data-testid="skip-exploration"]',
  '[data-no-explore]',
]

const DEFAULT_OPTIONS: ActionDiscoveryOptions = {
  interactiveSelectors: DEFAULT_INTERACTIVE_SELECTORS,
  ignoreSelectors: DEFAULT_IGNORE_SELECTORS,
  minClickableSize: 1, // Some buttons are icon-only and small
  includeDisabled: false,
  maxActions: 100,
}

/**
 * Discovers interactive elements on a page
 */
export class ActionDiscovery {
  private options: ActionDiscoveryOptions

  constructor(options: ActionDiscoveryOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Discover all interactive elements on the current page
   */
  async discoverActions(
    page: Page,
    additionalIgnore: string[] = []
  ): Promise<DiscoveredAction[]> {
    const ignoreSelectors = [
      ...(this.options.ignoreSelectors || []),
      ...additionalIgnore,
    ]

    const actions = await page.evaluate(
      ({ selectors, ignore, minSize, includeDisabled, maxActions }) => {
        const discovered: Array<{
          type: string
          selector: string
          label: string
          tagName: string
          role: string | null
          visible: boolean
          enabled: boolean
          destructive: boolean
          boundingBox: { x: number; y: number; width: number; height: number } | null
          value?: string
          zIndex?: number
        }> = []

        // Helper to check if element is visible
        const isVisible = (el: HTMLElement): boolean => {
          if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') {
            return false
          }
          const rect = el.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) {
            return false
          }
          const style = getComputedStyle(el)
          if (style.visibility === 'hidden' || style.opacity === '0') {
            return false
          }
          return true
        }

        // Helper to check if element is in viewport
        const isInViewport = (el: HTMLElement): boolean => {
          const rect = el.getBoundingClientRect()
          return (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
          )
        }

        // Helper to check if element matches ignore selectors
        const shouldIgnore = (el: Element): boolean => {
          for (const selector of ignore) {
            if (el.matches(selector) || el.closest(selector)) {
              return true
            }
          }
          return false
        }

        // Helper to get best label for element
        const getLabel = (el: Element): string => {
          const htmlEl = el as HTMLElement

          // Try aria-label first
          const ariaLabel = el.getAttribute('aria-label')
          if (ariaLabel) return ariaLabel.trim()

          // Try aria-labelledby
          const labelledBy = el.getAttribute('aria-labelledby')
          if (labelledBy) {
            const labelEl = document.getElementById(labelledBy)
            if (labelEl?.textContent) return labelEl.textContent.trim()
          }

          // Try title
          const title = el.getAttribute('title')
          if (title) return title.trim()

          // Try text content (for buttons, links)
          const text = htmlEl.innerText || htmlEl.textContent
          if (text) {
            const trimmed = text.trim().slice(0, 100)
            if (trimmed) return trimmed
          }

          // Try placeholder (for inputs)
          const placeholder = el.getAttribute('placeholder')
          if (placeholder) return placeholder.trim()

          // Try name or id
          const name = el.getAttribute('name') || el.id
          if (name) return name

          // Fallback to tag + index
          return `${el.tagName.toLowerCase()}`
        }

        // Helper to generate unique selector
        const getSelector = (el: Element): string => {
          // Try ID first
          if (el.id) {
            return `#${CSS.escape(el.id)}`
          }

          // Try data-testid
          const testId = el.getAttribute('data-testid')
          if (testId) {
            return `[data-testid="${CSS.escape(testId)}"]`
          }

          // Try unique aria-label
          const ariaLabel = el.getAttribute('aria-label')
          if (ariaLabel) {
            const matches = document.querySelectorAll(`[aria-label="${CSS.escape(ariaLabel)}"]`)
            if (matches.length === 1) {
              return `[aria-label="${CSS.escape(ariaLabel)}"]`
            }
          }

          // Build path-based selector
          const path: string[] = []
          let current: Element | null = el

          while (current && current !== document.body) {
            let segment = current.tagName.toLowerCase()

            // Add role if present
            const role = current.getAttribute('role')
            if (role) {
              segment = `${segment}[role="${role}"]`
            }

            // Add nth-child if needed for uniqueness
            const parent = current.parentElement
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                (c) => c.tagName === current!.tagName
              )
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1
                segment += `:nth-of-type(${index})`
              }
            }

            path.unshift(segment)
            current = current.parentElement

            // Stop if we have a unique selector
            if (path.length > 1) {
              const selector = path.join(' > ')
              try {
                const matches = document.querySelectorAll(selector)
                if (matches.length === 1) break
              } catch {
                // Invalid selector, continue building
              }
            }
          }

          return path.join(' > ')
        }

        // Helper to determine action type
        const getActionType = (el: Element): string => {
          const tag = el.tagName.toLowerCase()
          const type = el.getAttribute('type')
          const role = el.getAttribute('role')

          if (tag === 'input') {
            if (type === 'checkbox' || role === 'checkbox') return 'check'
            if (type === 'radio' || role === 'radio') return 'check'
            if (type === 'file') return 'upload'
            return 'fill'
          }

          if (tag === 'textarea') return 'fill'
          if (tag === 'select' || role === 'combobox' || role === 'listbox') return 'select'

          return 'click'
        }

        // Helper to check if action is destructive
        const isDestructive = (el: Element, label: string): boolean => {
          const destructivePatterns = [
            /delete/i,
            /remove/i,
            /destroy/i,
            /logout/i,
            /sign.?out/i,
            /cancel/i,
            /close/i,
            /discard/i,
            /clear/i,
          ]

          const text = label + ' ' + (el.className || '')
          return destructivePatterns.some((p) => p.test(text))
        }

        // Helper to get z-index
        const getZIndex = (el: HTMLElement): number => {
          let current: HTMLElement | null = el
          while (current) {
            const style = getComputedStyle(current)
            if (style.zIndex !== 'auto') {
              return parseInt(style.zIndex, 10)
            }
            current = current.parentElement
          }
          return 0
        }

        // Find all interactive elements
        const selector = selectors.join(',')
        const elements = document.querySelectorAll(selector)

        for (const el of elements) {
          if (discovered.length >= maxActions) break

          const htmlEl = el as HTMLElement

          // Skip ignored elements
          if (shouldIgnore(el)) continue

          // Check visibility
          const visible = isVisible(htmlEl) && isInViewport(htmlEl)

          // Check if enabled
          const isDisabled =
            el.hasAttribute('disabled') ||
            el.getAttribute('aria-disabled') === 'true'
          const enabled = !isDisabled

          if (!includeDisabled && !enabled) continue
          if (!visible) continue

          // Get bounding box
          const rect = htmlEl.getBoundingClientRect()
          if (rect.width < minSize || rect.height < minSize) continue

          const label = getLabel(el)
          const selector = getSelector(el)
          const actionType = getActionType(el)
          const destructive = isDestructive(el, label)

          // Avoid duplicates (same selector)
          if (discovered.some((d) => d.selector === selector)) continue

          discovered.push({
            type: actionType,
            selector,
            label,
            tagName: el.tagName.toLowerCase(),
            role: el.getAttribute('role'),
            visible,
            enabled,
            destructive,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            zIndex: getZIndex(htmlEl),
          })
        }

        // Sort by z-index (higher = more prominent) and position (top to bottom, left to right)
        discovered.sort((a, b) => {
          if ((b.zIndex || 0) !== (a.zIndex || 0)) {
            return (b.zIndex || 0) - (a.zIndex || 0)
          }
          if (a.boundingBox && b.boundingBox) {
            if (Math.abs(a.boundingBox.y - b.boundingBox.y) > 50) {
              return a.boundingBox.y - b.boundingBox.y
            }
            return a.boundingBox.x - b.boundingBox.x
          }
          return 0
        })

        return discovered
      },
      {
        selectors: this.options.interactiveSelectors || [],
        ignore: ignoreSelectors,
        minSize: this.options.minClickableSize || 1,
        includeDisabled: this.options.includeDisabled || false,
        maxActions: this.options.maxActions || 100,
      }
    )

    return actions.map((a) => ({
      ...a,
      type: a.type as ActionType,
      role: a.role || undefined,
      boundingBox: a.boundingBox || undefined,
    }))
  }

  /**
   * Get actions that need form input before clicking (e.g., submit buttons)
   */
  async getFormActions(page: Page): Promise<Action[]> {
    const formActions: Action[] = []

    // Find forms and their submit buttons
    const forms = await page.locator('form').all()

    for (const form of forms) {
      const isVisible = await form.isVisible()
      if (!isVisible) continue

      // Find submit button
      const submitButton = form.locator(
        'button[type="submit"], input[type="submit"], button:not([type])'
      )
      const count = await submitButton.count()

      if (count > 0) {
        const button = submitButton.first()
        const label =
          (await button.getAttribute('aria-label')) ||
          (await button.innerText()).trim() ||
          'Submit'

        formActions.push({
          type: 'click',
          selector: await this.getLocatorSelector(button),
          label: `Submit form: ${label}`,
        })
      }
    }

    return formActions
  }

  /**
   * Get a stable selector for a Playwright Locator
   */
  private async getLocatorSelector(locator: Locator): Promise<string> {
    return await locator.evaluate((el) => {
      if (el.id) return `#${el.id}`

      const testId = el.getAttribute('data-testid')
      if (testId) return `[data-testid="${testId}"]`

      // Build a basic path
      const tag = el.tagName.toLowerCase()
      const type = el.getAttribute('type')
      const role = el.getAttribute('role')

      let selector = tag
      if (type) selector += `[type="${type}"]`
      if (role) selector += `[role="${role}"]`

      return selector
    })
  }

  /**
   * Filter actions to prioritize important ones
   */
  prioritizeActions(actions: DiscoveredAction[]): DiscoveredAction[] {
    // Define priority rules
    const getPriority = (action: DiscoveredAction): number => {
      let priority = 0

      // Buttons and links are high priority
      if (action.tagName === 'button' || action.tagName === 'a') {
        priority += 10
      }

      // Form inputs are medium priority
      if (['input', 'select', 'textarea'].includes(action.tagName || '')) {
        priority += 5
      }

      // Navigation items are high priority
      if (action.label.toLowerCase().includes('nav')) {
        priority += 8
      }

      // Submit/Save buttons are very high priority
      if (/submit|save|create|add/i.test(action.label)) {
        priority += 15
      }

      // Destructive actions are lower priority (test last)
      if (action.destructive) {
        priority -= 5
      }

      // Higher z-index = more prominent
      priority += (action.zIndex || 0) / 100

      return priority
    }

    return [...actions].sort((a, b) => getPriority(b) - getPriority(a))
  }

  /**
   * Group actions by their likely purpose
   */
  groupActions(
    actions: DiscoveredAction[]
  ): Record<string, DiscoveredAction[]> {
    const groups: Record<string, DiscoveredAction[]> = {
      navigation: [],
      form: [],
      modal: [],
      destructive: [],
      other: [],
    }

    for (const action of actions) {
      if (action.destructive) {
        groups.destructive.push(action)
      } else if (
        action.tagName === 'a' ||
        /nav|menu|sidebar/i.test(action.selector)
      ) {
        groups.navigation.push(action)
      } else if (
        ['input', 'select', 'textarea'].includes(action.tagName || '') ||
        /form|input|field/i.test(action.selector)
      ) {
        groups.form.push(action)
      } else if (/modal|dialog|popup/i.test(action.selector)) {
        groups.modal.push(action)
      } else {
        groups.other.push(action)
      }
    }

    return groups
  }
}
