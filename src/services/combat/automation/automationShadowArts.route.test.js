// @maintained-by-ai
// CLA-308 Shadow Arts ROUTE lane — dispatch selection ONLY: automation.type
// 'shadow_arts' → facade buildAttackInfo (misc.js re-aggregates core-handlers.js)
// → routeAutomation pushes the builder's info row into passives exactly once and
// NOWHERE ELSE (single full-bucket toEqual catches the ROUTES fallback, a
// double-push, and a lost row in one assertion — #936/#937; routed-once +
// object identity #786/#744). The row is asserted by type + identity, not by
// re-pinning envelope fields.
//
// Shadow-arts family map (owners cited; NOT re-pinned here):
// • Builder envelope VALUES — automationInfoBuilder/core-handlers.test.js
//   CUSTOM row :723-748 (discriminating overrides + poison-proof hardcoded
//   type/effect, #2098/#2099) and the empty-automation defaults row :1167-1179.
//   freeCastSpells/usesMax/recharge/saveAbility forwarding lives THERE.
// • buildAttackInfo null/unknown-type contract — automationInfoBuilder.test.js
//   (facade lane); router unknown-type → specialActions fallback —
//   automationCollector.types.test.js (router breadth matrix home).
// • Effect behavior — spellCalc2024-shadow-arts.test.js (grants stamp, ki/
//   resource owner lane), spellPreparationService.shadowArts.test.js (per-spell
//   gating + counter consumption), restRules-longRest.shadowArts.test.js (re-arm
//   policy). This file only supplies the passives row those consumers read.
// Turn-based domain: no wall-clock, no timers, no mocks, zero network.
//
// old→new map: old test 1 (builder fields via buildAttackInfo) REMOVED —
// strictly weaker duplicate of core-handlers.test.js discriminating rows.
// Old test 2 (some() + 3 zero buckets) CONSOLIDATED into the single
// full-bucket assertion below (was partial-zero: reactions/autoEffects/
// saveModifiers/primalKnowledge/ritualSpells were unpinned).
import { describe, it, expect } from 'vitest';
import { buildAttackInfo } from './automationInfoBuilder.js';
import { routeAutomation } from './automationRouter.js';

// Verbatim public/data/2024/classes.json Monk → Warrior of Shadow lv3
// 'Shadow Arts' (same disk anchor core-handlers.test.js cites).
const FEATURE = {
  name: 'Shadow Arts',
  description: 'You can cast the Darkness, Darkvision, Pass Without Trace, and Silence spells without expending spell slots or preparing them, using Wisdom as your spellcasting ability. Each of these spells can be cast in this way once per Long Rest.',
  level: 3,
  automation: {
    type: 'shadow_arts',
    casting_time: 'passive',
    freeCastSpells: ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence'],
    usesMax: 1,
    recharge: 'long_rest',
    saveAbility: 'WIS',
  },
};

const ROUTED_BUCKETS = ['actions', 'bonusActions', 'reactions', 'specialActions', 'passives', 'autoEffects', 'saveModifiers', 'primalKnowledge', 'ritualSpells'];

describe('CLA-308 shadow_arts route lane', () => {
  it('routes shadow_arts to passives exactly once — the built row itself, nowhere else', () => {
    const info = buildAttackInfo(FEATURE, { name: 'Disciplined_Monk' });
    // Dispatch selection: the shadow_arts handler answered (not a facade null
    // and not another handler's envelope). Envelope VALUES are pinned by
    // core-handlers.test.js — deliberately not re-pinned here.
    expect(info.type).toBe('shadow_arts');

    const result = Object.fromEntries(ROUTED_BUCKETS.map(b => [b, []]));
    routeAutomation(info, FEATURE.automation, result);

    expect(Object.fromEntries(ROUTED_BUCKETS.map(b => [b, result[b].map(r => r.type)])))
      .toEqual({ ...Object.fromEntries(ROUTED_BUCKETS.map(b => [b, []])), passives: ['shadow_arts'] });
    // The routed row is the very info object the collector's consumers read.
    expect(result.passives[0]).toBe(info);
  });
});
