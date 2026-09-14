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
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
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

// MA-0062: Adult Blue Dragon lair_actions[0] "ceiling collapse" was an
// unnamed inert dict (MV-24) with damage-type drift — save_effect said
// "Lightning" (copy-paste from the lightning-arcs row [2]) while the
// authored description says bludgeoning. Now named + Bludgeoning +
// condition vocabulary in save_effect so the MA-0017 failed-save seam
// applies prone+restrained; buried/rescue is CLA-325 advisory (no rescue
// engine).
describe('MA-0062 adult-blue-dragon falling ceiling data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');
  const ceiling = dragon.lair_actions[0];

  it('structured clickable row named per MA-0024 convention', () => {
    expect(typeof ceiling).toBe('object');
    expect(ceiling.name).toBe('Falling Ceiling');
    expect(isLairRowClickable(ceiling)).toBe(true);
    expect(lairRowAffordance(ceiling)).toBe('save');
  });

  it('save_dc/save_type match the authored description verbatim', () => {
    expect(ceiling.save_dc).toBe(15);
    expect(ceiling.save_type).toBe('Dexterity');
    expect(ceiling.description).toMatch(/DC 15 Dexterity saving throw/i);
  });

  it('damage type fixed to Bludgeoning — no Lightning drift on this row', () => {
    expect(ceiling.damage_dice_primary).toBe('3d6');
    expect(ceiling.damage_type_primary).toBe('Bludgeoning');
    expect(ceiling.save_effect).toMatch(/bludgeoning/i);
    expect(ceiling.save_effect).not.toMatch(/lightning/i);
    expect(ceiling.dc_success).toBe('half');
  });

  it('save_effect carries condition vocabulary → MA-0017 seam applies prone+restrained', () => {
    expect(ceiling.save_effect).toMatch(/knocked prone/i);
    expect(ceiling.save_effect).toMatch(/restrained/i);
    expect(extractConditionsFromSaveEffect(ceiling.save_effect)).toEqual(['prone', 'restrained']);
  });

  it('buried/rescue clause machine-readable but advisory (CLA-325 — no rescue engine)', () => {
    expect(ceiling.rescue_check.ability).toBe('Strength');
    expect(ceiling.rescue_check.dc).toBe(10);
    expect(ceiling.rescue_check.ends).toBe('buried');
    expect(ceiling.rescue_check.advisory).toMatch(/GM-enforced/);
    expect(ceiling.description).toMatch(/DC 10 Strength check, ending the buried state on a success/i);
  });

  it('save row routes through handleSaveRoll with formula + prone/restrained conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: ceiling,
      monsterName: 'Adult Blue Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: '3d6',
      saveConditions: extractConditionsFromSaveEffect(ceiling.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(ceiling, '3d6', ['prone', 'restrained']);
  });
});

// MA-0063: Adult Blue Dragon lair_actions[1] "Sand Cloud" was a plain string
// (inert — no zone, no save, no blinded). Now structured save+zone mirroring
// MA-0042 Insect Cloud: CON DC 15, dc_success none (no damage), a 20-ft
// persisting zone `lair_sand_cloud`, blinded 1 min + end-of-turn repeat saves.
describe('MA-0063 adult-blue-dragon sand cloud data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');
  const cloud = dragon.lair_actions[1];

  it('row is now a structured clickable SAVE row named Sand Cloud', () => {
    expect(typeof cloud).toBe('object');
    expect(cloud.name).toBe('Sand Cloud');
    expect(isLairRowClickable(cloud)).toBe(true);
    expect(lairRowAffordance(cloud)).toBe('save');
  });

  it('authored save fields: DC 15 Constitution, no damage (dc_success none)', () => {
    expect(cloud.save_dc).toBe(15);
    expect(cloud.save_type).toBe('Constitution');
    expect(cloud.dc_success).toBe('none');
    expect(cloud.damage_dice_primary).toBeUndefined();
  });

  it('save_effect vocabulary → MA-0017 seam extracts blinded (no fabricated conditions)', () => {
    expect(cloud.save_effect).toMatch(/blinded/i);
    expect(cloud.save_effect).toMatch(/repeat the constitution save/i);
    expect(extractConditionsFromSaveEffect(cloud.save_effect)).toEqual(['blinded']);
  });

  it('machine-readable persisting zone: 20-ft radius, lair_sand_cloud key, repeat_save', () => {
    expect(cloud.zone.radius_ft).toBe(20);
    expect(cloud.zone.effect_key).toBe('lair_sand_cloud');
    expect(cloud.zone.repeat_save).toBe(true);
    expect(cloud.zone.advisory).toMatch(/GM-enforced/);
    expect(cloud.duration).toMatch(/blinded 1 minute/i);
  });

  it('description carries the verbatim mechanics (20-ft sphere, DC 15 CON, blinded, repeat)', () => {
    expect(cloud.description).toMatch(/20-foot-radius sphere/i);
    expect(cloud.description).toMatch(/DC 15 Constitution saving throw/i);
    expect(cloud.description).toMatch(/blinded for 1 minute/i);
    expect(cloud.description).toMatch(/repeat the saving throw at the end of each of its turns/i);
  });

  it('save row routes through handleSaveRoll with blinded conditions, zero damage formula', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: cloud,
      monsterName: 'Adult Blue Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(cloud.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(cloud, null, ['blinded']);
  });
});

// MA-0064: Adult Blue Dragon lair_actions[2] "Lightning arcs" was a plain
// string (inert — no name, no affordance, zero handlers, zero log). Now a
// structured save row mirroring MA-0062 Falling Ceiling (same card) and
// MA-0042 Insect Cloud: DC 15 Dexterity, 3d6 Lightning half-on-success.
describe('MA-0064 adult-blue-dragon lightning arcs data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');
  const arcs = dragon.lair_actions[2];

  it('row is now a structured clickable SAVE row named Lightning Arcs', () => {
    expect(typeof arcs).toBe('object');
    expect(arcs.name).toBe('Lightning Arcs');
    expect(isLairRowClickable(arcs)).toBe(true);
    expect(lairRowAffordance(arcs)).toBe('save');
  });

  it('authored save/damage fields: DC 15 Dexterity, 3d6 Lightning, half on success', () => {
    expect(arcs.save_dc).toBe(15);
    expect(arcs.save_type).toBe('Dexterity');
    expect(arcs.damage_dice_primary).toBe('3d6');
    expect(arcs.damage_type_primary).toBe('Lightning');
    expect(arcs.dc_success).toBe('half');
    expect(arcs.save_effect).toBe('Failure: 10 (3d6) Lightning damage. Success: Half damage.');
  });

  it('description keeps the canonical mechanics verbatim (line, 120-ft endpoints, DC 15 DEX)', () => {
    expect(arcs.description).toMatch(/5-foot-wide line/i);
    expect(arcs.description).toMatch(/within 120 feet of the dragon and 120 feet of each other/i);
    expect(arcs.description).toMatch(/DC 15 Dexterity saving throw/i);
    expect(arcs.description).toMatch(/10 \(3d6\) lightning damage/i);
  });

  it('damageless save_effect extracts NO conditions (pure damage row)', () => {
    expect(extractConditionsFromSaveEffect(arcs.save_effect)).toEqual([]);
  });

  it('save row routes through handleSaveRoll with the 3d6 formula', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: arcs,
      monsterName: 'Adult Blue Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: '3d6',
      saveConditions: [],
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(arcs, '3d6', []);
  });

  it('siblings untouched: Falling Ceiling and Sand Cloud keep their authored rows', () => {
    expect(dragon.lair_actions[0].name).toBe('Falling Ceiling');
    expect(dragon.lair_actions[1].name).toBe('Sand Cloud');
  });
});

// MA-0074: Adult Brass Dragon lair_actions[0] was an unnamed inert dict
// (MV-24/MV-21 fingerprint) with data drift copied from the sibling sand-cloud
// row [1]: save_type Constitution (canonical STR) and save_effect "blinded for
// 1 minute" (canonical pushed 15 ft + knocked prone). Now named "Strong Wind"
// + Strength + push/prone so the MA-0024 seam renders a .mc-dice-link-lair
// chip and the MA-0017 damageless failed-save seam applies prone. Push distance
// and the gas/flame extinguish clauses stay GM-advisory (no push/flame te
// consumer app-wide — CLA-325 precedent).
describe('MA-0074 adult-brass-dragon strong wind data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-brass-dragon');
  const wind = dragon.lair_actions[0];

  it('row is now a structured clickable SAVE row named Strong Wind', () => {
    expect(typeof wind).toBe('object');
    expect(wind.name).toBe('Strong Wind');
    expect(isLairRowClickable(wind)).toBe(true);
    expect(lairRowAffordance(wind)).toBe('save');
  });

  it('save_type fixed to Strength — matches the authored description (no CON drift)', () => {
    expect(wind.save_dc).toBe(15);
    expect(wind.save_type).toBe('Strength');
    expect(wind.description).toMatch(/DC 15 Strength saving throw/i);
    expect(wind.save_effect).not.toMatch(/constitution/i);
  });

  it('save_effect fixed to push+prone — no blinded drift from the sand-cloud row', () => {
    expect(wind.save_effect).toMatch(/pushed 15 feet away from the dragon/i);
    expect(wind.save_effect).toMatch(/knocked prone/i);
    expect(wind.save_effect).not.toMatch(/blinded/i);
  });

  it('no damage authored (dc_success none) — pure push/prone control row', () => {
    expect(wind.damage_dice_primary).toBeUndefined();
    expect(wind.damage_type_primary).toBeUndefined();
    expect(wind.dc_success).toBe('none');
    expect(wind.save_effect).toMatch(/deals no damage/i);
  });

  it('failed-save vocabulary extracts ONLY prone (MA-0017 damageless seam)', () => {
    expect(extractConditionsFromSaveEffect(wind.save_effect)).toEqual(['prone']);
  });

  it('gas/flame extinguish clauses kept as advisory prose (GM-enforced — no consumer)', () => {
    expect(wind.save_effect).toMatch(/gases and vapors are dispersed/i);
    expect(wind.save_effect).toMatch(/unprotected flames are extinguished/i);
    expect(wind.save_effect).toMatch(/GM-enforced/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula, prone conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: wind,
      monsterName: 'Adult Brass Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(wind.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(wind, null, ['prone']);
  });

  it('sibling sand-cloud row [1] keeps its canonical mechanics (structured as of MA-0075)', () => {
    expect(dragon.lair_actions[1].description).toMatch(/DC 15 Constitution saving throw/i);
    expect(dragon.lair_actions[1].description).toMatch(/blinded for 1 minute/i);
  });
});

// MA-0075: Adult Brass Dragon lair_actions[1] "Sand Cloud" was a plain string
// (inert — MV-21/24 fingerprint: no name, no save, no zone, no blinded).
// Now structured save+zone mirroring the VERIFIED MA-0063 Adult Blue Dragon
// row byte-for-byte in structure: CON DC 15, dc_success none (damageless),
// 20-ft persisting zone `lair_sand_cloud`, blinded 1 min + end-of-turn
// repeat saves (repeat-save clause advisory prose — no NPC turn-end
// zone-save consumer). Renders a .mc-dice-link-lair chip via the untouched
// MA-0024 seam and routes through handleSaveRoll → MA-0031/0035 area picker.
describe('MA-0075 adult-brass-dragon sand cloud data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-brass-dragon');
  const cloud = dragon.lair_actions[1];
  const blue = monstersData.find(m => m.index === 'adult-blue-dragon');
  const blueCloud = blue.lair_actions[1];

  it('row is now a structured clickable SAVE row named Sand Cloud', () => {
    expect(typeof cloud).toBe('object');
    expect(cloud.name).toBe('Sand Cloud');
    expect(isLairRowClickable(cloud)).toBe(true);
    expect(lairRowAffordance(cloud)).toBe('save');
  });

  it('mirrors the verified MA-0063 blue dragon row byte-for-byte in structure', () => {
    expect(Object.keys(cloud)).toEqual(Object.keys(blueCloud));
    expect(Object.keys(cloud.zone)).toEqual(Object.keys(blueCloud.zone));
    expect(cloud.save_dc).toBe(blueCloud.save_dc);
    expect(cloud.save_type).toBe(blueCloud.save_type);
    expect(cloud.dc_success).toBe(blueCloud.dc_success);
    expect(cloud.save_effect).toBe(blueCloud.save_effect);
    expect(cloud.zone).toEqual(blueCloud.zone);
    expect(cloud.duration).toBe(blueCloud.duration);
  });

  it('description kept verbatim from the original string row (canonical mechanics)', () => {
    expect(cloud.description).toMatch(/20-foot-radius sphere/i);
    expect(cloud.description).toMatch(/Each creature in it must succeed on a DC 15 Constitution saving throw/i);
    expect(cloud.description).toMatch(/blinded for 1 minute/i);
    expect(cloud.description).toMatch(/repeat the saving throw at the end of each of its turns/i);
  });

  it('no damage authored (dc_success none) — pure blinded control row', () => {
    expect(cloud.damage_dice_primary).toBeUndefined();
    expect(cloud.damage_type_primary).toBeUndefined();
    expect(cloud.dc_success).toBe('none');
    expect(cloud.save_effect).toMatch(/deals no damage/i);
  });

  it('save_effect vocabulary → MA-0017 seam extracts ONLY blinded', () => {
    expect(extractConditionsFromSaveEffect(cloud.save_effect)).toEqual(['blinded']);
  });

  it('machine-readable persisting zone: 20-ft radius, lair_sand_cloud key, repeat_save', () => {
    expect(cloud.zone.radius_ft).toBe(20);
    expect(cloud.zone.effect_key).toBe('lair_sand_cloud');
    expect(cloud.zone.repeat_save).toBe(true);
    expect(cloud.zone.advisory).toMatch(/GM-enforced/);
    expect(cloud.duration).toMatch(/blinded 1 minute/i);
  });

  it('save row routes through handleSaveRoll with blinded conditions, zero damage formula', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: cloud,
      monsterName: 'Adult Brass Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(cloud.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(cloud, null, ['blinded']);
  });

  it('sibling Strong Wind row [0] untouched (MA-0074 structured STR push/prone row)', () => {
    expect(dragon.lair_actions[0].name).toBe('Strong Wind');
    expect(dragon.lair_actions[0].save_type).toBe('Strength');
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('save');
  });
});

// MA-0085: Adult Bronze Dragon lair_actions were a MISATTRIBUTED dict [0]
// (fog-cloud text carrying thunderclap numbers — save_dc 15 / Constitution /
// 1d10 Thunder / deafened) plus a raw STRING [1] holding the actual
// thunderclap mechanics (typo "1dlO"). [0] had NO name → "Unnamed lair
// actions 1" and both rows were inert (MV-24). Now: [0] is a named save-less
// FOG CLOUD zone row (MA-0043 no_save zone shape — chip → zone picker, NO
// save prompt); [1] is the named THUNDERCLAP save row that legitimately owns
// the DC 15 CON 1d10 Thunder + deafened numbers (typo fixed, dc_success none).
describe('MA-0085 adult-bronze-dragon fog cloud + thunderclap data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-bronze-dragon');
  const fog = dragon.lair_actions[0];
  const clap = dragon.lair_actions[1];

  it('[0] is now a NAMED clickable ZONE row (no longer nameless inert dict)', () => {
    expect(typeof fog).toBe('object');
    expect(fog.name).toBe('Fog Cloud');
    expect(isLairRowClickable(fog)).toBe(true);
    expect(lairRowAffordance(fog)).toBe('zone');
  });

  it('[0] fog cloud carries NO misattributed thunderclap fields (stripped)', () => {
    expect(fog.save_dc).toBeUndefined();
    expect(fog.save_type).toBeUndefined();
    expect(fog.damage_dice_primary).toBeUndefined();
    expect(fog.damage_type_primary).toBeUndefined();
    expect(fog.save_effect).toBeUndefined();
  });

  it('[0] canonical fog cloud is save-less zone: 20-ft radius, no_save, fog noun', () => {
    expect(fog.description).toMatch(/fog cloud spell/i);
    expect(fog.description).toMatch(/initiative count 20 on the next round/i);
    expect(fog.description).not.toMatch(/saving throw/i);
    expect(fog.zone.radius_ft).toBe(20);
    expect(fog.zone.no_save).toBe(true);
    expect(fog.zone.noun).toBe('fog');
    expect(fog.zone.effect_key).toBe('lair_fog_cloud');
    expect(fog.zone.advisory).toMatch(/no saving throw/i);
    expect(fog.zone.advisory).toMatch(/GM-enforced/i);
    expect(fog.duration).toMatch(/initiative count 20/i);
  });

  it('[1] thunderclap is now a structured clickable SAVE row named Thunderclap', () => {
    expect(typeof clap).toBe('object');
    expect(clap.name).toBe('Thunderclap');
    expect(isLairRowClickable(clap)).toBe(true);
    expect(lairRowAffordance(clap)).toBe('save');
  });

  it('[1] thunderclap now LEGITIMATELY owns DC 15 Constitution, 1d10 Thunder', () => {
    expect(clap.save_dc).toBe(15);
    expect(clap.save_type).toBe('Constitution');
    expect(clap.damage_dice_primary).toBe('1d10');
    expect(clap.damage_type_primary).toBe('Thunder');
    expect(clap.description).toMatch(/DC 15 Constitution saving throw/i);
    expect(clap.description).toMatch(/20-foot radius/i);
  });

  it('[1] typo fixed — no "1dlO" letter-O token anywhere in the row', () => {
    expect(JSON.stringify(clap)).not.toMatch(/1dlO/);
    expect(clap.description).toMatch(/5 \(1d10\) thunder damage/i);
    expect(clap.save_effect).toMatch(/5 \(1d10\) Thunder damage/i);
  });

  it('[1] dc_success none — canonical text states no half-on-success (full on fail)', () => {
    expect(clap.dc_success).toBe('none');
    expect(clap.description).not.toMatch(/half/i);
  });

  it('[1] save_effect vocabulary extracts ONLY deafened (MA-0017 failed-save seam)', () => {
    expect(clap.save_effect).toMatch(/deafened until the end of its next turn/i);
    expect(extractConditionsFromSaveEffect(clap.save_effect)).toEqual(['deafened']);
  });

  it('[0] fog zone routes through handleZone, zero save/attack/damage handlers', async () => {
    const handleZone = vi.fn();
    const res = await resolveLairRow({
      action: fog,
      monsterName: 'Adult Bronze Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll: vi.fn(),
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone,
    });
    expect(res).toEqual({ resolved: true, affordance: 'zone' });
    expect(handleZone).toHaveBeenCalledWith(fog);
  });

  it('[1] thunderclap routes through handleSaveRoll with 1d10 formula + deafened', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: clap,
      monsterName: 'Adult Bronze Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: '1d10',
      saveConditions: extractConditionsFromSaveEffect(clap.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(clap, '1d10', ['deafened']);
  });

  it('lair_fog_cloud te is registered in the target-effect registry (Lair group)', async () => {
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_fog_cloud');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Fog Cloud (Lair)');
    expect(def.group).toBe('Lair');
  });
});

// MA-0096: Adult Copper Dragon lair_actions[0] was a NAMELESS dict (MV-24) —
// save_dc 15 Dexterity + restrained authored behind the dead `row.name` gate
// (isLairRowClickable :26) → inert static branch, header "." rendered, save
// never reachable. Data-only fix (MA-0074 pattern): named "Spike Growth" +
// dc_success "none" (damageless restrained-only row, no half-damage
// boilerplate) arms the untouched MA-0024 seam → .mc-dice-link-lair chip →
// handleSaveRoll → MA-0017 damageless failed-save condition landing. Duration
// clause ("until the dragon uses this lair action again or until the dragon
// dies") stays verbatim advisory — GM-remove convention, no initiative-20
// cadence / zone-re-use consumer (MA-0024 design). Sibling mud row [1] is
// MA-0097 scope — must stay a raw string here.
describe('MA-0096 adult-copper-dragon spike growth data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-copper-dragon');
  const spike = dragon.lair_actions[0];

  it('row is now a structured clickable SAVE row named Spike Growth', () => {
    expect(typeof spike).toBe('object');
    expect(spike.name).toBe('Spike Growth');
    expect(isLairRowClickable(spike)).toBe(true);
    expect(lairRowAffordance(spike)).toBe('save');
  });

  it('authored save fields untouched: DC 15 Dexterity (canonical spike growth)', () => {
    expect(spike.save_dc).toBe(15);
    expect(spike.save_type).toBe('Dexterity');
    expect(spike.description).toMatch(/spike growth spell/i);
    expect(spike.description).toMatch(/20-foot radius/i);
    expect(spike.description).toMatch(/within 120 feet/i);
  });

  it('no damage authored — dc_success none suppresses half-damage boilerplate', () => {
    expect(spike.dc_success).toBe('none');
    expect(spike.damage_dice_primary).toBeUndefined();
    expect(spike.damage_type_primary).toBeUndefined();
    expect(spike.save_effect).not.toMatch(/damage/i);
  });

  it('save_effect vocabulary extracts ONLY restrained (MA-0017 damageless seam)', () => {
    expect(spike.save_effect).toBe('The target is restrained.');
    expect(extractConditionsFromSaveEffect(spike.save_effect)).toEqual(['restrained']);
  });

  it('duration clause kept verbatim in description (advisory — no lair cadence consumer)', () => {
    expect(spike.description).toMatch(/until the dragon uses this lair action again or until the dragon dies/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + restrained', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: spike,
      monsterName: 'Adult Copper Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(spike.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(spike, null, ['restrained']);
  });

  it('sibling mud row [1] structured as of MA-0097 (still names the mud mechanic)', () => {
    expect(typeof dragon.lair_actions[1]).toBe('object');
    expect(dragon.lair_actions[1].description).toMatch(/mud/i);
    expect(isLairRowClickable(dragon.lair_actions[1])).toBe(true);
  });
});

// MA-0097: Adult Copper Dragon lair_actions[1] was a raw STRING (MV-24
// fingerprint — no name, no keys: string short-circuit to the static span
// branch in MonsterCardBody.jsx, isLairRowClickable never reached, save
// unreachable). Now a structured save+zone row mirroring the VERIFIED
// MA-0063/0075 sand-cloud shape: DEX DC 15, dc_success none (damageless),
// restrained until freed, persisting zone `lair_mud` (registered Lair-group
// te). Unmodelable clauses stay advisory prose (MA-0090/CLA-325 precedent):
// SQUARE area (modeled 10-ft radius), STR-check-to-free, initiative-20
// harden→DC 20, and 2-ft-per-1-ft movement have zero consumers (§7).
describe('MA-0097 adult-copper-dragon liquid mud data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-copper-dragon');
  const mud = dragon.lair_actions[1];

  it('row is now a structured clickable SAVE row named Liquid Mud', () => {
    expect(typeof mud).toBe('object');
    expect(mud.name).toBe('Liquid Mud');
    expect(isLairRowClickable(mud)).toBe(true);
    expect(lairRowAffordance(mud)).toBe('save');
  });

  it('authored save fields: DC 15 Dexterity, dc_success none (no damage)', () => {
    expect(mud.save_dc).toBe(15);
    expect(mud.save_type).toBe('Dexterity');
    expect(mud.dc_success).toBe('none');
    expect(mud.damage_dice_primary).toBeUndefined();
    expect(mud.damage_type_primary).toBeUndefined();
    expect(mud.save_effect).toMatch(/deals no damage/i);
  });

  it('save_effect vocabulary extracts ONLY restrained (MA-0017 damageless seam)', () => {
    expect(extractConditionsFromSaveEffect(mud.save_effect)).toEqual(['restrained']);
  });

  it('machine-readable zone: 10-ft radius, lair_mud key, mud noun, no repeat save', () => {
    expect(mud.zone.radius_ft).toBe(10);
    expect(mud.zone.effect_key).toBe('lair_mud');
    expect(mud.zone.noun).toBe('mud');
    expect(mud.zone.repeat_save).toBe(false);
    expect(mud.zone.advisory).toMatch(/square/i);
    expect(mud.zone.advisory).toMatch(/GM-enforced/i);
    expect(mud.duration).toMatch(/initiative count 20/i);
  });

  it('description kept verbatim from the original string row (all clauses preserved)', () => {
    expect(mud.description).toMatch(/10-foot-square area/i);
    expect(mud.description).toMatch(/3-foot-deep mud/i);
    expect(mud.description).toMatch(/DC 15 Dexterity saving throw/i);
    expect(mud.description).toMatch(/DC 15 Strength check/i);
    expect(mud.description).toMatch(/Moving 1 foot in the mud costs 2 feet of movement/i);
    expect(mud.description).toMatch(/initia­?tive count 20 on the next round, the mud hardens/i);
    expect(mud.description).toMatch(/Strength DC to work free increases to 20/i);
  });

  it('STR-free / harden / movement-cost residuals advisory in save_effect prose', () => {
    expect(mud.save_effect).toMatch(/restrained until freed by a DC 15 Strength check action/i);
    expect(mud.save_effect).toMatch(/Moving 1 foot in the mud costs 2 feet of movement — GM-enforced/i);
    expect(mud.save_effect).toMatch(/mud hardens/i);
    expect(mud.save_effect).toMatch(/no initiative-20 lair seam/i);
  });

  it('save row routes through handleSaveRoll with restrained conditions, zero damage formula', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: mud,
      monsterName: 'Adult Copper Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(mud.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(mud, null, ['restrained']);
  });

  it('lair_mud te is registered in the target-effect registry (Lair group)', async () => {
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_mud');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Liquid Mud (Lair)');
    expect(def.group).toBe('Lair');
  });

  it('sibling spike growth row [0] untouched (MA-0096 structured DEX save row)', () => {
    expect(dragon.lair_actions[0].name).toBe('Spike Growth');
    expect(dragon.lair_actions[0].save_type).toBe('Dexterity');
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('save');
  });

  it('ancient-copper-dragon scope guard: its rows are NOT touched by this fix', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-copper-dragon');
    expect(ancient.lair_actions[0]).toEqual(expect.any(String));
    expect(ancient.lair_actions[1].name).toBeUndefined();
  });
});
