// @maintained-by-ai
// Lane: composition contract of buildDirectSpellDamageSteps() ONLY — structural owner
// of this pipeline (#1039 VERBATIM-template twin, attackRollDamageSteps.test.js).
// Golden-shape census + wiring bytes. Zero mocks (#937): the factory is a pure
// factory — it consults no callee and executes no step body (inert #744/#786) at
// build time, so the module graph is imported bare and NO condition/handler runs here.
//
// directSpellDamageSteps family idx/ownership table (post #1042–#1047 CLOSED state):
//   idx 0 spellHousekeeping      trivial passthrough literals; wiring + contract shape pinned
//                                 here (no dedicated body lane exists — honest note, see below)
//   idx 1 spellContext           cla120 #1042 (pre-baked [EE] dedupe guard),
//                                 context #1043 (condition gate, EE/BS/EA fold arms),
//                                 radiantSoul #1045 (CLA-279 [Radiant Soul] dedupe)
//   idx 2 spellRollDamage        rolling #1047 (roll CANON bytes: normal/crit/maximize/
//                                 null dispatch, no-extra-leak), radiantSoul #1045 (idx-2
//                                 stamp/latch, latch reset owned there too)
//   idx 3 spellFeatureRiders     riders #1046 (featureModules dispatch contract,
//                                 seed bytes, modal abort)
//   idx 4 spellOverchannel       overchannel #1044 (self-damage d12 roll + log bytes)
//   idx 5 spellProceedToDamage   overchannel #1044 (proceedWithDamage handoff payload)
//
// old→new map:
//   'returns an array of 6 steps' (:83-86) + 'has steps with correct names in order'
//   (:88-98) + 'has correct subscribe/emit chain' (:100-113)
//     → single golden wiring table (now :40-47) — count, identity, order, and event
//     bytes in one exact toEqual; any insert/remove/rename/reorder fails. This is the
//     ONLY lane where pinning order is legal; siblings cite it, never repeat it.
//   'spellHousekeeping step' block (:116-127: 'always returns true' / 'returns
//   { data: {} }') → REMOVED — executing step bodies is illegal in this lane
//   (inert #744/#786). Honest record: no sibling owns the idx-0 body, but it is a
//   `() => true` / `async () => ({ data: {} })` literal whose wiring and key shape
//   are pinned by the two tests below; a body lane would test a no-op.
//   5 vi.mock blocks (:4-67) + beforeEach re-arming (:74-80) → DELETED — nothing is
//   consulted at build time (mocked-zero #937); no spies remain, so no
//   afterEach(vi.restoreAllMocks) is needed (#1007).
// The factory takes zero arguments — there is no degenerate-input surface to probe (#945).

import { describe, it, expect } from 'vitest';
import { buildDirectSpellDamageSteps } from './directSpellDamageSteps.js';

// Exact ordered census: [name, subscribe, emit] for every step. Verbatim bytes pin
// count, identity, order, and event wiring — any insert/remove/rename/reorder fails.
const GOLDEN_STEPS = [
  ['spellHousekeeping', 'spell:do', 'spell:context'],
  ['spellContext', 'spell:context', 'spell:formulas'],
  ['spellRollDamage', 'spell:formulas', 'spell:rolled'],
  ['spellFeatureRiders', 'spell:rolled', 'spell:riders:applied'],
  ['spellOverchannel', 'spell:riders:applied', 'spell:ready'],
  ['spellProceedToDamage', 'spell:ready', 'spell:applied'],
];

describe('buildDirectSpellDamageSteps — composition contract', () => {
  const steps = buildDirectSpellDamageSteps();

  it('composes exactly 6 steps with exact names, subscribe/emit bytes, in order (golden census)', () => {
    expect(steps.map(({ name, subscribe, emit }) => [name, subscribe, emit])).toEqual(GOLDEN_STEPS);
  });

  it('every entry satisfies the pipeline step contract — assembled inertly, no bodies executed', () => {
    for (const step of steps) {
      expect(Object.keys(step).sort()).toEqual(['condition', 'emit', 'handler', 'name', 'subscribe']);
      expect(typeof step.condition).toBe('function');
      expect(typeof step.handler).toBe('function');
    }
  });
});
