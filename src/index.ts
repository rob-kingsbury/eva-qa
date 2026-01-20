/**
 * EVA - Explore, Validate, Analyze
 *
 * Zero-config UI testing that crawls your app and finds accessibility,
 * responsive, and functional issues.
 *
 * @example
 * ```typescript
 * import { Explorer, createConfig } from 'eva-qa'
 *
 * const config = createConfig({
 *   baseUrl: 'http://localhost:5173',
 *   auth: './playwright/.auth/user.json',
 * })
 *
 * const explorer = new Explorer(config)
 * const result = await explorer.explore()
 *
 * console.log(`Found ${result.summary.statesExplored} states`)
 * console.log(`Issues: ${result.summary.issuesFound}`)
 * ```
 */

// Core
export { Explorer } from './core/Explorer.js'
export { StateManager } from './core/StateManager.js'
export { ActionDiscovery } from './core/ActionDiscovery.js'

// Adapters
export { BaseAdapter, AdapterRegistry } from './adapters/BaseAdapter.js'
export { SupabaseAdapter } from './adapters/SupabaseAdapter.js'

// Validators
export { AccessibilityValidator } from './validators/AccessibilityValidator.js'
export { ResponsiveValidator } from './validators/ResponsiveValidator.js'

// Types
export type {
  // Config
  ExplorerConfig,
  AdapterConfig,
  ValidatorConfig,
  TestDataConfig,

  // State
  AppState,
  DatabaseSnapshot,
  AuthState,
  FormState,

  // Actions
  Action,
  ActionType,
  DiscoveredAction,
  ActionSchema,
  ActionMatcher,
  ActionExpectation,
  SetupStep,

  // Expectations
  DatabaseExpectation,
  ApiExpectation,
  UiExpectation,
  ServiceExpectation,

  // Results
  VerificationResult,
  ActionResult,
  ExplorationResult,
  ExplorationSummary,
  ValidatorResult,

  // Graph
  StateGraph,
  StateNode,
  StateTransition,

  // Issues
  Issue,
  IssueType,
  IssueSeverity,

  // Viewport
  Viewport,
  ViewportName,

  // Events
  ExplorerEvent,
  ExplorerEventHandler,
} from './core/types.js'

export { VIEWPORTS } from './core/types.js'

/**
 * Create a configuration object with defaults
 */
export function createConfig(config: Partial<import('./core/types.js').ExplorerConfig>): import('./core/types.js').ExplorerConfig {
  if (!config.baseUrl) {
    throw new Error('baseUrl is required')
  }

  return {
    baseUrl: config.baseUrl,
    startUrls: config.startUrls,
    auth: config.auth,
    adapters: config.adapters,
    actionSchemas: config.actionSchemas,
    testData: config.testData,
    validators: {
      accessibility: { enabled: true, rules: ['wcag21aa'], ...config.validators?.accessibility },
      responsive: { enabled: true, checkOverflow: true, checkTouchTargets: true, minTouchTarget: 44, ...config.validators?.responsive },
      console: { enabled: true, failOnError: false, ...config.validators?.console },
      network: { enabled: true, maxResponseTime: 5000, ...config.validators?.network },
    },
    exploration: {
      maxDepth: 10,
      maxStates: 500,
      maxActionsPerState: 50,
      timeout: 10000,
      viewports: ['mobile', 'desktop'],
      waitForNetworkIdle: true,
      actionDelay: 100,
      ...config.exploration,
    },
    ignore: config.ignore || [],
    setup: config.setup,
    output: {
      dir: './eva-qa-reports',
      formats: ['html', 'json'],
      screenshots: true,
      screenshotFormat: 'png',
      ...config.output,
    },
    headless: config.headless ?? true,
    browser: config.browser || 'chromium',
  }
}
