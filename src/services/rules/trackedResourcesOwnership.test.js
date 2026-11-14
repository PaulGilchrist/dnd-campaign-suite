// @maintained-by-ai
// OWNERSHIP-CLASSIFICATION lane for src/services/rules/trackedResources.js
// (improve tracked-resource-ghost-keys, 2026-11-14 pass — completes the
// 03e419d35 Pool gate). Three acceptance faces:
//   (a) STATICALLY_OWNABLE keys are ABSENT for non-owners — the census runs
//       against the REAL test-campaign fixtures (EvasiveFighter: 2024 L18
//       Battle Master Fighter, the 51-key live-ghost witness; ElderPaladin:
//       2024 L20 Oath of Vengeance owner leg riding layOnHandsPool: 100).
//   (b) case-insensitive duplicate collapse — neither a computed bucket nor
//       the registry may carry two casings of the same latch idiom
//       (the retired `actionSurgeUses`+`actionsurgeUses` /
//       `secondWindUses`+`secondwindUses` pairs); camelCase is canonical.
//   (c) handler-owned load-bearing latches (CLA-130 safety nets such as
//       tranceOfOrderUses / warriorofthegodsPool) stay UNSEEDED but keep
//       their unconditional Long-Rest null fan-out — registry-consistency
//       pinned here; the fan byte itself is pinned in
//       effects/restRules-longRest.test.js.
// Real getClassFeatures (NOT mocked): these are full-disk census legs.
// No timers, no campaign writes — fixture JSONs are read-only imports.
import { describe, it, expect } from 'vitest';

import evasiveFighter from '../../../public/campaigns/test-campaign/EvasiveFighter.json';
import elderPaladin from '../../../public/campaigns/test-campaign/ElderPaladin.json';
import classes2024 from '../../../public/data/2024/classes.json';

import {
  ALL_TRACKED_RESOURCES,
  GATED_TRACKED_KEYS,
  HANDLER_OWNED_LATCH_KEYS,
  computeTrackedResources,
} from './trackedResources.js';
import { LONG_REST_RESOURCES } from './effects/restRules-constants.js';

// Case-insensitive duplicate detector: two keys that lowercase to the same
// idiom in different original spellings = a ghost pair (criteria 1).
function casingDupPairs(keys) {
  const seen = new Map();
  const dupes = [];
  for (const key of keys) {
    const low = key.toLowerCase();
    if (seen.has(low) && seen.get(low) !== key) dupes.push([seen.get(low), key]);
    else seen.set(low, key);
  }
  return dupes;
}

// The universal core lane — seeded for EVERY character by design
// (trackedResources.js classification block, class (1)).
const UNIVERSAL_KEYS = [
  'currentHitPoints', 'hitPoints', 'shortRestHitDice',
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => `spell_slots_level_${l}`),
];

// Character JSON carries no class_levels (sheet load merges them from the
// disk ladder) — mirror the sheet-load shape for the Fighter census.
const fighterDisk = classes2024.find((c) => c.name === 'Fighter');
const fighterStats = {
  ...evasiveFighter,
  class: { ...evasiveFighter.class, class_levels: fighterDisk.class_levels },
};
const fighterBucket = computeTrackedResources(fighterStats);
const paladinBucket = computeTrackedResources(elderPaladin);

describe('(a) statically-ownable keys: non-owner buckets carry ZERO of them', () => {
  // The live HZ census: EvasiveFighter (Fighter — not sorcerer/barbarian/
  // monk/paladin/warlock/druid/ranger) carried 51 keys including
  // `sorceryPoints: 0`, `ragePoints: 0`, `kiPoints` and ~45 `*Uses: 0`
  // ghosts. After the owned-only pass the recomputed bucket holds ONLY the
  // universal lane plus what a Battle Master genuinely owns.
  it('EvasiveFighter: the named foreign keys are ABSENT (key absent, not 0-seeded)', () => {
    for (const key of [
      'sorceryPoints', 'innateSorceryUses',
      'ragePoints', 'focusPoints', 'kiPoints',
      'layOnHandsPool', 'preserveLifePool', 'healinglightPool',
      'gloriousDefenseUses', 'warPriestUses', 'divineInterventionUses',
      'channelDivinityCharges', 'bardicInspirationUses',
      'wildShapeUses', 'naturalRecoverySlots', 'moonlightStepUses', 'cosmicomenUses',
      '_Star_Map_freeCastCount', '_Steps_of_the_Fey_freeCastCount',
      'warlockPactMagic', 'darkOnesLuckUses',
      'luckyPoints', 'wholenessofbodyUses', 'featsOfChaosUses',
      'arcaneWardHp', 'arcaneWardMax', 'arcaneRecoveryLevels',
      'psionicEnergy', 'telekineticThrustUses', 'adrenalineRushUses',
      'naturesVeilUses', 'tirelessUses', 'favoredEnemyUses',
      'stonecunningUses', 'stonesEnduranceUses', 'stormsThunderUses',
      'uncannymetabolismUses', 'sorcerousRestorationUses',
      'mysticArcanumLevel6', 'mysticArcanumLevel7', 'mysticArcanumLevel8', 'mysticArcanumLevel9',
    ]) {
      expect(fighterBucket, `${key} must not exist on the non-owner Fighter`).not.toHaveProperty(key);
    }
  });

  it('EvasiveFighter: every key the bucket DOES carry is universal or fighter-owned', () => {
    const FIGHTER_OWNED = ['secondWindUses', 'actionSurgeUses', 'superiorityDice'];
    for (const key of Object.keys(fighterBucket)) {
      expect(
        UNIVERSAL_KEYS.includes(key) || FIGHTER_OWNED.includes(key),
        `unexpected non-owner ghost key ${key}`,
      ).toBe(true);
    }
    // The genuinely-owned fighter keys ride the 2024 L18 disk ladder
    // (second_wind 4, surges 2 at lv17, superiority_dice 6).
    expect(fighterBucket.secondWindUses).toEqual({ current: 4, max: 4 });
    expect(fighterBucket.actionSurgeUses).toEqual({ current: 2, max: 2 });
    expect(fighterBucket.superiorityDice).toEqual({ current: 6, max: 6 });
  });

  it('ElderPaladin owner leg: layOnHandsPool + paladin keys ride; foreign-class keys are ABSENT', () => {
    // Owner lane stays byte-identical (criteria 5): 5 × L20 = 100 pool.
    expect(paladinBucket.layOnHandsPool).toEqual({ current: 100, max: 100 });
    expect(paladinBucket).toHaveProperty('gloriousDefenseUses');
    for (const key of [
      'sorceryPoints', 'ragePoints', 'kiPoints', 'focusPoints',
      'healinglightPool', 'preserveLifePool', 'warlockPactMagic',
      'secondWindUses', 'actionSurgeUses', 'superiorityDice',
      'wildShapeUses', 'luckyPoints',
    ]) {
      expect(paladinBucket, `${key} must not exist on the non-owner paladin`).not.toHaveProperty(key);
    }
  });
});

describe('(b) case-insensitive duplicate collapse', () => {
  it('the registry carries no case-variant pair, and the retired twins are gone', () => {
    expect(casingDupPairs(ALL_TRACKED_RESOURCES)).toEqual([]);
    expect(ALL_TRACKED_RESOURCES).not.toContain('secondwindUses');
    expect(ALL_TRACKED_RESOURCES).not.toContain('actionsurgeUses');
  });

  it('computed buckets carry ONE canonical casing per latch idiom (owner AND non-owner legs)', () => {
    // The HZ proof face: EVERY bucket — including the paladin's — carried
    // BOTH casings of secondWind/actionSurge. Fresh recompute of the two
    // live-census characters yields zero case-duplicate pairs:
    expect(casingDupPairs(Object.keys(fighterBucket))).toEqual([]);
    expect(casingDupPairs(Object.keys(paladinBucket))).toEqual([]);
    // The survivor is the camelCase automation-id/UI casing:
    expect(fighterBucket).toHaveProperty('secondWindUses');
    expect(fighterBucket).toHaveProperty('actionSurgeUses');
    expect(fighterBucket).not.toHaveProperty('secondwindUses');
    expect(fighterBucket).not.toHaveProperty('actionsurgeUses');
  });
});

describe('(c) handler-owned load-bearing latches: retained fan-out, documented classification', () => {
  it('HANDLER_OWNED_LATCH_KEYS members are NEVER seeded (even with their grants present) — the null-as-available CLA-364 law', () => {
    const withGrants = computeTrackedResources({
      ...fighterStats,
      automation: {
        bonusActions: [{ type: 'trance_of_order' }],
        passives: [{ type: 'warrior_of_the_gods' }],
        reactions: [{ type: 'warping_implosion' }],
      },
    });
    // tranceOfOrderUses / warpingimplosionUses / warriorofthegodsPool etc.
    // must stay out of `_trackedResources` for EVERY character — owners
    // included — a grant-time 0-seed there is the CLA-364 BUG-A poisoning
    // pattern (the free once-per-Long-Rest use died behind a stuck 0).
    for (const key of ['tranceOfOrderUses', 'warpingimplosionUses', 'restorebalanceUses', 'warriorofthegodsPool']) {
      expect(withGrants, `${key} must never be seeded`).not.toHaveProperty(key);
      expect(ALL_TRACKED_RESOURCES, `${key} must stay out of the seed registry`).not.toContain(key);
    }
  });

  it('the classification registries are coherent: disjoint, and every retained latch stays long-rest-registered (CLA-130)', () => {
    // Disjoint: a key is either gated-owned-only OR handler-retained, never
    // both (gating a handler latch by `in _trackedResources` would retire
    // its ONLY re-arm — see the module classification block).
    for (const key of HANDLER_OWNED_LATCH_KEYS) {
      expect(GATED_TRACKED_KEYS, `${key} cannot be both gated and handler-owned`).not.toContain(key);
      expect(
        LONG_REST_RESOURCES,
        `${key} is handler-owned: its unconditional Long-Rest null fan-out is its only re-arm and must stay registered`,
      ).toContain(key);
    }
  });

  it('every GATED key is catalog-registered except the two documented computed-not-registered keys', () => {
    const KNOWN_REGISTRY_GAPS = ['darkOnesLuckUses', '_Star_Map_freeCastCount'];
    for (const key of GATED_TRACKED_KEYS) {
      expect(
        ALL_TRACKED_RESOURCES.includes(key) || KNOWN_REGISTRY_GAPS.includes(key),
        `${key} classified GATED but missing from ALL_TRACKED_RESOURCES`,
      ).toBe(true);
    }
  });

  it('the shipped pool trio stays inside the gated classification (03e419d35 parity)', () => {
    for (const key of ['layOnHandsPool', 'preserveLifePool', 'healinglightPool']) {
      expect(GATED_TRACKED_KEYS).toContain(key);
    }
  });
});
