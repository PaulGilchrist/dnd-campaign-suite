// MA-1981: Scylla "Snatch" legendary child shipped a prose-only prerequisite
// ("One head lunges at a Grappled or Restrained creature") with NO structured
// target_prerequisite — parseTargetPrerequisite (MA-0019, Helpers:979) returned
// null and the live MA-0687 attack-lane gate passed EVERY target (repro
// 2026-10-12: ungated +16 fired on a zero-condition Bandit, ability_use spent
// 1/3, 4d10+8 = 38 damage, zero refusal, blind to grappled targets too).
// DATA fix: target_prerequisite {conditions:["grappled","restrained"]} trailing
// key after damage_type_primary (MA-0687 Stomp / MA-0689 Hooves twin key order).
// by_attacker adjudication: OMITTED — the RAW row text names no grapple source
// ("a Grappled or Restrained creature", source-agnostic), matching the attack-row
// twins Stomp/Hooves and MA-1847 Apep Devour the Boat (by_attacker absent);
// by_attacker:true is authored only on rows whose prose explicitly names the
// attacker as grappler (MA-0019 Aboleth "by the aboleth", MA-1275 Otyugh,
// MA-1890 Fenrir). Scylla authors no grapple/restrain producer at all (MA-1890
// reach-quirk precedent), so by_attacker would make the row permanently
// unreachable in-app and wrongly refuse third-party restrains the RAW allows.
// MA-1931 codification satisfied: parseTargetPrerequisite requires a NON-EMPTY
// conditions[] — this shape qualifies. Lane: legendary presses route through
// resolveLegendaryRow → legendaryPrerequisiteRefusal BEFORE expendLegendaryUse
// (MonsterCardModal :891 vs :920) — refusal is zero-spend zero-roll; handleAttack
// re-checks at :2342 (defense in depth).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  parseTargetPrerequisite,
  evaluateTargetPrerequisiteGate,
} from '../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SCYLLA = monsters.find((m) => m.name === 'Scylla');
const SNATCH = SCYLLA.legendary_actions[2];
const HEADER = SCYLLA.legendary_actions[0];
const BITE_LEGENDARY = SCYLLA.legendary_actions[1];
const SHRIEK = SCYLLA.legendary_actions[3];
const BLOOD_TIDE = SCYLLA.actions[2];
const BITE = SCYLLA.actions[1];

const gate = (conds, meta) => evaluateTargetPrerequisiteGate({
  action: SNATCH,
  target: { name: 'Bandit 1' },
  monsterName: 'Scylla 1',
  campaignName: 'test-campaign',
  getRuntimeValue: (name, key) => (key === 'activeConditions' ? conds : key === 'activeConditionMeta' ? meta : undefined),
});

describe('MA-1981 disk fingerprint: Scylla Snatch prerequisite authored (DATA fix)', () => {
  it('legendary_actions[2] is Snatch; attack core byte-unchanged', () => {
    expect(SNATCH.name).toBe('Snatch');
    expect(SNATCH.description).toBe(
      'One head lunges at a Grappled or Restrained creature. Melee Attack Roll: +16, reach 15 ft. Hit: 30 (4d10 + 8) Piercing damage.'
    );
    expect(SNATCH.attack_bonus).toBe(16);
    expect(SNATCH.reach).toBe('15 ft.');
    expect(SNATCH.damage_dice_primary).toBe('4d10 + 8');
    expect(SNATCH.damage_type_primary).toBe('Piercing');
    expect(canRollExpression(SNATCH.damage_dice_primary)).toBe(true);
  });

  it('target_prerequisite byte-shape per MA-0687/MA-0689 attack-row twins: conditions-only, no by_attacker', () => {
    expect(SNATCH.target_prerequisite).toEqual({ conditions: ['grappled', 'restrained'] });
    expect(SNATCH.target_prerequisite.by_attacker).toBeUndefined();
  });

  it('key order mirrors Stomp/Hooves twins: target_prerequisite trailing key after damage_type_primary', () => {
    const keys = Object.keys(SNATCH);
    expect(keys.indexOf('target_prerequisite')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('target_prerequisite');
  });
});

describe('MA-1981 parseTargetPrerequisite (MA-1931 conditions-only codification)', () => {
  it('parses lowercase conditions pair, byAttacker false, attackName Snatch', () => {
    expect(parseTargetPrerequisite(SNATCH)).toEqual({
      conditions: ['grappled', 'restrained'],
      byAttacker: false,
      attackName: 'Snatch',
    });
  });
});

describe('MA-1981 evaluateTargetPrerequisiteGate on the Snatch row (MA-0687 §564 pure rig)', () => {
  it('ungrappled/unrestrained victim refuses: prerequisite popup + snatch_refused log, nothing spent', () => {
    const r = gate([], {});
    expect(r.satisfied).toBe(false);
    expect(String(r.popupHtml)).toContain('Prerequisite Not Met');
    expect(String(r.popupHtml)).toContain('must be Grappled or Restrained.');
    // source-agnostic copy: provenance suffix stays omitted (by_attacker absent)
    expect(String(r.popupHtml)).not.toContain('by Scylla');
    expect(r.refusalLog.type).toBe('automation');
    expect(r.refusalLog.automationType).toBe('snatch_refused');
    expect(r.refusalLog.characterName).toBe('Scylla 1');
    expect(r.refusalLog.targetName).toBe('Bandit 1');
    expect(r.refusalLog.description).toContain('does not satisfy the prerequisite');
    expect(r.refusalLog.description).toContain('No save rolled, nothing spent.');
  });

  it('no stored state at all (undefined runtime keys) still refuses', () => {
    const r = gate(undefined, undefined);
    expect(r.satisfied).toBe(false);
    expect(r.refusalLog.automationType).toBe('snatch_refused');
  });

  it('grappled victim satisfies (any source — source-agnostic twin pin)', () => {
    const r = gate(['grappled'], { grappled: { source: 'Bandit Captain 1' } });
    expect(r.satisfied).toBe(true);
    expect(r.popupHtml).toBeUndefined();
  });

  it('restrained victim satisfies', () => {
    const r = gate(['restrained'], { restrained: { source: 'Scylla 1' } });
    expect(r.satisfied).toBe(true);
  });
});

describe('MA-1981 siblings byte-locked', () => {
  it('legendary header + delegates untouched; Bite/Shriek carry no prerequisite', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(BITE_LEGENDARY.name).toBe('Bite');
    expect(BITE_LEGENDARY.delegates_to).toBe('Bite');
    expect(BITE_LEGENDARY.target_prerequisite).toBeUndefined();
    expect(SHRIEK.name).toBe('Shriek (Costs 2 Actions)');
    expect(SHRIEK.save_dc).toBe(23);
    expect(SHRIEK.save_type).toBe('Wisdom');
    expect(SHRIEK.damage_dice_primary).toBe('2d10');
    expect(SHRIEK.target_prerequisite).toBeUndefined();
  });

  it('actions siblings untouched: Bite attack ungated, Blood Tide byte-stable (MA-1978 recharge fix intact, no prerequisite)', () => {
    expect(BITE.name).toBe('Bite');
    expect(BITE.attack_bonus).toBe(16);
    expect(BITE.damage_dice_primary).toBe('4d10 + 8');
    expect(BITE.target_prerequisite).toBeUndefined();
    expect(BLOOD_TIDE.name).toBe('Blood Tide (Recharge 5-6)');
    expect(BLOOD_TIDE.save_dc).toBe(25);
    expect(BLOOD_TIDE.save_type).toBe('Dexterity');
    expect(BLOOD_TIDE.recharge).toBe('5-6');
    expect(BLOOD_TIDE.target_prerequisite).toBeUndefined();
  });
});
