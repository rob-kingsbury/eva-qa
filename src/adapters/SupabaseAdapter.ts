/**
 * SupabaseAdapter - Database, Auth, and Realtime verification
 *
 * Provides:
 * - Database state capture and verification
 * - Auth state verification
 * - RLS policy testing
 * - Realtime subscription verification
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { BaseAdapter, type AdapterCapabilities } from './BaseAdapter.js'
import type { VerificationResult, DatabaseSnapshot, AuthState } from '../core/types.js'

export interface SupabaseAdapterConfig {
  url: string
  serviceKey: string // Service role key for bypassing RLS
  anonKey?: string // Anon key for RLS testing
}

interface TableStats {
  table_name: string
  row_count: number
}

export class SupabaseAdapter extends BaseAdapter {
  readonly name = 'supabase'
  readonly capabilities: AdapterCapabilities = {
    database: true,
    auth: true,
    api: true,
    realtime: true,
  }

  private client: SupabaseClient | null = null
  private anonClient: SupabaseClient | null = null
  private config: SupabaseAdapterConfig | null = null

  // Track state for comparisons
  private lastSnapshot: DatabaseSnapshot | null = null

  async connect(config: SupabaseAdapterConfig): Promise<void> {
    this.config = config

    // Create service role client (bypasses RLS)
    this.client = createClient(config.url, config.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create anon client if key provided (for RLS testing)
    if (config.anonKey) {
      this.anonClient = createClient(config.url, config.anonKey)
    }

    // Test connection
    const { error } = await this.client.from('_test_connection').select().limit(0)
    // Ignore "table not found" errors - we just want to test the connection
    if (error && !error.message.includes('does not exist')) {
      throw new Error(`Failed to connect to Supabase: ${error.message}`)
    }

    this.connected = true
  }

  async captureState(): Promise<{ database: DatabaseSnapshot; auth: AuthState }> {
    if (!this.client) {
      throw new Error('Supabase adapter not connected')
    }

    // Get table statistics
    const { data: tables, error } = await this.client.rpc('get_table_stats').returns<TableStats[]>()

    let dbSnapshot: DatabaseSnapshot = { tables: {} }

    if (!error && tables && Array.isArray(tables)) {
      for (const table of tables as TableStats[]) {
        dbSnapshot.tables[table.table_name] = {
          rowCount: table.row_count,
        }
      }
    } else {
      // Fallback: try to get counts from known tables
      dbSnapshot = await this.getTableCounts()
    }

    // Get auth state
    const {
      data: { user },
    } = await this.client.auth.getUser()

    const authState: AuthState = {
      isAuthenticated: !!user,
      userId: user?.id,
      email: user?.email || undefined,
      role: user?.role,
    }

    this.lastSnapshot = dbSnapshot

    return { database: dbSnapshot, auth: authState }
  }

  async verify(
    action: string,
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    if (!this.client) {
      return this.failure('Supabase adapter not connected')
    }

    const startTime = Date.now()

    try {
      let result: VerificationResult

      switch (action) {
        case 'rowInserted':
        case 'insert':
          result = await this.verifyRowInserted(expects)
          break

        case 'rowUpdated':
        case 'update':
          result = await this.verifyRowUpdated(expects)
          break

        case 'rowDeleted':
        case 'delete':
          result = await this.verifyRowDeleted(expects)
          break

        case 'rowCount':
          result = await this.verifyRowCount(expects)
          break

        case 'rowExists':
          result = await this.verifyRowExists(expects)
          break

        case 'rowNotExists':
          result = await this.verifyRowNotExists(expects)
          break

        case 'rlsBlocks':
          result = await this.verifyRlsBlocks(expects)
          break

        case 'rlsAllows':
          result = await this.verifyRlsAllows(expects)
          break

        case 'authState':
          result = await this.verifyAuthState(expects)
          break

        case 'columnEquals':
          result = await this.verifyColumnEquals(expects)
          break

        default:
          result = this.failure(`Unknown Supabase action: ${action}`)
      }

      result.duration = Date.now() - startTime
      result.type = 'database'
      return result
    } catch (err) {
      return this.error(err as Error)
    }
  }

  async disconnect(): Promise<void> {
    this.client = null
    this.anonClient = null
    this.config = null
    this.lastSnapshot = null
    this.connected = false
  }

  getSupportedActions(): string[] {
    return [
      'rowInserted',
      'insert',
      'rowUpdated',
      'update',
      'rowDeleted',
      'delete',
      'rowCount',
      'rowExists',
      'rowNotExists',
      'rlsBlocks',
      'rlsAllows',
      'authState',
      'columnEquals',
    ]
  }

  // ============================================================================
  // Verification Methods
  // ============================================================================

  private async verifyRowInserted(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const { table, where, count = 1 } = expects as {
      table: string
      where?: Record<string, unknown>
      count?: number
    }

    let query = this.client!.from(table).select('*', { count: 'exact' })

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value)
      }
    }

    const { data, count: rowCount, error } = await query

    if (error) {
      return this.failure(`Database error: ${error.message}`)
    }

    const found = rowCount || data?.length || 0

    if (found >= count) {
      return this.success(`Found ${found} matching row(s) in ${table}`, {
        table,
        where,
        found,
        rows: data?.slice(0, 5),
      })
    }

    return this.failure(
      `Expected ${count} row(s) in ${table}, found ${found}`,
      count,
      found,
      { table, where, rows: data }
    )
  }

  private async verifyRowUpdated(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const { table, where, values } = expects as {
      table: string
      where: Record<string, unknown>
      values: Record<string, unknown>
    }

    let query = this.client!.from(table).select('*')

    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key, value)
    }

    const { data, error } = await query.single()

    if (error) {
      return this.failure(`Row not found: ${error.message}`)
    }

    // Check if values match
    for (const [key, expected] of Object.entries(values)) {
      const actual = data[key]
      if (actual !== expected) {
        return this.failure(
          `Column ${key} has value ${actual}, expected ${expected}`,
          expected,
          actual,
          { table, where, row: data }
        )
      }
    }

    return this.success(`Row in ${table} has expected values`, {
      table,
      where,
      values,
      row: data,
    })
  }

  private async verifyRowDeleted(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const { table, where } = expects as {
      table: string
      where: Record<string, unknown>
    }

    let query = this.client!.from(table).select('*', { count: 'exact' })

    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key, value)
    }

    const { count, error } = await query

    if (error) {
      return this.failure(`Database error: ${error.message}`)
    }

    if (count === 0) {
      return this.success(`Row successfully deleted from ${table}`, {
        table,
        where,
      })
    }

    return this.failure(
      `Row still exists in ${table}`,
      0,
      count,
      { table, where }
    )
  }

  private async verifyRowCount(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const { table, count: expectedCount, where } = expects as {
      table: string
      count: number
      where?: Record<string, unknown>
    }

    let query = this.client!.from(table).select('*', { count: 'exact', head: true })

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value)
      }
    }

    const { count, error } = await query

    if (error) {
      return this.failure(`Database error: ${error.message}`)
    }

    if (count === expectedCount) {
      return this.success(`Table ${table} has ${count} rows`, { table, count })
    }

    return this.failure(
      `Expected ${expectedCount} rows in ${table}, found ${count}`,
      expectedCount,
      count,
      { table, where }
    )
  }

  private async verifyRowExists(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const { table, where } = expects as {
      table: string
      where: Record<string, unknown>
    }

    let query = this.client!.from(table).select('*')

    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key, value)
    }

    const { data, error } = await query.limit(1)

    if (error) {
      return this.failure(`Database error: ${error.message}`)
    }

    if (data && data.length > 0) {
      return this.success(`Row exists in ${table}`, { table, where, row: data[0] })
    }

    return this.failure(`Row not found in ${table}`, true, false, { table, where })
  }

  private async verifyRowNotExists(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const result = await this.verifyRowExists(expects)
    // Invert the result
    return {
      ...result,
      passed: !result.passed,
      message: result.passed
        ? `Row unexpectedly exists in ${(expects as { table: string }).table}`
        : `Row correctly does not exist in ${(expects as { table: string }).table}`,
    }
  }

  private async verifyRlsBlocks(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    if (!this.anonClient) {
      return this.failure('Anon client not configured for RLS testing')
    }

    const { table, operation, where } = expects as {
      table: string
      operation: 'select' | 'insert' | 'update' | 'delete'
      where?: Record<string, unknown>
    }

    try {
      let error: { code?: string; message?: string } | null = null

      switch (operation) {
        case 'select': {
          let query = this.anonClient.from(table).select('*')
          if (where) {
            for (const [key, value] of Object.entries(where)) {
              query = query.eq(key, value)
            }
          }
          const result = await query
          error = result.error
          // If no error but empty data, RLS might be filtering
          if (!error && result.data?.length === 0) {
            return this.success(`RLS filtered all rows from ${table}`, { table, operation })
          }
          break
        }
        case 'insert': {
          const result = await this.anonClient.from(table).insert(where || {})
          error = result.error
          break
        }
        case 'update': {
          let query = this.anonClient.from(table).update({ _test: true })
          if (where) {
            for (const [key, value] of Object.entries(where)) {
              query = query.eq(key, value)
            }
          }
          const result = await query
          error = result.error
          break
        }
        case 'delete': {
          let query = this.anonClient.from(table).delete()
          if (where) {
            for (const [key, value] of Object.entries(where)) {
              query = query.eq(key, value)
            }
          }
          const result = await query
          error = result.error
          break
        }
      }

      if (error) {
        return this.success(`RLS correctly blocked ${operation} on ${table}`, {
          table,
          operation,
          error: error.message,
        })
      }

      return this.failure(
        `RLS did not block ${operation} on ${table}`,
        'blocked',
        'allowed',
        { table, operation }
      )
    } catch (err) {
      // An error might mean RLS blocked the operation
      return this.success(`RLS blocked ${operation} on ${table}`, {
        table,
        operation,
        error: (err as Error).message,
      })
    }
  }

  private async verifyRlsAllows(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const result = await this.verifyRlsBlocks(expects)
    // Invert the result
    return {
      ...result,
      passed: !result.passed,
      message: result.passed
        ? `RLS unexpectedly blocked operation on ${(expects as { table: string }).table}`
        : `RLS correctly allows operation on ${(expects as { table: string }).table}`,
    }
  }

  private async verifyAuthState(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const { isAuthenticated, userId, role } = expects as {
      isAuthenticated?: boolean
      userId?: string
      role?: string
    }

    const {
      data: { user },
    } = await this.client!.auth.getUser()

    if (isAuthenticated !== undefined) {
      const isAuth = !!user
      if (isAuth !== isAuthenticated) {
        return this.failure(
          `Expected authenticated=${isAuthenticated}, got ${isAuth}`,
          isAuthenticated,
          isAuth
        )
      }
    }

    if (userId !== undefined && user?.id !== userId) {
      return this.failure(`Expected userId=${userId}, got ${user?.id}`, userId, user?.id)
    }

    if (role !== undefined && user?.role !== role) {
      return this.failure(`Expected role=${role}, got ${user?.role}`, role, user?.role)
    }

    return this.success('Auth state matches expected', {
      isAuthenticated: !!user,
      userId: user?.id,
      role: user?.role,
    })
  }

  private async verifyColumnEquals(
    expects: Record<string, unknown>
  ): Promise<VerificationResult> {
    const { table, where, column, value } = expects as {
      table: string
      where: Record<string, unknown>
      column: string
      value: unknown
    }

    let query = this.client!.from(table).select(column)

    for (const [key, val] of Object.entries(where)) {
      query = query.eq(key, val)
    }

    const { data, error } = await query.single()

    if (error) {
      return this.failure(`Row not found: ${error.message}`)
    }

    const actual = (data as unknown as Record<string, unknown>)[column]

    if (actual === value) {
      return this.success(`Column ${column} equals expected value`, {
        table,
        column,
        value,
      })
    }

    return this.failure(
      `Column ${column} has value ${actual}, expected ${value}`,
      value,
      actual,
      { table, where, column }
    )
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get row counts for common tables (fallback when RPC not available)
   */
  private async getTableCounts(): Promise<DatabaseSnapshot> {
    const snapshot: DatabaseSnapshot = { tables: {} }

    // Common table names to check
    const commonTables = [
      'users',
      'profiles',
      'songs',
      'setlists',
      'setlist_songs',
      'bands',
      'user_bands',
      'members',
      'subscriptions',
      'share_tokens',
      'stage_sessions',
    ]

    for (const table of commonTables) {
      try {
        const { count, error } = await this.client!
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (!error && count !== null) {
          snapshot.tables[table] = { rowCount: count }
        }
      } catch {
        // Table doesn't exist, skip
      }
    }

    return snapshot
  }

  /**
   * Compare two snapshots and return differences
   */
  compareSnapshots(
    before: DatabaseSnapshot,
    after: DatabaseSnapshot
  ): Record<string, { before: number; after: number; diff: number }> {
    const diff: Record<string, { before: number; after: number; diff: number }> = {}

    const allTables = new Set([
      ...Object.keys(before.tables),
      ...Object.keys(after.tables),
    ])

    for (const table of allTables) {
      const beforeCount = before.tables[table]?.rowCount || 0
      const afterCount = after.tables[table]?.rowCount || 0

      if (beforeCount !== afterCount) {
        diff[table] = {
          before: beforeCount,
          after: afterCount,
          diff: afterCount - beforeCount,
        }
      }
    }

    return diff
  }
}
