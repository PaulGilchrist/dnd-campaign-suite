// @maintained-by-ai
// Lane: composition contract of buildAttackRollDamageSteps() ONLY (#1030/#1034).
// Golden-shape census (#985/#1012) + wiring bytes (#744/#786). Zero mocks (#937):
// the builders are pure factories — nothing is consulted or executed at build time,
// so the module graph is imported bare and NO step body (condition/handler) runs here.
//
// Structure tests must NOT execute step bodies. Behavior-lanes ownership table:
//   rider application .............. #1022/#1024/#1026 (attackRollRiders.test.js,
//                                    useAttackDamageResolution.maneuvers.test.js, attackRiderHandler.test.js)
//   guards/barriers fold ........... #1029 (housekeeping bodies: pendingSuddenStrike,
//                                    Hunter's Prey marks, barrier blocks)
//   roll/crit ...................... #1032 (attackRollDamageSteps-damageRolling.test.js)
//   damage folding ................. #1027/#1028
//   automation/weapon-hit bonuses .. attackRollDamageSteps-automationBonuses/-weaponHitBonuses.test.js
//   n20-celestial conditions ....... #1035 (attackRollDamageSteps-natural20-celestial.test.js)
//   dmg_type:modified→damage:ready→damage:applied + poison CANON .. #1033
//                                    (attackRollDamageSteps-endgame.test.js owns idx 17/18 bodies;
//                                    the wiring bytes for idx 16-18 are pinned here)
//   mastery steps .................. #1031/#1036/#1037 (-cleaveMastery/-tacticalMaster/-toppleMastery.test.js)
//   option-positives ............... #1038
//
// old→new map: 'returns an array'/'has 24 steps'/'names in order' (PRESERVED :170-196 → now :34-61)
//   + 'subscribe/emit chain' + 'masteryDone cleave:check chain' (PRESERVED :228-247 → now :34-61, tail :55-60)
//   → single golden wiring table below (now also covering idx 19 stalkersFlurryPostDamage,
//   which the old chain test never asserted). Housekeeping/rider/cunningStrike body
//   describe blocks → removed, owned by the behavior lanes above (see #1029 fold).
// The factory takes zero arguments — there is no degenerate-input surface to probe.

import { describe, it, expect } from 'vitest';
import { buildAttackRollDamageSteps } from './attackRollDamageSteps.js';

// Exact ordered census: [name, subscribe, emit] for every step. Verbatim bytes pin
// count, identity, order, and event wiring — any insert/remove/rename/reorder fails.
const GOLDEN_STEPS = [
  ['housekeeping', 'housekeeping:do', 'maneuvers:check'],
  ['attackRiderManeuvers', 'maneuvers:check', 'maneuvers:handled'],
  ['cunningStrike', 'maneuvers:handled', 'cunning:checked'],
  ['charger', 'cunning:checked', 'charger:checked'],
  ['bardicInspirationOffense', 'charger:checked', 'bi:checked'],
  ['rollBaseDamage', 'bi:checked', 'damage:rolled'],
  ['buildContext', 'damage:rolled', 'context:built'],
  ['sneakAttack', 'context:built', 'sneak:applied'],
  ['twoWeaponFighting', 'sneak:applied', 'twf:applied'],
  ['targetEffects', 'twf:applied', 'effects:applied'],
  ['superiorityDieBonuses', 'effects:applied', 'superiority:applied'],
  ['automationBonuses', 'superiority:applied', 'automation:applied'],
  ['weaponHitBonuses', 'automation:applied', 'weapon_hit:applied'],
  ['natural20Bonuses', 'weapon_hit:applied', 'n20:applied'],
  ['celestialRevelation', 'n20:applied', 'celestial:applied'],
  ['featureRiders', 'celestial:applied', 'riders:applied'],
  ['damageTypeModifiers', 'riders:applied', 'dmg_type:modified'],
  ['overchannel', 'dmg_type:modified', 'damage:ready'],
  ['proceedToDamage', 'damage:ready', 'damage:applied'],
  ['stalkersFlurryPostDamage', 'damage:applied', 'cleave:check'],
  // Mastery tail: 'cleave:check' has ONE live subscriber in the single-path runner
  // (idx 20 chooser — idx 23 previously rode 'cleave:check' too but was unreachable:
  // steps.find never returns it after the chooser consumes the event). masteryDone now
  // rides topple's 'mastery:done' so pipeline:complete fires strictly after mastery.
  ['cleaveMastery', 'cleave:check', 'cleave:done'],
  ['tacticalMaster', 'cleave:done', 'tactical:done'],
  ['toppleMastery', 'tactical:done', 'mastery:done'],
  ['masteryDone', 'mastery:done', 'pipeline:complete'],
];

describe('buildAttackRollDamageSteps — composition contract', () => {
  const steps = buildAttackRollDamageSteps();

  it('composes exactly 24 steps with exact names, subscribe/emit bytes, in order (golden census)', () => {
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
