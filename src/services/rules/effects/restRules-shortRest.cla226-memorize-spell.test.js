// @maintained-by-ai
// CLA-226: Memorize Spell once-per-Short-Rest latch re-arm seam (restRules-shortRest.js).
// Mechanism: generic null-latch (not a gated-special). Disk canon (2024 classes.json
// Wizard lv5): "Whenever you finish a Short Rest ... replace one ... prepared ... spell
// ... with another ... from the book." The swap side — stamping
// { preparedSpells: newPrepared, memorizeSpellUsedSinceRest: true } — is owned by
// ShortRestModal.coverage.test.jsx and is not re-run here. This lane pins the
// REST side only: SHORT_REST_NULL_FLAG_KEYS nulls the latch UNGATED in applyShortRest's
// single atomic 3-arg setRuntimeBatch (identical bytes on the modal lane,
// skipAutoRecovery:true, and the plain lane), and LONG_REST_RESOURCES covers the long
// rest — so the feature re-arms only when a rest actually finishes. The batch must NOT
// carry preparedSpells: a short rest rolls the latch back, never the swapped list.
// Generic short-rest batch faces live in restRules-shortRest.test.js; prepared-list
// mechanics in spellPreparationService lanes — cited, not duplicated.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyShortRest } from './restRules.js'
import { LONG_REST_RESOURCES } from './restRules-constants.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}))

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}))

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}))

vi.mock('../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'
const WIZARD = 'DivinationWizard'

function makeWizard(overrides = {}) {
  return {
    name: WIZARD,
    hitPoints: 157,
    level: 20,
    proficiency: 6,
    rules: '2024',
    class: { name: 'Wizard', hit_point_die: 'd6', major: { name: 'Guild Artisan' } },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    automation: { specialActions: [{ type: 'memorize_spell', casting_time: 'passive' }] },
    ...overrides,
  }
}

describe('CLA-226 applyShortRest — Memorize Spell latch re-arm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
  })

  it('disk canon: Wizard lv5 Memorize Spell drives the latch, and the long rest re-arms it too', () => {
    const classes = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'))
    const wizard = classes.find(c => c.name === 'Wizard')
    const feature = (wizard?.class_levels || [])
      .flatMap(lv => lv.features || [])
      .find(f => f?.automation?.type === 'memorize_spell')

    expect(feature?.name).toBe('Memorize Spell')
    expect(feature?.level).toBe(5)
    expect(feature?.description).toMatch(/finish a Short Rest/i)
    expect(feature?.description).toMatch(/prepared/i)

    // LR superset (CLA-130 rule: a latch missing from every reset list dies
    // permanently). The SR re-arm is the SHORT_REST_NULL_FLAG_KEYS batch lane
    // pinned below — the same null byte must also ride applyLongRest here.
    expect(LONG_REST_RESOURCES).toContain('memorizeSpellUsedSinceRest')
  })

  it.each([
    ['modal lane (skipAutoRecovery:true)', { skipAutoRecovery: true }],
    ['plain lane', undefined],
  ])('re-arm is ungated: %s nulls the latch in the ONE atomic batch without touching the swapped list', async (_desc, options) => {
    await applyShortRest(makeWizard(), CAMPAIGN, options)

    // One atomic write carrying both the HP update and the latch null —
    // re-posting via a second batch would SSE-echo against itself.
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
    expect(setRuntimeBatch).toHaveBeenCalledWith(
      WIZARD,
      expect.objectContaining({ currentHitPoints: 157, memorizeSpellUsedSinceRest: null }),
      CAMPAIGN,
    )
    // Branch bait: the rest rolls back the latch, NEVER the prepared list the
    // swap wrote — adding preparedSpells to the null-flag lane would silently
    // undo every Memorize Spell swap.
    expect(vi.mocked(setRuntimeBatch).mock.calls[0][1]).not.toHaveProperty('preparedSpells')
  })
})
