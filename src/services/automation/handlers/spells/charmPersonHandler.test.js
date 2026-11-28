// @maintained-by-ai 2026-11-27
// # charmPersonHandler — Charm Person (WIS save-or-suck charm, concentration). #1883
// Production module is a 12-line DELEGATION shell: handle() → handleCharmSpell(action, playerStats,
// campaignName, config) in charmSpellUtils.js. This lane pins DELEGATION only — the charmPerson
// config table (strict, full-object: exact strings AND the PRESENCE of saveConditions:['charmed']),
// positional passthrough by identity, and return/failure transparency.
//
// Pair + canonical-home split (recorded 2026-10-16, re-verified against source bytes 2026-11-27):
// - charmMonsterHandler (#1883 pair, swept immediately prior) routes through the SAME
//   charmSpellUtils with its own config; the ONLY pair diffs are
//   targetsKey/advantagesKey/rollType/refusal-text/logPrefix plus charmPerson's
//   saveConditions:['charmed'] (Beguiling Twist, charmPersonHandler.js:9) — charmMonster does NOT
//   pass it. This strict table pins that PRESENCE byte-exact; charmMonster's table pins the
//   ABSENCE. Both tables are strict full-object: any key drift in either direction fails, which
//   is the point of the pair.
// - Humanoid-target gate: re-verified — NONE in the shell or charmSpellUtils (no config key, zero
//   'humanoid'/'level' bytes in utils). The gate lives UPSTREAM in charmPersonService.js
//   (isTargetHumanoid :11, logNonHumanoidRejection :56, applied :77-83) on the sheet-chooser lane.
//   Pinning one here would be invented spec; if a gate ever moves into the shell it lands in this
//   config table first.
// - charmSpellUtils internals belong to their own lanes: aura-immunity suppression leg +
//   legacy-charmed-write control → charmSpellUtils.aura-immunity.test.js (#1884, drives THIS shell
//   live via handle() with real utils — its :10 "only pair file that does" claim re-verified: the
//   #1883 pair files mock handleCharmSpell, #1885 calls handleCharmSpell directly); CLA-219
//   rollNpcSave 2d20 keep-low + Magical Ambush fold → charmSpellUtils.metamagic-disadvantage.test.js
//   (#1885, hand-writes a charmMonster-shaped config and calls handleCharmSpell directly — it
//   bypasses both shells and never carries saveConditions, so the strict table here is the ONLY
//   pin of charmPerson's config keys). Pipeline outputs (activeConditions/meta writes,
//   addExpiration latch, ability_use/save_result/condition logs, popup summaries) are NOT
//   re-pinned here — the old 21-test suite re-ran those utils internals and has been shed.
// - Charm-immunity seams live downstream, untouched by this shell: Aura of Devotion suppression in
//   charmSpellUtils (#1884); PFEG ward block in saveProcessing.js
//   (saveProcessing.pfeg-charm-immunity.test.js — green per-condition ward-filter lane, do not touch).
// - Freed-on-damage lives in applyDamage.js ('removed Charmed — took damage'), concentration latch
//   rides addExpiration inside the utils. No clock in this handler — turn-based, per no-timers policy.
//
// Caller liveness (grep-verified 2026-11-27): sheet chooser useSimpleSpellHandlers.js:361 /
// useComplexSpellHandlers.js:176 → charmPersonService.triggerCharmPerson
// (src/services/rules/features/charmPersonService.js:166, rebuilds action with automation.type
// 'charm_person') → executeHandler (automation/index.js:702) → dynamic dispatch index.js:546
// charm_person → handleCharmPerson (imported index.js:217) — this handle(). Feature-builder lane:
// combat/automation/automationInfoBuilder/save.js:129 builds the charm_person action;
// combat/automation/automationRouter.js:188 lists charm_person in the save-style pass-through.
// Registration is the live production lane; no index-level routing test exists, so the config
// table here is the unique pin that the REAL handler hands the utils the charmPerson keys.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./charmSpellUtils.js', () => ({
  // Bare spy only: the base return value is re-baselined in beforeEach below (a factory-embedded
  // resolve value would be dead bytes — no test ever observes it). handleCharmSpell is the shell's
  // sole import from this module (charmPersonHandler.js:1), so the factory carries no orphans.
  handleCharmSpell: vi.fn(),
}));

import { handle } from './charmPersonHandler.js';
import { handleCharmSpell } from './charmSpellUtils.js';

const campaignName = 'test-campaign';

// Shared charmPerson config table — must mirror charmPersonHandler.js verbatim (strict match:
// extra or missing keys on either side fail, which is the point of the pin). saveConditions is
// the charmPerson-only pair key (Beguiling Twist); charmMonster's table pins its absence.
const CHARM_PERSON_CONFIG = {
  targetsKey: 'charmPersonTargets',
  advantagesKey: 'charmPersonAdvantages',
  rollType: 'save-charm-person',
  noTargetDescription: 'No target selected. Charm Person has no effect.',
  saveConditions: ['charmed'],
  logPrefix: '[charmPerson] Error:',
};

// The shell treats playerStats as an OPAQUE identity (it forwards the reference untouched and
// reads nothing from it — DC building/ability reads live in charmSpellUtils lanes). Keep the
// fixture minimal so it cannot imply the shell inspects rules fields.
function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

// Merges overrides (lane convention: makeAction-style helpers merge unless documented otherwise).
// automation/metaCtx are likewise opaque to the shell; they document the real transport shape
// (charmPersonService rebuilds both) so the identity pins exercise realistic bytes.
function makeAction(overrides = {}) {
  return {
    name: 'Charm Person',
    ...overrides,
    automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15, ...overrides.automation },
  };
}

describe('charmPersonHandler delegation to charmSpellUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleCharmSpell.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Charm Person', description: 'ok' } });
  });

  it('delegates with the exact charmPerson config table and identity passthrough of action/playerStats/campaignName', async () => {
    const playerStats = makePlayerStats();
    // metaCtx carries the charmPerson transport keys + CLA-219 flag — the shell must pass the
    // action through untouched (identity), never pre-read or rebuild it.
    const action = makeAction({
      metaCtx: { charmPersonTargets: ['Goblin', 'Orc'], charmPersonAdvantages: { Goblin: true }, metamagicHeighten: true },
    });

    await handle(action, playerStats, campaignName, 'some-map');

    expect(handleCharmSpell).toHaveBeenCalledTimes(1);
    // Strict full-object config match: pins rollType/noTargetDescription/logPrefix strings, the
    // charmPerson key names, and the PRESENCE of saveConditions:['charmed'] (Beguiling Twist —
    // pair diff vs charmMonster's absence pin, #1883).
    expect(handleCharmSpell).toHaveBeenCalledWith(action, playerStats, campaignName, CHARM_PERSON_CONFIG);
    // Positional sanity: same references, and _mapName is consumed but never forwarded
    // (handleCharmSpell signature is (action, playerStats, campaignName, config)).
    const call = handleCharmSpell.mock.calls[0];
    expect(call[0]).toBe(action);
    expect(call[1]).toBe(playerStats);
    expect(call[2]).toBe(campaignName);
    expect(call.length).toBe(4);
  });

  it('returns the utils popup untouched (identity transparency)', async () => {
    const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Charm Person', description: '1 creature(s) charmed: Goblin. 0 creature(s) saved: .' } };
    handleCharmSpell.mockResolvedValueOnce(sentinel);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toBe(sentinel);
  });

  it('propagates utils rejection to the caller (catch-popup fallback lives in charmPersonService, not this shell)', async () => {
    handleCharmSpell.mockRejectedValueOnce(new Error('utils boom'));

    await expect(handle(makeAction(), makePlayerStats(), campaignName, null)).rejects.toThrow('utils boom');
  });
});
