// @maintained-by-ai
// MA-1981: Scylla "Snatch" legendary shipped a prose-only prerequisite ("One head
// lunges at a Grappled or Restrained creature") with NO structured
// target_prerequisite — parseTargetPrerequisite (MA-0019, Helpers:979) returned null
// and the live MA-0687 attack-lane gate passed EVERY target (repro 2026-10-12:
// ungated +16 fired on a zero-condition Bandit, ability_use spent 1/3, 4d10+8 = 38
// damage, zero refusal). DATA fix: target_prerequisite {conditions:
// ["grappled","restrained"]} — conditions-only, by_attacker OMITTED (#1086 BY-NAME
// rationale): the RAW row text names no grapple source ("a Grappled or Restrained
// creature"), Scylla authors no grapple/restrain producer (MA-1890 reach-quirk
// precedent), so by_attacker would make the row permanently unreachable in-app and
// wrongly refuse third-party restrains the RAW allows — source-agnostic twins:
// Stomp/Hooves/Apep Devour the Boat. MA-1931 codification satisfied (parse requires
// a NON-EMPTY conditions[]). Refusal is zero-spend zero-roll by construction: the
// lane gate runs BEFORE expendLegendaryUse (MonsterCardModal) and the helper below
// reads runtime only — read-census pinned in it2 (#1026).
//
// Owner cite table — scylla family map (Snatch = THIS lane; never re-drive here):
//  - Blood Tide save core + recharge:"5-6" numerics → monsterRecharge.ma1978 :72-108
//    OWNER (#1123); Shriek save core DC23/WIS/2d10 + Deafened save_effect rider →
//    monsterLegendaryUses.ma1982 :52-85 OWNER (#1113) — here: prerequisite ABSENCE-only.
//  - by_attacker:true provenance truth-table → MonsterCardModal.ma1275 Tentacle Slam
//    OWNER (+ Fenrir twin ma1890); ma1931/ma1890 cite THIS file as the source-agnostic
//    refuse/admit canonical — do not trim those legs.
//  - Legendary header uses + "Costs 2 Actions" cost parse → monsterLegendaryUses.test.js
//    / ma1579 header canon (#1082); canRollExpression truth-table → diceRoller.test.js
//    (#1072 — only the exact real dice byte pinned here).
//  - grapple/restrain producers + CANON save channels (#1005) → ma1931 Kong Grab
//    save-fail lane — cited, never re-driven here.
//  - modal chip-click press plumbing → ma0687/ma0689 attack-chip lanes; this lane is
//    the PURE helper with a store-faithful read-only rig (#1137/#1091/#949).
//
// Applied recs (#1113 + #1123 reaffirm), verified against owners live before cutting
// (#1038): old :66-70 key-order lock DROPPED (#1100 class — toEqual key-set suffices);
// old :136-139 Blood Tide re-lock TRIMMED to prerequisite-absence-only (#1123 owns the
// numerics @ma1978:74-80); old :125-127 Shriek save-core dupes TRIMMED to
// prerequisite-absence-only (#1113 owns the core @ma1982:59-63) — both absence legs now
// ride the ONE card-wide sweep in it1 (guards reach the null branch, #1035).
//
// dup-map / old→new (10→3): fingerprint + fix-bytes + parse → it1 real-row lock
// (+ DB-wide exact-once pair sweep #829/#948 — Vampire Spawn Bite 3-cond and
// Aboleth/Otyugh/Fenrir by_attacker rows are byte-distinct decoys); key-order →
// DROPPED; unmet press + undefined-store press → it2 (+ prone/blinded byte-distinct
// decoy #1035/#948, + zero-write read census with campaign tuples #1026/#932/#1019);
// grappled/restrained admits → it3 (+ third-party-source and meta-absent admits =
// the source-agnostic canonical cited by ma1931/ma1890); siblings byte-locks →
// card-wide prerequisite-absence-only sweep. refusalLog carries Date.now() —
// field-pinned, never deep-equals (#1057); zero writes → no afterEach needed
// (#1007/#1121); no wall-clock (#app); honest titles (#910); dead constants
// purged transitively (#1094).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  parseTargetPrerequisite,
  evaluateTargetPrerequisiteGate,
} from '../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SCYLLA = monsters.find((m) => m.index === 'scylla');
// lookup by NAME, not index (#1094 brittle-index fix)
const SNATCH = SCYLLA.legendary_actions.find((a) => a.name === 'Snatch');

// store-faithful read-only press (#1137/#1091): production runtime signature
// getRuntimeValue(name, key, campaign) returning null for absent keys, like the
// live store. Records every read — zero-write census + campaign tuples (#1026/#932).
const press = (conds, meta) => {
  const reads = [];
  const result = evaluateTargetPrerequisiteGate({
    action: SNATCH,
    target: { name: 'Bandit 1' },
    monsterName: 'Scylla 1',
    campaignName: 'test-campaign',
    getRuntimeValue: (name, key, campaign) => {
      reads.push(`${name}|${key}|${campaign}`);
      if (key === 'activeConditions') return conds ?? null;
      if (key === 'activeConditionMeta') return meta ?? null;
      return null;
    },
  });
  return { result, reads };
};

describe('MA-1981 disk fingerprint: Scylla Snatch prerequisite authored (DATA fix)', () => {
  it('real-row lock: attack core byte-unchanged, fix byte arms conditions-only prerequisite exact-once DB-wide (no by_attacker — source-agnostic by RAW)', () => {
    expect(SCYLLA.name).toBe('Scylla');
    expect(SNATCH.description).toBe(
      'One head lunges at a Grappled or Restrained creature. Melee Attack Roll: +16, reach 15 ft. Hit: 30 (4d10 + 8) Piercing damage.'
    ); // verbatim ground truth (#993/#1086 BY NAME)
    expect(SNATCH.attack_bonus).toBe(16);
    expect(SNATCH.reach).toBe('15 ft.');
    expect(SNATCH.damage_dice_primary).toBe('4d10 + 8');
    expect(SNATCH.damage_type_primary).toBe('Piercing');
    expect(canRollExpression(SNATCH.damage_dice_primary)).toBe(true); // exact-if-dice (#1072)
    // the ticket's fix byte — key-SET lock via toEqual, not key-order (#1100/#1113):
    expect(SNATCH.target_prerequisite).toEqual({ conditions: ['grappled', 'restrained'] });
    expect(SNATCH.target_prerequisite.by_attacker).toBeUndefined();
    // parse through production (MA-1931 conditions-only codification canonical here):
    expect(parseTargetPrerequisite(SNATCH)).toEqual({
      conditions: ['grappled', 'restrained'],
      byAttacker: false,
      attackName: 'Snatch',
    });
    // card-wide sweep (#1035 guard reaches the null branch): Snatch is the ONLY
    // prerequisite-armed row on Scylla — Bite/Multiattack/legendary Bite/
    // Shriek/header + Blood Tide stay prerequisite-absent-only legs (numerics are
    // ma1978/ma1982-owned, #1123/#1113 — cited here, not re-driven):
    expect([...SCYLLA.actions, ...SCYLLA.legendary_actions].filter((a) => a.target_prerequisite).map((a) => a.name)).toEqual(['Snatch']);
    // DB-wide exact-once (#829): the bare grappled+restrained pair with NO
    // by_attacker is unique to Scylla Snatch — Vampire Spawn Bite (3-cond, adds
    // incapacitated) and Aboleth/Otyugh/Fenrir (by_attacker:true) are byte-
    // distinct decoys (#948), owned by ma1652/ma1275/ma1890 respectively:
    const pairRows = monsters.flatMap((mon) => [...(mon.actions ?? []), ...(mon.legendary_actions ?? []), ...(mon.reactions ?? [])]
      .filter((a) => a.target_prerequisite && !a.target_prerequisite.by_attacker && a.target_prerequisite.conditions.length === 2 && a.target_prerequisite.conditions.includes('grappled') && a.target_prerequisite.conditions.includes('restrained'))
      .map((a) => `${mon.name} ${a.name}`));
    expect(pairRows).toEqual(['Scylla Snatch']);
  });
});

describe('MA-1981 gate lane: source-agnostic refuse/admit through evaluateTargetPrerequisiteGate (canonical cited by ma1931/ma1890)', () => {
  it('unmet presses refuse: prerequisite popup + snatch_refused log, zero spend zero roll, read-only store census', () => {
    const { result: r, reads } = press([], {});
    expect(r.satisfied).toBe(false);
    expect(String(r.popupHtml)).toContain('Prerequisite Not Met');
    expect(String(r.popupHtml)).toContain('must be Grappled or Restrained.');
    // source-agnostic copy: provenance suffix stays omitted (by_attacker absent)
    expect(String(r.popupHtml)).not.toContain('by Scylla');
    expect(r.refusalLog.type).toBe('automation');
    expect(r.refusalLog.automationType).toBe('snatch_refused');
    expect(r.refusalLog.characterName).toBe('Scylla 1');
    expect(r.refusalLog.abilityName).toBe('Snatch');
    expect(r.refusalLog.targetName).toBe('Bandit 1');
    expect(r.refusalLog.description).toContain('does not satisfy the prerequisite');
    expect(r.refusalLog.description).toContain('No save rolled, nothing spent.');
    // zero-write census (#1026) + campaign tuples (#932/#1019): the gate reads
    // exactly the two condition keys off Bandit 1@test-campaign — nothing else:
    expect([...new Set(reads)].sort()).toEqual([
      'Bandit 1|activeConditionMeta|test-campaign',
      'Bandit 1|activeConditions|test-campaign',
    ]);
    // byte-distinct decoys (#948/#1035): UNRELATED conditions still refuse —
    // the gate requires a condition MATCH, not a merely non-empty list;
    const d = press(['prone', 'blinded'], {});
    expect(d.result.satisfied).toBe(false);
    expect(d.result.refusalLog.automationType).toBe('snatch_refused');
    // absent-store press (repro state): undefined runtime keys still refuse
    const u = press(undefined, undefined);
    expect(u.result.satisfied).toBe(false);
    expect(u.result.popupHtml).toContain('Prerequisite Not Met');
  });

  it('met presses admit from ANY source — by_attacker absent means provenance is never checked (RAW: "a Grappled or Restrained creature")', () => {
    // grapple held by a THIRD PARTY admits: the source-agnostic canonical leg
    // (the mirror-refusal twin, where provenance decides, is by_attacker:true
    // territory owned by ma1275/ma1890 — not re-driven here):
    const g = press(['grappled'], { grappled: { source: 'Bandit Captain 1' } });
    expect(g.result.satisfied).toBe(true);
    expect(g.result.prerequisite.byAttacker).toBe(false);
    expect(g.result.popupHtml).toBeUndefined();
    expect(g.result.refusalLog).toBeUndefined();
    // restrained admits, meta-absent store admits — condition presence is the
    // only requirement (twins: Stomp/Hooves/Apep):
    expect(press(['restrained'], { restrained: { source: 'Zorbo' } }).result.satisfied).toBe(true);
    expect(press(['grappled'], undefined).result.satisfied).toBe(true);
  });
});
