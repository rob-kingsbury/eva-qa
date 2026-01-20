/**
 * SupabaseAdapter Tests
 *
 * Tests for Supabase database and auth verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupabaseAdapter } from '../adapters/SupabaseAdapter.js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    rpc: vi.fn().mockReturnValue({
      returns: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  })),
}))

describe('SupabaseAdapter', () => {
  let adapter: SupabaseAdapter

  beforeEach(() => {
    adapter = new SupabaseAdapter()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create adapter with correct name', () => {
      expect(adapter.name).toBe('supabase')
    })

    it('should have correct capabilities', () => {
      expect(adapter.capabilities).toEqual({
        database: true,
        auth: true,
        api: true,
        realtime: true,
      })
    })

    it('should not be connected initially', () => {
      expect(adapter.isConnected()).toBe(false)
    })
  })

  describe('connect', () => {
    it('should connect with valid credentials', async () => {
      const config = {
        url: 'https://test.supabase.co',
        serviceKey: 'test-service-key',
      }

      await adapter.connect(config)

      expect(adapter.isConnected()).toBe(true)
    })

    it('should create anon client when anonKey provided', async () => {
      const { createClient } = await import('@supabase/supabase-js')

      const config = {
        url: 'https://test.supabase.co',
        serviceKey: 'test-service-key',
        anonKey: 'test-anon-key',
      }

      await adapter.connect(config)

      expect(createClient).toHaveBeenCalledTimes(2)
    })

    it('should handle connection errors', async () => {
      const { createClient } = await import('@supabase/supabase-js')
      ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              error: { message: 'Connection failed' },
            }),
          }),
        }),
      })

      await expect(
        adapter.connect({
          url: 'https://test.supabase.co',
          serviceKey: 'invalid-key',
        })
      ).rejects.toThrow('Failed to connect to Supabase')
    })
  })

  describe('captureState', () => {
    beforeEach(async () => {
      const { createClient } = await import('@supabase/supabase-js')
      ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        rpc: vi.fn().mockReturnValue({
          returns: vi.fn().mockResolvedValue({
            data: [
              { table_name: 'users', row_count: 10 },
              { table_name: 'posts', row_count: 50 },
            ],
            error: null,
          }),
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123', email: 'test@example.com', role: 'authenticated' } },
          }),
        },
      })

      await adapter.connect({
        url: 'https://test.supabase.co',
        serviceKey: 'test-key',
      })
    })

    it('should capture database snapshot', async () => {
      const state = await adapter.captureState()

      expect(state.database).toBeDefined()
      expect(state.database.tables).toBeDefined()
    })

    it('should capture auth state', async () => {
      const state = await adapter.captureState()

      expect(state.auth).toBeDefined()
      expect(state.auth.isAuthenticated).toBe(true)
      expect(state.auth.userId).toBe('user-123')
      expect(state.auth.email).toBe('test@example.com')
    })

    it('should throw when not connected', async () => {
      const newAdapter = new SupabaseAdapter()

      await expect(newAdapter.captureState()).rejects.toThrow('not connected')
    })
  })

  describe('verify', () => {
    let mockClient: {
      from: ReturnType<typeof vi.fn>
      auth: { getUser: ReturnType<typeof vi.fn> }
    }

    beforeEach(async () => {
      const { createClient } = await import('@supabase/supabase-js')

      mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      }

      ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient)

      await adapter.connect({
        url: 'https://test.supabase.co',
        serviceKey: 'test-key',
      })
    })

    it('should return failure when not connected', async () => {
      const newAdapter = new SupabaseAdapter()

      const result = await newAdapter.verify('insert', { table: 'users' })

      expect(result.passed).toBe(false)
      expect(result.message).toContain('not connected')
    })

    describe('rowInserted / insert', () => {
      it('should verify row was inserted', async () => {
        // Mock chainable query that returns thenable
        const mockEq = vi.fn().mockImplementation(function(this: unknown) {
          return {
            eq: mockEq,
            then: (resolve: (v: unknown) => unknown) => resolve({
              data: [{ id: 1, name: 'Test' }],
              count: 1,
              error: null,
            }),
            catch: () => {},
          }
        })
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: mockEq,
          }),
        })

        const result = await adapter.verify('insert', {
          table: 'users',
          where: { name: 'Test' },
        })

        expect(result.passed).toBe(true)
        expect(result.message).toContain('Found')
      })

      it('should fail when row not found', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              count: 0,
              error: null,
            }),
          }),
        })

        const result = await adapter.verify('insert', {
          table: 'users',
          where: { id: 999 },
        })

        expect(result.passed).toBe(false)
        expect(result.message).toContain('Expected')
      })
    })

    describe('rowUpdated / update', () => {
      it('should verify row was updated', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 1, name: 'Updated Name', status: 'active' },
                error: null,
              }),
            }),
          }),
        })

        const result = await adapter.verify('update', {
          table: 'users',
          where: { id: 1 },
          values: { name: 'Updated Name', status: 'active' },
        })

        expect(result.passed).toBe(true)
        expect(result.message).toContain('expected values')
      })

      it('should fail when values do not match', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 1, name: 'Wrong Name' },
                error: null,
              }),
            }),
          }),
        })

        const result = await adapter.verify('update', {
          table: 'users',
          where: { id: 1 },
          values: { name: 'Expected Name' },
        })

        expect(result.passed).toBe(false)
        expect(result.message).toContain('Wrong Name')
        expect(result.message).toContain('Expected Name')
      })
    })

    describe('rowDeleted / delete', () => {
      it('should verify row was deleted', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        })

        const result = await adapter.verify('delete', {
          table: 'users',
          where: { id: 1 },
        })

        expect(result.passed).toBe(true)
        expect(result.message).toContain('deleted')
      })

      it('should fail when row still exists', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 1,
              error: null,
            }),
          }),
        })

        const result = await adapter.verify('delete', {
          table: 'users',
          where: { id: 1 },
        })

        expect(result.passed).toBe(false)
        expect(result.message).toContain('still exists')
      })
    })

    describe('rowCount', () => {
      it('should verify row count', async () => {
        // rowCount without where clause calls select() directly (no eq chaining)
        mockClient.from.mockReturnValue({
          select: vi.fn().mockResolvedValue({
            count: 5,
            error: null,
          }),
        })

        const result = await adapter.verify('rowCount', {
          table: 'users',
          count: 5,
        })

        expect(result.passed).toBe(true)
      })

      it('should fail when count does not match', async () => {
        // rowCount without where clause calls select() directly (no eq chaining)
        mockClient.from.mockReturnValue({
          select: vi.fn().mockResolvedValue({
            count: 10,
            error: null,
          }),
        })

        const result = await adapter.verify('rowCount', {
          table: 'users',
          count: 5,
        })

        expect(result.passed).toBe(false)
        expect(result.message).toContain('Expected 5')
        expect(result.message).toContain('found 10')
      })
    })

    describe('rowExists', () => {
      it('should verify row exists', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 1 }],
                error: null,
              }),
            }),
          }),
        })

        const result = await adapter.verify('rowExists', {
          table: 'users',
          where: { id: 1 },
        })

        expect(result.passed).toBe(true)
      })

      it('should fail when row does not exist', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        })

        const result = await adapter.verify('rowExists', {
          table: 'users',
          where: { id: 999 },
        })

        expect(result.passed).toBe(false)
      })
    })

    describe('rowNotExists', () => {
      it('should verify row does not exist', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        })

        const result = await adapter.verify('rowNotExists', {
          table: 'users',
          where: { id: 999 },
        })

        expect(result.passed).toBe(true)
      })
    })

    describe('authState', () => {
      it('should verify authenticated state', async () => {
        mockClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', role: 'admin' } },
        })

        const result = await adapter.verify('authState', {
          isAuthenticated: true,
          userId: 'user-123',
          role: 'admin',
        })

        expect(result.passed).toBe(true)
      })

      it('should fail when auth state does not match', async () => {
        mockClient.auth.getUser.mockResolvedValue({
          data: { user: null },
        })

        const result = await adapter.verify('authState', {
          isAuthenticated: true,
        })

        expect(result.passed).toBe(false)
      })
    })

    describe('columnEquals', () => {
      it('should verify column value', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { status: 'active' },
                error: null,
              }),
            }),
          }),
        })

        const result = await adapter.verify('columnEquals', {
          table: 'users',
          where: { id: 1 },
          column: 'status',
          value: 'active',
        })

        expect(result.passed).toBe(true)
      })
    })

    describe('unknown action', () => {
      it('should return failure for unknown action', async () => {
        const result = await adapter.verify('unknownAction', {})

        expect(result.passed).toBe(false)
        expect(result.message).toContain('Unknown Supabase action')
      })
    })
  })

  describe('disconnect', () => {
    it('should disconnect and clear state', async () => {
      const { createClient } = await import('@supabase/supabase-js')
      ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })

      await adapter.connect({
        url: 'https://test.supabase.co',
        serviceKey: 'test-key',
      })

      expect(adapter.isConnected()).toBe(true)

      await adapter.disconnect()

      expect(adapter.isConnected()).toBe(false)
    })
  })

  describe('getSupportedActions', () => {
    it('should return list of supported actions', () => {
      const actions = adapter.getSupportedActions()

      expect(actions).toContain('insert')
      expect(actions).toContain('update')
      expect(actions).toContain('delete')
      expect(actions).toContain('rowCount')
      expect(actions).toContain('rowExists')
      expect(actions).toContain('rowNotExists')
      expect(actions).toContain('authState')
      expect(actions).toContain('columnEquals')
      expect(actions).toContain('rlsBlocks')
      expect(actions).toContain('rlsAllows')
    })
  })

  describe('compareSnapshots', () => {
    it('should detect row count changes', () => {
      const before = {
        tables: {
          users: { rowCount: 10 },
          posts: { rowCount: 50 },
        },
      }

      const after = {
        tables: {
          users: { rowCount: 11 },
          posts: { rowCount: 50 },
        },
      }

      const diff = adapter.compareSnapshots(before, after)

      expect(diff.users).toEqual({
        before: 10,
        after: 11,
        diff: 1,
      })
      expect(diff.posts).toBeUndefined()
    })

    it('should handle new tables', () => {
      const before = {
        tables: {
          users: { rowCount: 10 },
        },
      }

      const after = {
        tables: {
          users: { rowCount: 10 },
          posts: { rowCount: 5 },
        },
      }

      const diff = adapter.compareSnapshots(before, after)

      expect(diff.posts).toEqual({
        before: 0,
        after: 5,
        diff: 5,
      })
    })

    it('should handle removed tables', () => {
      const before = {
        tables: {
          users: { rowCount: 10 },
          temp: { rowCount: 5 },
        },
      }

      const after = {
        tables: {
          users: { rowCount: 10 },
        },
      }

      const diff = adapter.compareSnapshots(before, after)

      expect(diff.temp).toEqual({
        before: 5,
        after: 0,
        diff: -5,
      })
    })

    it('should return empty object when no changes', () => {
      const snapshot = {
        tables: {
          users: { rowCount: 10 },
        },
      }

      const diff = adapter.compareSnapshots(snapshot, snapshot)

      expect(Object.keys(diff)).toHaveLength(0)
    })
  })
})
