/**
 * BaseAdapter - Abstract interface for service adapters
 *
 * All service adapters (Supabase, Stripe, etc.) must implement this interface.
 * Adapters provide:
 * - State capture (for snapshots)
 * - Verification (check expectations after actions)
 */

import type { VerificationResult } from '../core/types.js'

export interface AdapterCapabilities {
  /** Can capture database state */
  database?: boolean
  /** Can capture auth state */
  auth?: boolean
  /** Can verify API calls */
  api?: boolean
  /** Can verify webhooks */
  webhooks?: boolean
  /** Can verify realtime subscriptions */
  realtime?: boolean
  /** Custom capabilities */
  [key: string]: boolean | undefined
}

export abstract class BaseAdapter {
  /** Unique name for this adapter */
  abstract readonly name: string

  /** Capabilities this adapter provides */
  abstract readonly capabilities: AdapterCapabilities

  /** Whether the adapter is currently connected */
  protected connected = false

  /**
   * Initialize connection to the service
   */
  abstract connect(config: unknown): Promise<void>

  /**
   * Capture current state for snapshots
   */
  abstract captureState(): Promise<unknown>

  /**
   * Verify an expectation after an action
   *
   * @param action - The verification action to perform (e.g., 'rowInserted', 'checkoutCreated')
   * @param expects - Expected values to verify against
   */
  abstract verify(
    action: string,
    expects: Record<string, unknown>
  ): Promise<VerificationResult>

  /**
   * Disconnect and cleanup
   */
  abstract disconnect(): Promise<void>

  /**
   * Check if adapter is connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get supported verification actions
   */
  abstract getSupportedActions(): string[]

  /**
   * Helper to create a successful verification result
   */
  protected success(
    message: string,
    details?: Record<string, unknown>
  ): VerificationResult {
    return {
      passed: true,
      message,
      type: 'service',
      details,
    }
  }

  /**
   * Helper to create a failed verification result
   */
  protected failure(
    message: string,
    expected?: unknown,
    actual?: unknown,
    details?: Record<string, unknown>
  ): VerificationResult {
    return {
      passed: false,
      message,
      type: 'service',
      expected,
      actual,
      details,
    }
  }

  /**
   * Helper to create an error verification result
   */
  protected error(error: Error): VerificationResult {
    return {
      passed: false,
      message: `Adapter error: ${error.message}`,
      type: 'service',
      details: { error: error.message, stack: error.stack },
    }
  }
}

/**
 * Registry for managing multiple adapters
 */
export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map()

  /**
   * Register an adapter
   */
  register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.name, adapter)
  }

  /**
   * Get an adapter by name
   */
  get(name: string): BaseAdapter | undefined {
    return this.adapters.get(name)
  }

  /**
   * Get all registered adapters
   */
  getAll(): Map<string, BaseAdapter> {
    return new Map(this.adapters)
  }

  /**
   * Check if an adapter is registered
   */
  has(name: string): boolean {
    return this.adapters.has(name)
  }

  /**
   * Connect all adapters with their configs
   */
  async connectAll(configs: Record<string, unknown>): Promise<void> {
    const promises = Array.from(this.adapters.entries()).map(
      async ([name, adapter]) => {
        const config = configs[name]
        if (config) {
          await adapter.connect(config)
        }
      }
    )
    await Promise.all(promises)
  }

  /**
   * Disconnect all adapters
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.adapters.values()).map((adapter) =>
      adapter.disconnect()
    )
    await Promise.all(promises)
  }

  /**
   * Capture state from all adapters
   */
  async captureAllStates(): Promise<Record<string, unknown>> {
    const states: Record<string, unknown> = {}

    for (const [name, adapter] of this.adapters) {
      if (adapter.isConnected()) {
        try {
          states[name] = await adapter.captureState()
        } catch {
          // Capture failed, skip this adapter
        }
      }
    }

    return states
  }

  /**
   * Find adapter that supports a specific action
   */
  findAdapterForAction(action: string): BaseAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.getSupportedActions().includes(action)) {
        return adapter
      }
    }
    return undefined
  }
}
