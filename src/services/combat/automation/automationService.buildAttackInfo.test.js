// @maintained-by-ai
// ── FACADE LANE: automationService.getAutomationInfo / buildAttackInfo ─────
// Family split (automationService.*):
//   • THIS FILE — facade wiring of getAutomationInfo: guard battery, delegation
//     into automationInfoBuilder.buildAttackInfo, array-scan semantics
//     (first-truthy-half wins, winner's envelope merged with feature bytes via
//     { ...feature, automation: auto }), and the buildAttackInfo re-export.
//   • automationService.core.test.js — hasAutomation + expression helpers.
//     Its legacy `getAutomationInfo` block is subsumed by the guard battery +
//     delegation pins here; removal recommended (reported, not implemented).
//   • automationService.collection.test.js — catalog categorization (#957/#960).
//   • automationService.modifiers.test.js — collectSaveModifiers rows (#964).
//   • automationService.interactive.* — isInteractiveAutomation rows (#961).
//   • automationPassives.* — passive predicates (#965-#970).
//   • automationInfoBuilder.test.js — builder facade delegation table
//     (#952-#963); per-type envelope bytes live in automationInfoBuilder/
//     <domain>.test.js (attack_rider → attack.test.js, auto_effect →
//     core-handlers.test.js). THIS file pins wiring bytes only (which half
//     won, feature.name merge), never re-computing builder envelope bytes.
// Old → new: old "null/missing automation" + "unsupported type" tests fold
// into the full-zero guard battery (#936); old weak "first match or null"
// (passed even if the loop returned the LAST half) is strengthened to pin
// null-skip + first-truthy + merged envelope bytes.
// Real modules, facade unmocked (#791). Deterministic; zero timers, zero
// network — builder resolution is pure string/level math.
import { describe, it, expect } from 'vitest'

import { getAutomationInfo, buildAttackInfo as buildAttackInfoViaService } from './automationService.js'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { makePlayerStats, makeFeature } from './automationService.test-utils.js'

const ps = makePlayerStats()

// ── guard battery: nothing declared → honest null, never throws ─────────────

describe('getAutomationInfo – guard battery', () => {
  it('returns null for every input declaring no buildable automation', () => {
    const unbuildable = [
      null,
      undefined,
      {},
      { name: 'Test' },
      { automation: null },
      { automation: undefined },
      { automation: {} },
      makeFeature({ type: 'nonexistent_type' }),
      makeFeature([]),
      makeFeature([{ type: 'nonexistent' }, { type: 'also_nonexistent' }]),
    ]
    for (const feature of unbuildable) {
      expect(getAutomationInfo(feature, ps), `feature: ${JSON.stringify(feature)}`).toBeNull()
    }
  })
})

// ── delegation: the facade routes through buildAttackInfo, unchanged ───────

describe('getAutomationInfo – builder delegation', () => {
  it('re-exports buildAttackInfo as the very same builder function (not a wrapper)', () => {
    expect(buildAttackInfoViaService).toBe(buildAttackInfo)
  })

  it('delegates a single automation to buildAttackInfo and passes its envelope through unchanged', () => {
    const feature = makeFeature({ type: 'attack_rider', effect: 'riposte', damageType: 'slashing' }, 'Riposte Rider')
    const info = getAutomationInfo(feature, ps)
    // Envelope bytes are pinned upstream (attack.test.js); here pin transparency:
    // whatever the builder produces for this exact feature flows out untouched.
    expect(info).toEqual(buildAttackInfo(feature, ps))
    // Wiring bytes: the routed type and the feature identity reached the builder.
    expect(info.type).toBe('attack_rider')
    expect(info.name).toBe('Riposte Rider')
    expect(info.hasAutomation).toBe(true)
  })
})

// ── array scan: first truthy half wins, unbuildable halves skipped ─────────

describe('getAutomationInfo – array automation scan', () => {
  it('returns the first truthy half envelope and skips unbuildable halves', () => {
    const name = 'Multi Half Feature'
    const rider = { type: 'attack_rider', effect: 'riposte' }

    // Both halves buildable → the FIRST wins (proves order, not last-wins).
    const first = getAutomationInfo(makeFeature([rider, { type: 'auto_effect' }], name), ps)
    expect(first.type).toBe('attack_rider')
    expect(first).toEqual(buildAttackInfo(makeFeature(rider, name), ps))

    // Leading unbuildable half is skipped; the winner's envelope carries the
    // feature's name (proves the { ...feature, automation: auto } merge).
    const skipped = getAutomationInfo(makeFeature([{ type: 'nonexistent' }, { type: 'auto_effect' }], name), ps)
    expect(skipped.type).toBe('auto_effect')
    expect(skipped.name).toBe(name)
  })
})
