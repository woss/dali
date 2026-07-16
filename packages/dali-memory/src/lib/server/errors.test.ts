import { describe, expect, it } from 'vitest'
import { DaliOrmError } from '@woss/dali-orm/core/errors'
import { MemoryError, TagError, WorkspaceError } from './errors'

describe('Error Hierarchy', () => {
  describe('MemoryError', () => {
    it('is exported and importable', () => {
      expect(MemoryError).toBeDefined()
      expect(typeof MemoryError).toBe('function')
    })

    it('extends DaliOrmError', () => {
      expect(new MemoryError('test')).toBeInstanceOf(DaliOrmError)
      expect(new MemoryError('test')).toBeInstanceOf(Error)
    })

    it('has correct name property', () => {
      const error = new MemoryError('test')
      expect(error.name).toBe('MemoryError')
    })

    it('preserves message', () => {
      const error = new MemoryError('Memory not found')
      expect(error.message).toBe('Memory not found')
    })

    it('stores context when provided', () => {
      const context = { memoryId: 'mem_123' }
      const error = new MemoryError('not found', context)
      expect(error.context).toEqual(context)
    })

    it('has undefined context when not provided', () => {
      const error = new MemoryError('test')
      expect(error.context).toBeUndefined()
    })
  })

  describe('TagError', () => {
    it('is exported and importable', () => {
      expect(TagError).toBeDefined()
      expect(typeof TagError).toBe('function')
    })

    it('extends DaliOrmError', () => {
      expect(new TagError('test')).toBeInstanceOf(DaliOrmError)
      expect(new TagError('test')).toBeInstanceOf(Error)
    })

    it('has correct name property', () => {
      const error = new TagError('test')
      expect(error.name).toBe('TagError')
    })

    it('preserves message', () => {
      const error = new TagError('Tag already exists')
      expect(error.message).toBe('Tag already exists')
    })

    it('stores context when provided', () => {
      const context = { tagName: 'important' }
      const error = new TagError('duplicate', context)
      expect(error.context).toEqual(context)
    })

    it('has undefined context when not provided', () => {
      const error = new TagError('test')
      expect(error.context).toBeUndefined()
    })
  })

  describe('WorkspaceError', () => {
    it('is exported and importable', () => {
      expect(WorkspaceError).toBeDefined()
      expect(typeof WorkspaceError).toBe('function')
    })

    it('extends DaliOrmError', () => {
      expect(new WorkspaceError('test')).toBeInstanceOf(DaliOrmError)
      expect(new WorkspaceError('test')).toBeInstanceOf(Error)
    })

    it('has correct name property', () => {
      const error = new WorkspaceError('test')
      expect(error.name).toBe('WorkspaceError')
    })

    it('preserves message', () => {
      const error = new WorkspaceError('Workspace name already taken')
      expect(error.message).toBe('Workspace name already taken')
    })

    it('stores context when provided', () => {
      const context = { name: 'my-workspace' }
      const error = new WorkspaceError('name taken', context)
      expect(error.context).toEqual(context)
    })

    it('has undefined context when not provided', () => {
      const error = new WorkspaceError('test')
      expect(error.context).toBeUndefined()
    })
  })
})
