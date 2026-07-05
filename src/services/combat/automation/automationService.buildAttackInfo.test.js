// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { getAutomationInfo } from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── getAutomationInfo – input validation & edge paths ────────────────────────

describe('getAutomationInfo – input validation', () => {
  const ps = makePlayerStats()

  it('returns null when feature is null, missing automation, or automation is null', () => {
    expect(getAutomationInfo(null, ps)).toBeNull()
    expect(getAutomationInfo({}, ps)).toBeNull()
    expect(getAutomationInfo({ name: 'Test' }, ps)).toBeNull()
    expect(getAutomationInfo({ automation: null }, ps)).toBeNull()
  })

  it('returns null for unsupported automation type', () => {
    const info = getAutomationInfo(makeFeature({ type: 'nonexistent_type' }), ps)
    expect(info).toBeNull()
  })

  it('handles array of automations — returns first match or null', () => {
    expect(getAutomationInfo(makeFeature([{ type: 'nonexistent' }, { type: 'also_nonexistent' }]), ps)).toBeNull()
    const info = getAutomationInfo(makeFeature([{ type: 'attack_rider' }, { type: 'auto_effect' }]), ps)
    expect(info.type).toBe('attack_rider')
  })
})
