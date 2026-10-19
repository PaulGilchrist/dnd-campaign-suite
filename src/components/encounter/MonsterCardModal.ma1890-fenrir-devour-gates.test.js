// @maintained-by-ai
// MA-1890: Fenrir "Devour (Recharge 5-6)" shipped core save/damage exact
// (DC 26 STR, 6d10+10 Piercing, half on success — live E2E verified) but the
// prose-only gates were inert: fired 4/4 vs NOT-grappled victims with zero
// refusal and recharged nothing (5 fires, zero recharge keys). DATA fix:
// target_prerequisite:{conditions:["grappled"],by_attacker:true} (MA-0019
// byte-shape, Aboleth Consume Memories twin — RAW "one Huge or smaller
// creature Fenrir has Grappled" demands provenance) + recharge:"5-6"
// (MA-0031/0488/0618 consumers live; name-text "Recharge 5-6" unparsed by
// rechargeUsageOf — MA-0663/MA-1843 fingerprint). Devour grants no grapple
// itself (condition input, not output); Fenrir Bite grapple provenance is a
// separate ticket (MA-1888 note) — in-app reach is GM-grant-only by design.
// Owner cites (not re-pinned here): gate plumbing/popup/log-shape per se is
// MA-0019 (MonsterCardHelpers:979-1028), source-agnostic refusal twin is
// MA-1981 Snatch (monsterSnatch.ma1981:84-102), recharge parse/gate/spend/
// turn-start d6 recovery is MA-0031 (monsterRecharge.test.js:41-57; 5-6
// threshold twin MA-1843 :231-237). This lane owns the by_attacker:true
// provenance truth table (refuse/accept decisions + "by Fenrir 1" copy).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { evaluateTargetPrerequisiteGate } from './MonsterCardHelpers.js';
import { rechargeActionKey, rechargeUsageOf } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const FENRIR = monsters.find((m) => m.index === 'fenrir');
const DEVOUR = FENRIR.actions.find((a) => a.name === 'Devour (Recharge 5-6)');

const gate = (conds, meta) => evaluateTargetPrerequisiteGate({
  action: DEVOUR,
  target: { name: 'ElderPaladin' },
  monsterName: 'Fenrir 1',
  campaignName: 'test-campaign',
  getRuntimeValue: (name, key) => (key === 'activeConditions' ? conds : key === 'activeConditionMeta' ? meta : undefined),
});

describe('MA-1890 disk fingerprint: Fenrir Devour gates authored', () => {
  it('authors grapple provenance prerequisite + numeric recharge; core adjudication bytes untouched (live-verified)', () => {
    expect(DEVOUR.name).toBe('Devour (Recharge 5-6)');
    expect(DEVOUR.save_dc).toBe(26);
    expect(DEVOUR.save_type).toBe('Strength');
    expect(DEVOUR.damage_dice_primary).toBe('6d10 + 10');
    expect(DEVOUR.recharge).toBe('5-6');
    expect(DEVOUR.target_prerequisite).toEqual({ conditions: ['grappled'], by_attacker: true });
    expect(DEVOUR.description).toBe(
      'Strength Saving Throw: DC 26, one Huge or smaller creature Fenrir has Grappled. Failure: 43 (6d10 + 10) Piercing damage. Success: Half damage.'
    );
    expect(DEVOUR.delegates_to).toBeUndefined();
    expect(DEVOUR.dc_success).toBeUndefined(); // default half = RAW-correct
  });
});

describe('MA-1890 prerequisite gate lane (MA-0019 consumer, by_attacker:true)', () => {
  it('refuses NOT-grappled victim: zero-roll popup + devour_recharge_5_6_refused log with by-Fenrir provenance', () => {
    const r = gate([], {});
    expect(r.satisfied).toBe(false);
    expect(r.popupHtml).toContain('Prerequisite Not Met');
    expect(r.popupHtml).toContain('by Fenrir 1'); // MA-1275/MA-1890 provenance copy
    expect(r.refusalLog).toMatchObject({
      type: 'automation',
      automationType: 'devour_recharge_5_6_refused',
      characterName: 'Fenrir 1',
      abilityName: 'Devour (Recharge 5-6)',
      targetName: 'ElderPaladin',
    });
    expect(r.refusalLog.description).toContain('does not satisfy the prerequisite');
    expect(r.refusalLog.description).toContain('by Fenrir 1');
    expect(r.refusalLog.description).toContain('No save rolled, nothing spent');
  });

  it('refuses grapple held from ANOTHER source — provenance decides, not the condition (MA-0019)', () => {
    expect(gate(['grappled'], { grappled: { source: 'Zorbo' } }).satisfied).toBe(false);
  });

  it('passes only Fenrir-sourced grapple: satisfied, zero popup, zero refusal log', () => {
    const r = gate(['grappled'], { grappled: { source: 'Fenrir 1' } });
    expect(r.satisfied).toBe(true);
    expect(r.popupHtml).toBeUndefined();
    expect(r.refusalLog).toBeUndefined();
  });
});

describe('MA-1890 recharge arm (MA-0031 consumer — parse/gate/recovery owned at monsterRecharge.test.js:41-57)', () => {
  it('authored recharge:"5-6" arms the economy for Devour: threshold 5, suffix-stripped key', () => {
    expect(rechargeUsageOf(DEVOUR)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(DEVOUR)).toBe('Devour');
  });
});
