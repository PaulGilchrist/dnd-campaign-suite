// @maintained-by-ai
// MA-1927: Jormungandr legendary "Venom Drip" hit-clause rider — live-verified
// FAIL(b)/DATA: +17 ranged chip self-resolved exact (nat 18+17=35 vs AC12 HIT,
// "4d8 + 1" Poison, hp_change −21 unclamped) but the Poisoned rider NEVER
// granted — the row authored `conditions:["poisoned"]`, which NO attack-path
// consumer reads (buildHitConditionClause consumes ONLY structured
// action.hit_conditions, MonsterCardHelpers; applied in handlePlainDamage;
// §153/§399, MA-0291/0361 Brown Bear Claw family — fourth instance).
// One-field DATA fix: rename conditions → hit_conditions (MA-0621/MA-0763
// trailing-key byte-shape, Apep Venomous Sting MA-1846 twin). Plain
// `conditions` stays GONE — no duplicate-state keys, no consumer reads it.
// REAL on-disk row pinned programmatic disk-bytes (#1086-#1088 class),
// verbatim description ground truth (#993).
//
// Framework-owned (cited, not re-run here):
//  - buildHitConditionClause guard truth tables (hit-choice suppression via
//    hitChoiceArmed, rider payload assembly) → MonsterCardHelpers.hit-choice.test.js;
//    extractor word-scan owner → MonsterCardModal.conditions-extraction.test.jsx
//    (#1093 king-kong exemplar shape) — only the REAL Venom Drip row mapped
//    THROUGH the extractor is pinned here (hit-axis: null-on-decoys reaches
//    the clause-less guard branch, #1035);
//  - clause consumer / Poisoned application on hit → handlePlainDamage.hitClause
//    .test.js (engine family CLOSED #995-#1001, compute canon #1000 — cited,
//    never re-driven); te registry registration LOW VALUE #1012, producers #993;
//  - Jormungandr save-axis siblings: Capsize save core →
//    monsterLegendarySave.ma1928; Venomous Surge recharge gate →
//    monsterRecharge.ma1924. This ticket is HIT-axis ONLY: save fields on the
//    Venom Drip row stay absent (#1093 axis-split — save canaries never
//    absorbed here);
//  - family: no base/framework owner in services/encounters — each
//    monsterHitConditions ticket locks its own row (MA-1939 Ladon twin stands
//    alone; this file never re-runs Ladon bytes).
//
// old→new: old 4 tests → 2. Old "row identity + numerics" + "hit_conditions
// authored / conditions GONE" + "extractor arms rider" → test 1 single real-row
// lock (adds verbatim description byte + delegates_to/save-axis absence
// canaries). Old "siblings byte-inert" → test 2 decoy narrowed to the
// closest-confusion rows Bite/Capsize (#948), brittle-index replaced with
// name-lookup (#1094); header-row pin dropped (zero-confusion trivial null).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { buildHitConditionClause } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JORMUNGANDR = monsters.find((m) => m.index === 'jormungandr');
const DRIP = JORMUNGANDR.legendary_actions.find((a) => a.name === 'Venom Drip');

describe('MA-1927 disk fingerprint: Jormungandr Venom Drip hit_conditions authored', () => {
  it('real-row lock: numerics byte-unchanged + hit-axis fix armed — hit_conditions ["poisoned"] verbatim, conditions GONE, save axis stays absent', () => {
    expect(JORMUNGANDR.name).toBe('Jormungandr');
    expect(DRIP.name).toBe('Venom Drip');
    expect(DRIP.description).toBe(
      'Ranged Attack Roll: +17, range 60 ft., one target. Hit: 18 (4d8+1) Poison damage and the target has the Poisoned condition until the end of its next turn.'
    );
    expect(DRIP.attack_bonus).toBe(17);
    expect(DRIP.range).toBe('60 ft.');
    expect(DRIP.damage_dice_primary).toBe('4d8 + 1');
    expect(DRIP.damage_type_primary).toBe('Poison');
    // the ticket's one-field DATA fix: renamed (not duplicated) to the ONLY
    // key the attack path reads — plain `conditions` stays GONE.
    expect(DRIP.hit_conditions).toEqual(['poisoned']);
    expect(DRIP.conditions).toBeUndefined();
    // hit-axis ONLY (#1093 axis-split): no save half, no delegate — Capsize
    // owns the save lane (ma1928), Bite owns the delegate shape.
    expect(DRIP.save_dc).toBeUndefined();
    expect(DRIP.save_type).toBeUndefined();
    expect(DRIP.save_effect).toBeUndefined();
    expect(DRIP.dc_success).toBeUndefined();
    expect(DRIP.delegates_to).toBeUndefined();
    // production extractor arms the Poisoned rider on the REAL row (clause
    // consumed by handlePlainDamage on HIT; consumer truth-table cited above).
    expect(buildHitConditionClause(DRIP)).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Venom Drip',
      targetEffect: null,
    });
  });

  it('decoy: Jormungandr closest-confusion legendary rows stay hit-axis inert — only Venom Drip arms a hit grant', () => {
    // Bite (delegate) and Capsize (save-axis, ma1928) share the legendary
    // list with Venom Drip: neither carries hit_conditions nor builds a
    // hit clause — the clause-less guard branch (#1035) stays live for them.
    const bite = JORMUNGANDR.legendary_actions.find((a) => a.name === 'Bite');
    const capsize = JORMUNGANDR.legendary_actions.find((a) => a.name.startsWith('Capsize'));
    expect(bite.delegates_to).toBeDefined();
    expect(bite.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(bite)).toBeNull();
    expect(capsize.save_dc).toBe(25); // its own save core, owned by ma1928
    expect(capsize.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(capsize)).toBeNull();
  });
});
