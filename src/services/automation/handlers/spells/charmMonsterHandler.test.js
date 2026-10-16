// # charmMonsterHandler — Charm Monster (WIS save-or-suck charm, concentration, freed-on-damage).
// Production module is an 11-line DELEGATION shell: handle() → handleCharmSpell(action, playerStats,
// campaignName, config) in charmSpellUtils.js. This lane pins DELEGATION only — the charmMonster
// config table (strict, full-object: exact strings AND the absence of saveConditions), positional
// passthrough by identity, and return/failure transparency.
//
// Pair + canonical-home split (recorded 2026-10-16, verified at source):
// - charmPersonHandler (#1883, next in queue) routes through the SAME charmSpellUtils with its own
//   config; the ONLY pair diffs are targetsKey/advantagesKey/rollType/refusal-text/logPrefix plus
//   charmPerson's saveConditions:['charmed'] (Beguiling Twist) — charmMonster does NOT pass
//   saveConditions. The strict table below pins that absence byte-exact; adding it is a
//   source-change decision, not a test-loosen.
// - charmSpellUtils internals belong to their own lanes: aura-immunity suppression leg +
//   legacy-charmed-write control → charmSpellUtils.aura-immunity.test.js (#1884); CLA-219
//   rollNpcSave 2d20 keep-low + Magical Ambush fold → charmSpellUtils.metamagic-disadvantage.test.js
//   (#1885). Pipeline outputs (activeConditions/meta writes, addExpiration latch, ability_use/
//   save_result/condition logs, popup summaries) are NOT re-pinned here.
// - Charm-immunity seams live downstream, untouched by this shell: Aura of Devotion suppression in
//   charmSpellUtils (#1884); PFEG ward block in saveProcessing.js
//   (saveProcessing.pfeg-charm-immunity.test.js — it.fails FIXME lane, do not touch).
// - Freed-on-damage lives in applyDamage.js ('removed Charmed — took damage'), concentration latch
//   rides addExpiration inside the utils. No clock in this handler — turn-based, per no-timers policy.
//
// Caller liveness (grep-verified 2026-10-16): sheet chooser useSimpleSpellHandlers.js:337 /
// useComplexSpellHandlers.js:181 → charmMonsterService.triggerCharmMonster (rebuilds action with
// automation.type 'charm_monster') → executeHandler (automation/index.js:702) → dynamic dispatch
// index.js:547 charm_monster → this handle(). Registration is the live production lane; no
// index-level routing test exists, so the config table here is the unique pin that the REAL
// handler hands the utils the charmMonster keys (#1885 re-states its own hand-written config copy).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./charmSpellUtils.js', () => ({
  handleCharmSpell: vi.fn(() => Promise.resolve({ type: 'popup', payload: { type: 'automation_info', name: 'Charm Monster', description: '1 creature(s) charmed: Goblin. 0 creature(s) saved: .' } })),
}));

import { handle } from './charmMonsterHandler.js';
import { handleCharmSpell } from './charmSpellUtils.js';

const campaignName = 'test-campaign';

// Shared charmMonster config table — must mirror charmMonsterHandler.js verbatim (strict match:
// extra or missing keys on either side fail, which is the point of the pin).
const CHARM_MONSTER_CONFIG = {
  targetsKey: 'charmMonsterTargets',
  advantagesKey: 'charmMonsterAdvantages',
  rollType: 'save-charm-monster',
  noTargetDescription: 'No target selected. Charm Monster has no effect.',
  logPrefix: '[charmMonster] Error:',
};

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

// Merges overrides (lane convention: makeAction-style helpers merge unless documented otherwise).
function makeAction(overrides = {}) {
  return {
    name: 'Charm Monster',
    ...overrides,
    automation: { type: 'charm_monster', saveType: 'WIS', saveDc: 15, ...overrides.automation },
  };
}

describe('charmMonsterHandler delegation to charmSpellUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleCharmSpell.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Charm Monster', description: 'ok' } });
  });

  it('delegates with the exact charmMonster config table and identity passthrough of action/playerStats/campaignName', async () => {
    const playerStats = makePlayerStats();
    // metaCtx carries the charmMonster transport keys + CLA-219 flag — the shell must pass the
    // action through untouched (identity), never pre-read or rebuild it.
    const action = makeAction({
      metaCtx: { charmMonsterTargets: ['Goblin', 'Orc'], charmMonsterAdvantages: { Goblin: true }, metamagicHeighten: true },
    });

    await handle(action, playerStats, campaignName, 'some-map');

    expect(handleCharmSpell).toHaveBeenCalledTimes(1);
    // Strict full-object config match: pins rollType/noTargetDescription/logPrefix strings, the
    // charmMonster key names, and the ABSENCE of saveConditions (charmPerson pair diff, #1883).
    expect(handleCharmSpell).toHaveBeenCalledWith(action, playerStats, campaignName, CHARM_MONSTER_CONFIG);
    // Positional sanity: same references, and _mapName is consumed but never forwarded
    // (handleCharmSpell signature is (action, playerStats, campaignName, config)).
    const call = handleCharmSpell.mock.calls[0];
    expect(call[0]).toBe(action);
    expect(call[1]).toBe(playerStats);
    expect(call[2]).toBe(campaignName);
    expect(call.length).toBe(4);
  });

  it('returns the utils popup untouched (identity transparency)', async () => {
    const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Charm Monster', description: '1 creature(s) charmed: Goblin. 0 creature(s) saved: .' } };
    handleCharmSpell.mockResolvedValueOnce(sentinel);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toBe(sentinel);
  });

  it('propagates utils rejection to the caller (catch-popup fallback lives in charmMonsterService, not this shell)', async () => {
    handleCharmSpell.mockRejectedValueOnce(new Error('utils boom'));

    await expect(handle(makeAction(), makePlayerStats(), campaignName, null)).rejects.toThrow('utils boom');
  });
});
