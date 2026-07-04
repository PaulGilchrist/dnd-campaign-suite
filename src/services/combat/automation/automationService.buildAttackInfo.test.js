// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { getAutomationInfo } from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── getAutomationInfo – input validation & edge paths ────────────────────────

describe('getAutomationInfo – input validation', () => {
  const ps = makePlayerStats()

  it('returns null when feature is null', () => {
    expect(getAutomationInfo(null, ps)).toBeNull()
  })

  it('returns null when feature is an empty object', () => {
    expect(getAutomationInfo({}, ps)).toBeNull()
  })

  it('returns null when feature has no automation property', () => {
    expect(getAutomationInfo({ name: 'Test' }, ps)).toBeNull()
  })

  it('returns null when automation is null', () => {
    expect(getAutomationInfo({ automation: null }, ps)).toBeNull()
  })

  it('returns null when feature.automation is an array but no handler matches', () => {
    const info = getAutomationInfo(makeFeature([{ type: 'nonexistent' }, { type: 'also_nonexistent' }]), ps)
    expect(info).toBeNull()
  })

  it('returns the first matching automation when feature.automation is an array', () => {
    const info = getAutomationInfo(makeFeature([{ type: 'attack_rider' }, { type: 'auto_effect' }]), ps)
    expect(info.type).toBe('attack_rider')
  })

  it('returns null for unsupported automation type', () => {
    const info = getAutomationInfo(makeFeature({ type: 'nonexistent_type' }), ps)
    expect(info).toBeNull()
  })
})
