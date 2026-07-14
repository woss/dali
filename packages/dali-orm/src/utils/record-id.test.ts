import { describe, it, expect } from 'vitest'
import { resolveRecordId } from './record-id.js'

describe('resolveRecordId', () => {
  // ─── Colon-qualified format ───────────────────────────────────────
  it('normalises colon-qualified id (memories:abc123)', () => {
    expect(resolveRecordId('memories:abc123', 'memories')).toBe('memories:abc123')
  })

  it('overrides table prefix in colon-qualified id (users:abc123 → memories)', () => {
    expect(resolveRecordId('users:abc123', 'memories')).toBe('memories:abc123')
  })

  // ─── Angle-bracket format ─────────────────────────────────────────
  it('normalises Unicode angle-bracket id (memories⟨abc123⟩)', () => {
    expect(resolveRecordId('memories⟨abc123⟩', 'memories')).toBe('memories:abc123')
  })

  it('extracts complex key from angle-bracket id (memories⟨user:123⟩)', () => {
    expect(resolveRecordId('memories⟨user:123⟩', 'memories')).toBe('memories:user:123')
  })

  // ─── Bare key ─────────────────────────────────────────────────────
  it('qualifies bare key with tableName', () => {
    expect(resolveRecordId('abc123', 'memories')).toBe('memories:abc123')
  })

  // ─── Multi-colon key ──────────────────────────────────────────────
  it('preserves colons in key portion (memories:a:b)', () => {
    expect(resolveRecordId('memories:a:b', 'memories')).toBe('memories:a:b')
  })

  // ─── Error: empty string ──────────────────────────────────────────
  it('throws on empty recordId', () => {
    expect(() => resolveRecordId('', 'memories')).toThrow('Record ID is required')
  })

  it('throws on empty tableName', () => {
    expect(() => resolveRecordId('abc123', '')).toThrow('Table name is required')
  })

  // ─── Error: ASCII angle brackets ──────────────────────────────────
  it('throws on ASCII left angle bracket', () => {
    expect(() => resolveRecordId('table<key>', 'table')).toThrow(
      'Invalid record ID format',
    )
  })

  it('throws on ASCII right angle bracket', () => {
    expect(() => resolveRecordId('table>key', 'table')).toThrow(
      'Invalid record ID format',
    )
  })
})
