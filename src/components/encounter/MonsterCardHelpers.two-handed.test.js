// MA-0636: Drider Longsword advertised versatile two-handed 1d10+3 variant
// (monsters.json damage_dice_two_handed) — MA-0325 template one-field data
// fix. Locks: drider actions[2] authors the variant alongside the primary;
// buildTwoHandedVariantOffer yields the offer with BOTH formulas (two-handed
// swap formula + one-handed base/default); select-log records each choice;
// sibling drider rows without the field stay byte-inert.
// @maintained-by-ai
// OWNER LANE (generic two-handed): the offer-shape, byte-inert null-offer, and
// two-vs-one select-fork tests below are cited by sibling MA lanes (#523 ma0871,
// #525 ma0959, #526 ma0965, #527 ma0989, #528 ma1063, #529 ma1100, #531 ma1146,
// #535-#537, #552, #557) — immovable: strengthen in place, never delete/reorder.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog, attackRowMissingToHit } from './MonsterCardHelpers.js';

const MONSTERS = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;

describe('MA-0636 data lock (monsters.json Drider Longsword)', () => {
  it('actions[2] Longsword row identity + attack_bonus 6 (damage fields locked by owner offer below)', () => {
    const longsword = MONSTERS.find((m) => m.name === 'Drider').actions[2];
    expect(longsword.name).toBe('Longsword');
    expect(longsword.attack_bonus).toBe(6);
  });

  it('buildTwoHandedVariantOffer arms the HIT-popup chooser with both formulas', () => {
    const longsword = MONSTERS.find((m) => m.name === 'Drider').actions[2];
    const offer = buildTwoHandedVariantOffer(longsword, 'Longsword');
    expect(offer).toMatchObject({
      formula: '1d10 + 3',
      baseFormula: '1d8 + 3',
      damageType: 'slashing',
      attackName: 'Longsword',
    });
    expect(offer.label).toBe('Two-Handed: 1d10 + 3 slashing?');
    expect(buildTwoHandedVariantOffer(longsword).attackName).toBe('Longsword');
  });

  it('sibling drider rows without the field stay byte-inert', () => {
    const drider = MONSTERS.find((m) => m.name === 'Drider');
    expect(drider.actions[1].name).toBe('Bite');
    expect(drider.actions[1].damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(drider.actions[1], 'Bite')).toBeNull();
    expect(drider.actions[3].name).toBe('Longbow');
    expect(buildTwoHandedVariantOffer(drider.actions[3], 'Longbow')).toBeNull();
  });

  it('select logs record each choice with the correct formula', () => {
    const offer = buildTwoHandedVariantOffer(MONSTERS.find((m) => m.name === 'Drider').actions[2], 'Longsword');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Drider 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.characterName).toBe('Drider 1');
    expect(two.abilityName).toBe('Longsword');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d10 + 3');
    expect(two.description).not.toContain('default');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Drider 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d8 + 3');
    expect(one.description).not.toContain('1d10');
  });
});

describe('MA-0647 data lock (monsters.json Drow Mage Staff)', () => {
  const staffRow = () => {
    const staff = MONSTERS.find((m) => m.name === 'Drow Mage').actions[0];
    expect(staff.name).toBe('Staff');
    return staff;
  };

  it('Staff authors + 2 to hit, 1d8 - 1 two-handed beside 1d6 - 1 primary + poison secondary; Summon Demon sibling stays byte-inert', () => {
    const staff = staffRow();
    expect(staff.attack_bonus).toBe(2);
    expect(staff.description).toMatch(/\+ 2 to hit/);
    expect(staff.damage_dice_primary).toBe('1d6 - 1');
    expect(staff.damage_dice_two_handed).toBe('1d8 - 1');
    expect(staff.damage_type_primary).toBe('bludgeoning');
    expect(staff.damage_dice_secondary).toBe('1d6');
    expect(staff.damage_type_secondary).toBe('poison');
    const summon = MONSTERS.find((m) => m.name === 'Drow Mage').actions[1];
    expect(summon.name).toBe('Summon Demon');
    expect(buildTwoHandedVariantOffer(summon, 'Summon Demon')).toBeNull();
  });

  it('Staff row chips un-suppressed and HIT-popup chooser armed with both formulas', () => {
    const staff = staffRow();
    expect(attackRowMissingToHit(staff)).toBe(false);
    const offer = buildTwoHandedVariantOffer(staff, 'Staff');
    expect(offer).toMatchObject({
      formula: '1d8 - 1',
      baseFormula: '1d6 - 1',
      damageType: 'bludgeoning',
      attackName: 'Staff',
    });
    expect(offer.label).toBe('Two-Handed: 1d8 - 1 bludgeoning?');
  });
});

describe('MA-0652 data lock (monsters.json Druid Quarterstaff)', () => {
  it('Quarterstaff authors 1d8 + 2 beside the no-modifier 1d6 primary; offer arms chooser and defaulted select passes the bare 1d6 base through', () => {
    const staff = MONSTERS.find((m) => m.name === 'Druid').actions[0];
    expect(staff.name).toBe('Quarterstaff');
    expect(staff.attack_bonus).toBe(2);
    expect(staff.damage_dice_primary).toBe('1d6');
    expect(staff.damage_dice_two_handed).toBe('1d8 + 2');
    expect(staff.damage_type_primary).toBe('bludgeoning');
    expect(staff.description).toMatch(/1d8 \+ 2\) bludgeoning damage with shillelagh or if wielded with two hands/);
    const offer = buildTwoHandedVariantOffer(staff, 'Quarterstaff');
    expect(offer).toMatchObject({
      formula: '1d8 + 2',
      baseFormula: '1d6',
      damageType: 'bludgeoning',
      attackName: 'Quarterstaff',
    });
    expect(offer.label).toBe('Two-Handed: 1d8 + 2 bludgeoning?');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Druid 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('1d6');
    expect(one.description).not.toContain('1d8');
  });
});

describe('MA-0653 data lock (monsters.json Dryad Club)', () => {
  it('Club authors canonical base "1d4" (no modifier); shillelagh prose stays advisory — no variant field, no chooser offer', () => {
    const club = MONSTERS.find((m) => m.name === 'Dryad').actions[0];
    expect(club.name).toBe('Club');
    expect(club.attack_bonus).toBe(2);
    expect(club.damage_dice_primary).toBe('1d4');
    expect(club.damage_type_primary).toBe('Bludgeoning');
    expect(club.description).toMatch(/Hit: 2 \(1 d4\) bludgeoning damage/);
    expect(club.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(club, 'Club')).toBeNull();
  });
});
