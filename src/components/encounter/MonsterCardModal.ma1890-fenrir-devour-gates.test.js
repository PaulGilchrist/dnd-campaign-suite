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
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseTargetPrerequisite, evaluateTargetPrerequisiteGate } from './MonsterCardHelpers.js';
import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const FENRIR = monsters.find((m) => m.index === 'fenrir');
const DEVOUR = FENRIR.actions[3];

const gate = (conds, meta) => evaluateTargetPrerequisiteGate({
  action: DEVOUR,
  target: { name: 'ElderPaladin' },
  monsterName: 'Fenrir 1',
  campaignName: 'test-campaign',
  getRuntimeValue: (name, key) => (key === 'activeConditions' ? conds : key === 'activeConditionMeta' ? meta : undefined),
});

describe('MA-1890 disk fingerprint: Fenrir Devour gates authored', () => {
  it('authors the grapple provenance prerequisite + numeric recharge field', () => {
    expect(DEVOUR.name).toBe('Devour (Recharge 5-6)');
    expect(DEVOUR.save_dc).toBe(26);
    expect(DEVOUR.save_type).toBe('Strength');
    expect(DEVOUR.damage_dice_primary).toBe('6d10 + 10');
    expect(DEVOUR.recharge).toBe('5-6');
    expect(DEVOUR.target_prerequisite).toEqual({ conditions: ['grappled'], by_attacker: true });
  });

  it('name/description byte-unchanged; core adjudication untouched (live-verified)', () => {
    expect(DEVOUR.description).toBe(
      'Strength Saving Throw: DC 26, one Huge or smaller creature Fenrir has Grappled. Failure: 43 (6d10 + 10) Piercing damage. Success: Half damage.'
    );
    expect(DEVOUR.delegates_to).toBeUndefined();
    expect(DEVOUR.dc_success).toBeUndefined(); // default half = RAW-correct
  });
});

describe('MA-1890 prerequisite gate lane (MA-0019 consumer)', () => {
  it('parses by_attacker provenance requirement', () => {
    expect(parseTargetPrerequisite(DEVOUR)).toEqual({ conditions: ['grappled'], byAttacker: true, attackName: 'Devour (Recharge 5-6)' });
  });

  it('refuses a NOT-grappled victim: zero-roll refusal popup + devour_refused log', () => {
    const r = gate([], {});
    expect(r.satisfied).toBe(false);
    expect(r.popupHtml).toContain('Prerequisite Not Met');
    expect(r.refusalLog.type).toBe('automation');
    expect(r.refusalLog.automationType).toMatch(/devour.*refused/);
    expect(r.refusalLog.description).toContain('does not satisfy the prerequisite');
    expect(r.refusalLog.description).toContain('No save rolled, nothing spent');
  });

  it('refuses grapple-from-another-source (by_attacker provenance, MA-0019)', () => {
    expect(gate(['grappled'], { grappled: { source: 'Zorbo' } }).satisfied).toBe(false);
  });

  it('passes only Fenrir-sourced grapple', () => {
    const r = gate(['grappled'], { grappled: { source: 'Fenrir 1' } });
    expect(r.satisfied).toBe(true);
    expect(r.popupHtml).toBeUndefined();
  });
});

describe('MA-1890 recharge gate lane (MA-0031 consumer)', () => {
  it('rechargeUsageOf now parses 5-6 (was null — name-text fingerprint)', () => {
    expect(rechargeUsageOf(DEVOUR)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(DEVOUR)).toBe('Devour');
  });

  it('spent row refuses until recovery; fresh row is available', () => {
    const spent = monsterRechargeGate(DEVOUR, { Devour: { recharged: false, threshold: 5 } });
    expect(spent.available).toBe(false);
    expect(spent.key).toBe('Devour');
    expect(monsterRechargeGate(DEVOUR, { Devour: { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(DEVOUR, {}).available).toBe(true);
  });
});
