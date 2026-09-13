// MA-0024: lair-action gated-row model — clickable classification, save-row
// delegation to the existing save seam, CLA-325 advisory record for
// phantasmal force, lair_action_refused for unresolvable rows. Legacy
// plain-string rows never become clickable.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isLairRowClickable,
  lairRowAffordance,
  resolveLairRow,
  buildLairRefusalLog,
  buildLairAdvisoryLog,
} from './monsterLairActions.js';
import { addEntry } from '../ui/logService.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

const PHANTASMAL = {
  name: 'Phantasmal Force',
  advisory: 'phantasmal_force',
  save_dc: 16,
  save_type: 'Intelligence',
  description: 'The aboleth casts phantasmal force (no components required)…',
};
const TIDE = {
  name: 'Grasping Tide',
  save_dc: 14,
  save_type: 'Strength',
  save_effect: 'Failure: The target is pulled up to 20 feet into the water and knocked prone. Success: unaffected.',
  description: 'Pools of water within 90 feet of the aboleth surge outward in a grasping tide…',
};
const RAGE = {
  name: 'Conduit for Rage',
  save_dc: 14,
  save_type: 'Wisdom',
  damage_dice_primary: '2d6',
  damage_type_primary: 'Psychic',
  save_effect: 'Failure: 7 (2d6) Psychic damage. Success: Half damage.',
  description: 'Water in the aboleth\'s lair magically becomes a conduit for the creature\'s rage…',
};

beforeEach(() => vi.clearAllMocks());

describe('MA-0024 clickable classification', () => {
  it('legacy plain strings and nameless/affordance-less rows are never clickable', () => {
    expect(isLairRowClickable('The aboleth casts phantasmal force…')).toBe(false);
    expect(isLairRowClickable(null)).toBe(false);
    expect(isLairRowClickable({ description: 'no name, no numbers' })).toBe(false);
    expect(isLairRowClickable({ name: 'Mists', description: 'prose only' })).toBe(false);
  });

  it('structured aboleth rows classify save/advisory/damage', () => {
    expect(lairRowAffordance(TIDE)).toBe('save');
    expect(lairRowAffordance(RAGE)).toBe('save');
    expect(lairRowAffordance(PHANTASMAL)).toBe('advisory');
    expect(lairRowAffordance({ name: 'Quake', attack_bonus: 7, description: 'x' })).toBe('attack');
    expect(lairRowAffordance({ name: 'Spew', damage_dice_primary: '3d6', description: 'x' })).toBe('damage');
  });
});

describe('MA-0024 resolveLairRow', () => {
  const base = {
    monsterName: 'Aboleth 1',
    campaignName: 'test-campaign',
    setPopupHtml: vi.fn(),
    handleSaveRoll: vi.fn(),
    handleAttack: vi.fn(),
    handleDamage: vi.fn(),
  };

  it('save row routes through the save seam with authored DC/type, formula + conditions', async () => {
    const res = await resolveLairRow({
      ...base, action: TIDE, saveDamageFormula: null, saveConditions: ['prone'],
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(base.handleSaveRoll).toHaveBeenCalledWith(TIDE, null, ['prone']);
    expect(base.setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('damage-bearing save row forwards its authored formula (half-on-success math untouched)', async () => {
    const res = await resolveLairRow({
      ...base, action: RAGE, saveDamageFormula: '2d6', saveConditions: [],
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(base.handleSaveRoll).toHaveBeenCalledWith(RAGE, '2d6', []);
  });

  it('advisory phantasmal-force row logs spell-named ability_use with GM-enforced note, zero roll', async () => {
    const res = await resolveLairRow({ ...base, action: PHANTASMAL });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(base.handleSaveRoll).not.toHaveBeenCalled();
    expect(base.handleDamage).not.toHaveBeenCalled();
    expect(base.setPopupHtml).toHaveBeenCalled();
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Aboleth 1');
    expect(entry.abilityName).toBe('Phantasmal Force');
    expect(entry.description).toContain('phantasmal force');
    expect(entry.description).toContain('save DC 16 Intelligence');
    expect(entry.description).toMatch(/initiative 20.*GM-enforced|GM-enforced/);
  });

  it('unresolvable structured row: refusal popup + lair_action_refused log, zero handler calls', async () => {
    const res = await resolveLairRow({ ...base, action: { name: 'Broken Row', description: 'prose only' } });
    expect(res).toEqual({ resolved: false, reason: 'unresolvable' });
    expect(String(base.setPopupHtml.mock.calls[0][0])).toContain('Lair Action Refused');
    expect(addEntry.mock.calls[0][1].automationType).toBe('lair_action_refused');
    expect(base.handleSaveRoll).not.toHaveBeenCalled();
    expect(base.handleDamage).not.toHaveBeenCalled();
    expect(base.handleAttack).not.toHaveBeenCalled();
  });

  it('log builders carry monster name and GM-enforced advisory note', () => {
    expect(buildLairRefusalLog({ monsterName: 'Aboleth 1', actionName: 'X' }).automationType).toBe('lair_action_refused');
    expect(buildLairAdvisoryLog({ monsterName: 'Aboleth 1', action: PHANTASMAL }).description).toMatch(/24[- ]hour/i);
  });
});

// MA-0041: Adult Black Dragon water-surge data-consistency lock — authored
// description (repo truth) says "DC 15 Strength saving throw … knocked prone"
// with NO damage; the row previously carried save_type Constitution plus
// fabricated 3d6 Piercing copied from the insect-swarm row.
describe('MA-0041 adult-black-dragon water surge data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-black-dragon');
  const surge = dragon.lair_actions[0];

  it('structured clickable row named per MA-0024 convention', () => {
    expect(surge.name).toBe('Water Surge');
    expect(lairRowAffordance(surge)).toBe('save');
  });

  it('save_type matches the authored description (Strength, not Constitution)', () => {
    expect(surge.save_dc).toBe(15);
    expect(surge.save_type).toBe('Strength');
    expect(surge.description).toMatch(/DC 15 Strength saving throw/i);
  });

  it('no fabricated damage — description is pull+prone only (Grasping Tide shape)', () => {
    expect(surge.damage_dice_primary).toBeUndefined();
    expect(surge.damage_type_primary).toBeUndefined();
    expect(surge.save_effect).toMatch(/knocked prone/i);
    expect(surge.save_effect).not.toMatch(/damage/i);
    expect(surge.description).not.toMatch(/damage/i);
  });
});

// MA-0042: Adult Black Dragon lair_actions[1] "Insect Cloud" was a plain
// string (inert, zero zone consumers). Now structured + clickable, machine-
// readable: CON DC 15, 3d6 Piercing half-on-success, and a persisting 20-ft
// zone with repeat_turn_end (the turn-END repeat remains GM-advisory — no
// turn-end zone-damage consumer exists; see SaveAttackAoeModal.lair-zone).
describe('MA-0042 adult-black-dragon insect cloud data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-black-dragon');
  const cloud = dragon.lair_actions[1];

  it('row is now a structured clickable SAVE row named Insect Cloud', () => {
    expect(typeof cloud).toBe('object');
    expect(cloud.name).toBe('Insect Cloud');
    expect(lairRowAffordance(cloud)).toBe('save');
  });

  it('authored save/damage fields: DC 15 Constitution, 3d6 Piercing, half on success', () => {
    expect(cloud.save_dc).toBe(15);
    expect(cloud.save_type).toBe('Constitution');
    expect(cloud.damage_dice_primary).toBe('3d6');
    expect(cloud.damage_type_primary).toBe('Piercing');
    expect(cloud.dc_success).toBe('half');
  });

  it('machine-readable persisting zone: 20-ft radius, repeat at turn end, advisory duration', () => {
    expect(cloud.zone).toEqual({ radius_ft: 20, repeat_turn_end: true });
    expect(cloud.duration).toBe('until dismissed or used again (advisory)');
  });

  it('description carries the verbatim mechanics (cloud, DC 15 CON, turn-end repeat)', () => {
    expect(cloud.description).toMatch(/20-foot-radius sphere/i);
    expect(cloud.description).toMatch(/DC 15 Constitution saving throw/i);
    expect(cloud.description).toMatch(/10 \(3d6\) piercing damage/i);
    expect(cloud.description).toMatch(/ends its turn in the cloud takes 10 \(3d6\) piercing damage/i);
  });
});

// MA-0043: Adult Black Dragon lair_actions[2] "Shroud of Darkness" was a
// plain string (inert, no light/zone consumer). Now structured with a
// machine-readable 15-ft save-less zone: affordance 'zone' routes through the
// area picker in zoneOnly mode (arm te + tracking + log, NO save roll).
describe('MA-0043 adult-black-dragon shroud of darkness data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-black-dragon');
  const dark = dragon.lair_actions[2];

  it('row is now a structured clickable ZONE row named Shroud of Darkness', () => {
    expect(typeof dark).toBe('object');
    expect(dark.name).toBe('Shroud of Darkness');
    expect(isLairRowClickable(dark)).toBe(true);
    expect(lairRowAffordance(dark)).toBe('zone');
  });

  it('canonical darkness lair = NO save: no save_dc authored, zone flagged no_save', () => {
    expect(dark.save_dc).toBeUndefined();
    expect(dark.zone.radius_ft).toBe(15);
    expect(dark.zone.no_save).toBe(true);
    expect(dark.description).not.toMatch(/saving throw/i);
  });

  it('description verbatim + advisory light/dispel clause (GM-enforced)', () => {
    expect(dark.description).toMatch(/15-foot-radius sphere/i);
    expect(dark.description).toMatch(/darkvision can't see through this darkness/i);
    expect(dark.description).toMatch(/spell of 2nd level or lower, the spell that created the light is dispelled/i);
    expect(dark.zone.advisory).toMatch(/dispel only by 2nd-level\+ light — GM-enforced/);
    expect(dark.duration).toBe('until dismissed or used again (advisory)');
  });

  it('insect cloud (zone WITH save) keeps its save affordance untouched', () => {
    expect(lairRowAffordance(dragon.lair_actions[1])).toBe('save');
  });

  it('legacy plain-string rows never become zone-clickable', () => {
    expect(isLairRowClickable('Magical darkness spreads from a point…')).toBe(false);
    expect(lairRowAffordance({ name: 'Mists', description: 'prose only' })).toBeNull();
  });

  it('zone row routes through handleZone, zero save/attack/damage handler calls', async () => {
    const handleZone = vi.fn();
    const res = await resolveLairRow({
      monsterName: 'Adult Black Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll: vi.fn(),
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone,
      action: dark,
    });
    expect(res).toEqual({ resolved: true, affordance: 'zone' });
    expect(handleZone).toHaveBeenCalledWith(dark);
  });
});
