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
import { extractConditionsFromSaveEffect, parseDreamPlaneBanishClause, parseBanishTransportClause } from '../../components/encounter/MonsterCardHelpers.js';
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

// MA-0137 (clean-code note): Adult Silver Dragon lair_actions[1] cold-wind
// row carried the letter-O damage typo "1dlO" (MA-0085 family) — MV-12
// suppresses the unparseable token, so the canonical 5 (1d10) cold damage was
// silently dropped. Data-only fix: author "1d10" explicitly. MA-0140 has
// since structured the row — typo lock now guards the structured description.
describe('MA-0137 adult-silver-dragon lair cold-wind typo data lock', () => {
  const wind = monstersData.find(m => m.index === 'adult-silver-dragon').lair_actions[1];

  it('[1] cold wind authors canonical 1d10 — no letter-O token', () => {
    expect(JSON.stringify(wind)).not.toMatch(/1dlO/);
    expect(wind.description).toMatch(/5 \(1d10\) cold damage/i);
    expect(wind.description).toMatch(/DC 15 Constitution saving throw/i);
  });
});

// MA-0140: Adult Silver Dragon lair_actions[0] was a NAMELESS dict (MV-24) —
// its description is the fog-cloud text while its machine-readable save legs
// (save_dc 15 / Constitution / 1d10 Cold / half-on-success) are the COLD-WIND
// lair action's numbers, misfiled intra-row (MA-0117 shape). Name-gate
// (isLairRowClickable :26) killed clickability → inert static "." row, while
// [1] cold wind was an inert raw string. Split fix (MA-0107 vocabulary):
// [0] → named ADVISORY row "Fog Cloud" (advisory:"fog_cloud" → honest
// "casts fog cloud" ability_use record, initiative-20 cadence GM-enforced —
// no initiative lair seam), misfiled save legs STRIPPED; [1] → named
// structured SAVE row "Cold Wind" legitimately owning DC 15 CON 1d10 Cold
// half-on-success (MA-0085 thunderclap family). lair_fog_cloud te stays the
// MA-0085 registration (no re-register). Gas/flame extinguishing clauses and
// the 120-ft area gate have no consumers — GM-advisory prose residuals.
describe('MA-0140 adult-silver-dragon fog cloud advisory + cold wind save data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-silver-dragon');
  const fog = dragon.lair_actions[0];
  const wind = dragon.lair_actions[1];

  it('[0] is now a named clickable ADVISORY row (was nameless inert dict)', () => {
    expect(typeof fog).toBe('object');
    expect(fog.name).toBe('Fog Cloud');
    expect(isLairRowClickable(fog)).toBe(true);
    expect(lairRowAffordance(fog)).toBe('advisory');
  });

  it('[0] misfiled cold-wind save legs STRIPPED (they belong to row [1])', () => {
    expect(fog.save_dc).toBeUndefined();
    expect(fog.save_type).toBeUndefined();
    expect(fog.damage_dice_primary).toBeUndefined();
    expect(fog.damage_type_primary).toBeUndefined();
    expect(fog.save_effect).toBeUndefined();
  });

  it('[0] description kept verbatim (fog cloud spell, initiative count 20)', () => {
    expect(fog.description).toBe('The dragon creates fog as if it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round.');
  });

  it('[0] advisory click logs ability_use record, zero save/attack/damage', async () => {
    const logs = [];
    const res = await resolveLairRow({
      action: fog,
      monsterName: 'Adult Silver Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll: vi.fn(),
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toMatch(/casts fog cloud/i);
    expect(logs[0].description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(logs[0].description).not.toMatch(/save DC/i);
  });

  it('[1] is now a named structured clickable SAVE row (was inert raw string)', () => {
    expect(typeof wind).toBe('object');
    expect(wind.name).toBe('Cold Wind');
    expect(isLairRowClickable(wind)).toBe(true);
    expect(lairRowAffordance(wind)).toBe('save');
  });

  it('[1] cold wind legitimately owns DC 15 Constitution, 1d10 Cold half-on-success', () => {
    expect(wind.save_dc).toBe(15);
    expect(wind.save_type).toBe('Constitution');
    expect(wind.damage_dice_primary).toBe('1d10');
    expect(wind.damage_type_primary).toBe('Cold');
    expect(wind.dc_success).toBe('half');
    expect(wind.description).toMatch(/DC 15 Constitution saving throw/i);
    expect(wind.description).toMatch(/within 120 feet/i);
  });

  it('[1] save_effect vocabulary extracts no conditions (pure damage row)', () => {
    expect(wind.save_effect).toMatch(/5 \(1d10\) cold damage/i);
    expect(wind.save_effect).toMatch(/[Hh]alf damage/i);
    expect(extractConditionsFromSaveEffect(wind.save_effect)).toEqual([]);
  });

  it('[1] save row routes through handleSaveRoll with 1d10 formula, zero conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: wind,
      monsterName: 'Adult Silver Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: '1d10',
      saveConditions: extractConditionsFromSaveEffect(wind.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(wind, '1d10', []);
  });

  it('lair_fog_cloud te remains the single MA-0085 registration (no duplicate)', async () => {
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_fog_cloud');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Fog Cloud (Lair)');
    expect(def.group).toBe('Lair');
  });

  it('sibling scope guard: adult bronze fog zone row untouched (MA-0085 zone shape)', () => {
    const bronze = monstersData.find(m => m.index === 'adult-bronze-dragon');
    expect(bronze.lair_actions[0].name).toBe('Fog Cloud');
    expect(lairRowAffordance(bronze.lair_actions[0])).toBe('zone');
    expect(bronze.lair_actions[0].zone.effect_key).toBe('lair_fog_cloud');
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

// MA-0107: Adult Gold Dragon lair_actions were (a) a NAMELESS dict [0] whose
// description is the self-buff "glimpse the future" text while its authored
// save_dc/save_type/save_effect were ORPHANED from the raw-string row [1]
// (the actual dream-plane banishment prose) — name-gate (monsterLairActions
// .js:26) killed clickability on [0], and even lifted, its affordance would
// run the WRONG mechanic (banish save vs advantage self-buff); and (b) the
// raw string [1] short-circuited to the static span branch. Both rows inert,
// forced clicks zero delta, zero log (live baseline confirmed 2026-09-14).
// Split fix: [0] → named ADVISORY row (advantage-until-init-20 self-buff =
// CLA-325/MA-0024 advisory vocabulary, save fields stripped); [1] → named
// structured SAVE row (DC 15 Charisma, dc_success none — no damage) whose
// save_effect arms the registered `lair_dream_plane` te producer at the
// MA-0038/0104 failed-save seam (escape contest + initiative-20 expiry +
// reappearance stay GM-enforced advisory — no initiative lair seam §7).
describe('MA-0107 adult-gold-dragon glimpse future + dream plane banishment data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-gold-dragon');
  const glimpse = dragon.lair_actions[0];
  const banish = dragon.lair_actions[1];

  it('[0] is now a named clickable ADVISORY row (was nameless inert dict)', () => {
    expect(typeof glimpse).toBe('object');
    expect(glimpse.name).toBe('Glimpse the Future');
    expect(isLairRowClickable(glimpse)).toBe(true);
    expect(lairRowAffordance(glimpse)).toBe('advisory');
  });

  it('[0] orphaned save metadata STRIPPED (advantage self-buff is not a save)', () => {
    expect(glimpse.save_dc).toBeUndefined();
    expect(glimpse.save_type).toBeUndefined();
    expect(glimpse.save_effect).toBeUndefined();
    expect(glimpse.damage_dice_primary).toBeUndefined();
  });

  it('[0] description kept verbatim (advantage until initiative count 20)', () => {
    expect(glimpse.description).toBe('The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round.');
  });

  it('[0] advisory click logs ability_use record, zero save/attack/damage', async () => {
    const logs = [];
    const res = await resolveLairRow({
      action: glimpse,
      monsterName: 'Adult Gold Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll: vi.fn(),
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toMatch(/casts glimpse the future/i);
    expect(logs[0].description).toMatch(/initiative 20 \(GM-enforced/i);
  });

  it('[1] is now a named structured SAVE row (was inert raw string)', () => {
    expect(typeof banish).toBe('object');
    expect(banish.name).toBe('Dream Plane Banishment');
    expect(isLairRowClickable(banish)).toBe(true);
    expect(lairRowAffordance(banish)).toBe('save');
  });

  it('[1] save fields: DC 15 Charisma, dc_success none (no damage authored)', () => {
    expect(banish.save_dc).toBe(15);
    expect(banish.save_type).toBe('Charisma');
    expect(banish.dc_success).toBe('none');
    expect(banish.damage_dice_primary).toBeUndefined();
    expect(banish.damage_type_primary).toBeUndefined();
  });

  it('[1] description kept verbatim from the original string row (soft hyphen preserved)', () => {
    expect(banish.description).toMatch(/^One creature the dragon can see within 120 feet of it must succeed on a DC 15 Charisma saving throw or be banished to a dream plane/i);
    expect(banish.description).toMatch(/exis\xAD? tence the dragon has imagined into being/i);
    expect(banish.description).toMatch(/If the creature wins, it escapes the dream plane/i);
    expect(banish.description).toMatch(/effect ends on initiative count 20 on the next round/i);
    expect(banish.description).toMatch(/reappears in the space it left or in the nearest unoccupied space/i);
  });

  it('[1] save_effect arms the lair_dream_plane te producer (MA-0104 parse shape)', () => {
    expect(parseDreamPlaneBanishClause(banish.save_effect)).toEqual({ effect: 'lair_dream_plane' });
  });

  it('[1] dream-plane wording NEVER matches the MA-0104 demiplane parser (distinct te)', () => {
    expect(parseBanishTransportClause(banish.save_effect)).toBeNull();
  });

  it('[1] save_effect has no canonical condition word — te is the sole enforcement (MA-0017 stays inert)', () => {
    expect(extractConditionsFromSaveEffect(banish.save_effect)).toEqual([]);
  });

  it('[1] advisory prose: escape contest + initiative-20 expiry + reappearance GM-enforced', () => {
    expect(banish.save_effect).toMatch(/contested by the dragon/i);
    expect(banish.save_effect).toMatch(/GM-enforced/i);
    expect(banish.duration).toMatch(/initiative count 20 on the next round/i);
    expect(banish.duration).toMatch(/contested Charisma check/i);
  });

  it('[1] save row routes through handleSaveRoll, zero damage formula', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: banish,
      monsterName: 'Adult Gold Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(banish.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(banish, null, []);
  });

  it('lair_dream_plane te is registered in the target-effect registry (Lair group)', async () => {
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_dream_plane');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Dream Plane (Lair)');
    expect(def.group).toBe('Lair');
    expect(def.description).toMatch(/initiative count 20/i);
  });

  it('ancient-gold-dragon scope guard: its rows are NOT touched by this fix', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-gold-dragon');
    expect(ancient.lair_actions[0]).toEqual(expect.any(String));
    expect(ancient.lair_actions[1].name).toBeUndefined();
    expect(ancient.lair_actions[1].save_effect).toBeUndefined();
  });
});

// MA-0117: Adult Green Dragon lair_actions[0] was a NAMELESS dict (MV-24)
// with INTRA-ROW DRIFT — save_dc 15 ✓ but save_type Wisdom + charm
// save_effect + 4d8 Piercing damage, all canonically belonging to sibling
// rows ([1] thorn wall 4d8 piercing, [2] fog Wisdom-charm). Behind the dead
// `row.name` gate (isLairRowClickable :26) the row was inert AND
// wrong-mechanic if it had ever armed. Data-only fix (MA-0096 pattern):
// named "Grasping Roots", de-drifted to its own STR DC 15 → restrained
// mechanics, dc_success "none" (damageless), no damage fields — arms the
// untouched MA-0024 seam → handleSaveRoll → MA-0017 damageless failed-save
// condition landing. Difficult-terrain zone, DC 15 STR escape action, and
// wilt-when-reused/on-death expiry stay advisory prose (§7 — no zone/
// rescue-engine/cadence consumer). Sibling rows [1]/[2] stay raw strings —
// MA-0118/MA-0119 own those rows.
describe('MA-0117 adult-green-dragon grasping roots data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-green-dragon');
  const roots = dragon.lair_actions[0];

  it('row is now a structured clickable SAVE row named Grasping Roots', () => {
    expect(typeof roots).toBe('object');
    expect(roots.name).toBe('Grasping Roots');
    expect(isLairRowClickable(roots)).toBe(true);
    expect(lairRowAffordance(roots)).toBe('save');
  });

  it('save metadata de-drifted to own mechanics: DC 15 Strength (not Wisdom)', () => {
    expect(roots.save_dc).toBe(15);
    expect(roots.save_type).toBe('Strength');
    expect(roots.description).toMatch(/Grasping roots and vines/i);
    expect(roots.description).toMatch(/20-foot radius/i);
    expect(roots.description).toMatch(/DC 15 Strength saving throw/i);
  });

  it('drift trio removed: no Wisdom save_type, no charm save_effect, no 4d8 piercing', () => {
    expect(roots.save_type).not.toBe('Wisdom');
    expect(roots.save_effect).not.toMatch(/charmed/i);
    expect(roots.save_effect).not.toMatch(/initiative count 20/i);
    expect(roots.damage_dice_primary).toBeUndefined();
    expect(roots.damage_type_primary).toBeUndefined();
    expect(roots.save_effect).not.toMatch(/damage/i);
  });

  it('no damage authored — dc_success none suppresses half-damage boilerplate', () => {
    expect(roots.dc_success).toBe('none');
  });

  it('save_effect vocabulary extracts ONLY restrained (MA-0017 damageless seam)', () => {
    expect(roots.save_effect).toBe('The target is restrained by the roots and vines.');
    expect(extractConditionsFromSaveEffect(roots.save_effect)).toEqual(['restrained']);
  });

  it('advisory residuals annotated in description: difficult terrain, escape action, wilt expiry (GM-enforced, no consumers)', () => {
    expect(roots.description).toMatch(/difficult terrain is GM-enforced/i);
    expect(roots.description).toMatch(/DC 15 Strength action to break free/i);
    expect(roots.description).toMatch(/wilt.*GM-enforced/i);
    expect(roots.description).toMatch(/no rescue-engine.*consumer|no zone\/movement-cost consumer/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + restrained', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: roots,
      monsterName: 'Adult Green Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(roots.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(roots, null, ['restrained']);
  });

  it('sibling rows: [1] thorn wall and [2] fog charm now structured (MA-0118/MA-0119)', () => {
    expect(dragon.lair_actions[1]).toEqual(expect.any(Object));
    expect(dragon.lair_actions[1].name).toBe('Wall of Thorns');
    expect(dragon.lair_actions[2]).toEqual(expect.any(Object));
    expect(dragon.lair_actions[2].name).toBe('Fog Charm');
  });
});

// MA-0118: Adult Green Dragon lair_actions[1] was a RAW STRING
// (MA-0097/MA-0108 inert fingerprint) — behind the MonsterCardBody.jsx
// string short-circuit (:340) the row rendered prose with zero affordance:
// no DC 15 Dexterity roll, no 4d8 piercing, no push, no logs. Data-only fix
// (MA-0117 sibling pattern): named "Wall of Thorns" dict arming the MA-0024
// save seam — chip "DC 15 Dexterity" → handleSaveRoll → 4d8 Piercing with
// half-on-success block-save math (dc_success "half"). LAIR_ADVISORY_NOTE
// already covers initiative-20 cadence. Residuals stay advisory prose
// (§7 — no zone/object/movement-cost/lair-cadence consumer): recurring
// once-each-round contact saves, exact-distance push (MA-0079 parse expects
// "pushed up to N feet" — canonical is exact 5 ft, wording NOT falsified),
// wall object stats per 10-ft section, 4-ft-per-1-ft movement cost, and
// sinks-back-when-reused/on-death expiry.
describe('MA-0118 adult-green-dragon wall of thorns data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-green-dragon');
  const wall = dragon.lair_actions[1];

  it('row is now a structured clickable SAVE row named Wall of Thorns', () => {
    expect(typeof wall).toBe('object');
    expect(wall.name).toBe('Wall of Thorns');
    expect(isLairRowClickable(wall)).toBe(true);
    expect(lairRowAffordance(wall)).toBe('save');
  });

  it('save metadata: DC 15 Dexterity, 4d8 Piercing, half on success', () => {
    expect(wall.save_dc).toBe(15);
    expect(wall.save_type).toBe('Dexterity');
    expect(wall.damage_dice_primary).toBe('4d8');
    expect(wall.damage_type_primary).toBe('Piercing');
    expect(wall.dc_success).toBe('half');
  });

  it('description keeps verbatim canonical prose: wall shape, DC 15 DEX, push, recurring save, object stats', () => {
    expect(wall.description).toMatch(/wall of tangled brush bristling with thorns/i);
    expect(wall.description).toMatch(/60 feet long, 10 feet high, and 5 feet thick/i);
    expect(wall.description).toMatch(/DC 15 Dexterity saving throw/i);
    expect(wall.description).toMatch(/18 \(4d8\) piercing damage/i);
    expect(wall.description).toMatch(/pushed 5 feet out of the wall's space/i);
    expect(wall.description).toMatch(/once each round it's in contact with the wall/i);
    expect(wall.description).toMatch(/AC 5, 15 hit points/i);
    expect(wall.description).toMatch(/vulnerability to fire/i);
    expect(wall.description).toMatch(/resistance to bludgeoning and piercing/i);
    expect(wall.description).toMatch(/immunity to psychic/i);
    expect(wall.description).toMatch(/sinks back into the ground/i);
  });

  it('save_effect vocabulary: full 4d8 piercing + push prose; NO canonical condition extracted (damage-only leg)', () => {
    expect(wall.save_effect).toBe("The target takes 18 (4d8) piercing damage and is pushed 5 feet out of the wall's space.");
    expect(extractConditionsFromSaveEffect(wall.save_effect)).toEqual([]);
  });

  it('advisory residuals annotated in description: recurring cadence, push parse gap, wall object stats, movement cost, sinks-back expiry (GM-enforced, no consumers)', () => {
    expect(wall.description).toMatch(/recurring once-each-round contact-save cadence/i);
    expect(wall.description).toMatch(/pushed up to N feet/i);
    expect(wall.description).toMatch(/GM-enforced/i);
    expect(wall.description).toMatch(/no zone\/object\/movement-cost\/lair-cadence consumer/i);
  });

  it('save row routes through handleSaveRoll with 4d8 formula + zero conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: wall,
      monsterName: 'Adult Green Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: '4d8',
      saveConditions: extractConditionsFromSaveEffect(wall.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(wall, '4d8', []);
  });

  it('push clause NOT falsified: canonical exact "pushed 5 feet" does not match the MA-0079 up-to regex (documented residual, no new engine)', () => {
    expect(wall.save_effect).toMatch(/pushed 5 feet/);
    expect(wall.save_effect).not.toMatch(/pushed up to \d+ feet/i);
  });

  it('sibling rows untouched: [0] Grasping Roots stays de-drifted STR save, [2] fog charm now structured (MA-0119)', () => {
    expect(dragon.lair_actions[0].name).toBe('Grasping Roots');
    expect(dragon.lair_actions[0].save_type).toBe('Strength');
    expect(dragon.lair_actions[2]).toEqual(expect.any(Object));
    expect(dragon.lair_actions[2].name).toBe('Fog Charm');
  });
});

// MA-0119: Adult Green Dragon lair_actions[2] was a RAW STRING
// (MA-0097/MA-0118 inert fingerprint) — behind the MonsterCardBody.jsx
// string short-circuit (:339) the row rendered prose with zero affordance:
// no DC 15 Wisdom roll, no Charmed, no logs. Data-only fix (MA-0117/0118
// sibling pattern): named "Fog Charm" dict arming the untouched MA-0024
// save seam — chip "DC 15 Wisdom" → handleSaveRoll → MA-0017 damageless
// failed-save condition landing (Charmed via extractConditionsFromSaveEffect
// canonical vocabulary; dc_success "none" suppresses half-damage boilerplate,
// NO damage fields authored). LAIR_ADVISORY_NOTE already covers
// initiative-20 cadence. Residual stays advisory prose (§7 — no initiative
// lair seam): the "until initiative count 20 on the next round" expiry is
// GM-enforced (charmed persists until manually cleared), and the fog is
// not modeled as a zone/obscurement effect (no zone consumer, no lair_fog
// te registered).
describe('MA-0119 adult-green-dragon fog charm data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-green-dragon');
  const fog = dragon.lair_actions[2];

  it('row is now a structured clickable SAVE row named Fog Charm', () => {
    expect(typeof fog).toBe('object');
    expect(fog.name).toBe('Fog Charm');
    expect(isLairRowClickable(fog)).toBe(true);
    expect(lairRowAffordance(fog)).toBe('save');
  });

  it('save metadata: DC 15 Wisdom, damageless', () => {
    expect(fog.save_dc).toBe(15);
    expect(fog.save_type).toBe('Wisdom');
    expect(fog.dc_success).toBe('none');
    expect(fog.damage_dice_primary).toBeUndefined();
    expect(fog.damage_type_primary).toBeUndefined();
  });

  it('description keeps verbatim canonical prose: fog, 120 feet, DC 15 Wisdom, charmed, init-count-20 clause', () => {
    expect(fog.description).toMatch(/Magical fog billows around one creature/i);
    expect(fog.description).toMatch(/within 120 feet of it/i);
    expect(fog.description).toMatch(/DC 15 Wisdom saving throw/i);
    expect(fog.description).toMatch(/be charmed by the dragon until initiative count 20 on the next round/i);
  });

  it('save_effect vocabulary extracts ONLY charmed (MA-0017 damageless seam)', () => {
    expect(fog.save_effect).toBe('The target is charmed by the dragon.');
    expect(extractConditionsFromSaveEffect(fog.save_effect)).toEqual(['charmed']);
  });

  it('advisory residual annotated in description: init-count-20 expiry and fog zone are GM-enforced (no consumers)', () => {
    expect(fog.description).toMatch(/until initiative count 20 on the next round.*GM-enforced/i);
    expect(fog.description).toMatch(/no initiative lair seam/i);
    expect(fog.description).toMatch(/charmed condition persists until manually cleared/i);
    expect(fog.description).toMatch(/not modeled as a zone.*no zone consumer/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + charmed', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: fog,
      monsterName: 'Adult Green Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(fog.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(fog, null, ['charmed']);
  });

  it('sibling rows untouched: [0] Grasping Roots STR save, [1] Wall of Thorns DEX save (MA-0117/MA-0118)', () => {
    expect(dragon.lair_actions[0].name).toBe('Grasping Roots');
    expect(dragon.lair_actions[0].save_type).toBe('Strength');
    expect(dragon.lair_actions[1].name).toBe('Wall of Thorns');
    expect(dragon.lair_actions[1].save_type).toBe('Dexterity');
  });
});

// MA-0128: Adult Red Dragon lair_actions[0] magma geyser was a NAMELESS
// drifting dict (inert per MV-24/MA-0117 fingerprint) with structured-field
// drift: save_dc 13/Constitution vs description "DC 15 Dexterity" (the 13/CON
// pair belongs to row [2] volcanic gases) and a misfiled knocked-prone
// save_effect (belongs to row [1] tremor). Data-only fix mirrors the
// verified MA-0064/MA-0074 shape: named save row, dc_success "half"
// (geyser = half damage on success, no condition), dice untouched.
describe('MA-0128 adult-red-dragon magma geyser data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-red-dragon');
  const geyser = dragon.lair_actions[0];

  it('row is now a structured clickable SAVE row named Magma Geyser', () => {
    expect(typeof geyser).toBe('object');
    expect(geyser.name).toBe('Magma Geyser');
    expect(isLairRowClickable(geyser)).toBe(true);
    expect(lairRowAffordance(geyser)).toBe('save');
  });

  it('structured fields match the description and canonical SRD (DC 15 DEX, 6d6 Fire, half on success)', () => {
    expect(geyser.save_dc).toBe(15);
    expect(geyser.save_type).toBe('Dexterity');
    expect(geyser.damage_dice_primary).toBe('6d6');
    expect(geyser.damage_type_primary).toBe('Fire');
    expect(geyser.dc_success).toBe('half');
    expect(geyser.description).toMatch(/DC 15 Dexterity saving throw/i);
    expect(geyser.description).toMatch(/half as much damage on a successful one/i);
  });

  it('misfiled prone save_effect removed: zero condition extraction, zero saveConditions', () => {
    expect(geyser.save_effect).toBeUndefined();
    expect(extractConditionsFromSaveEffect(geyser.save_effect)).toEqual([]);
  });

  it('save row routes through handleSaveRoll with 6d6 formula and no conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: geyser,
      monsterName: 'Adult Red Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: '6d6',
      saveConditions: extractConditionsFromSaveEffect(geyser.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(geyser, '6d6', []);
  });

  it('sibling rows: [1] tremor now structured as of MA-0129; [2] volcanic gases structured as of MA-0130', () => {
    expect(typeof dragon.lair_actions[1]).toBe('object');
    expect(dragon.lair_actions[1].name).toBe('Tremor');
    expect(typeof dragon.lair_actions[2]).toBe('object');
    expect(dragon.lair_actions[2].name).toBe('Volcanic Gases');
  });
});

// MA-0129: Adult Red Dragon lair_actions[1] tremor knock-prone was a RAW
// STRING (MA-0097/MA-0118 inert fingerprint) — behind the MonsterCardBody.jsx
// string short-circuit (:339-340) the row rendered prose with zero affordance:
// no DC 15 Dexterity roll, no prone, no logs (live inert ×9, 2026-09-14).
// Data-only fix mirroring the VERIFIED MA-0074 Strong Wind damageless
// push/prone shape: named "Tremor" dict arming the untouched MA-0024 seam —
// chip "DC 15 Dexterity" → handleSaveRoll → 60-ft Radius picker (MA-0084
// sphereRadiusFeet on the verbatim "60-foot radius" prose) → MA-0017
// damageless failed-save condition landing (prone via extractConditionsFrom
// SaveEffect canonical vocabulary; dc_success "none" suppresses the MV-19/20
// half-damage boilerplate, NO damage fields authored). The dragon-exclusion
// and ground-only gate stay advisory prose (§7 — no ground-state/flying
// consumer; MA-0024 advisory vocabulary). Sibling rows: [0] Magma Geyser
// (MA-0128) and [2] volcanic gases raw string stay untouched.
describe('MA-0129 adult-red-dragon tremor data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-red-dragon');
  const tremor = dragon.lair_actions[1];

  it('row is now a structured clickable SAVE row named Tremor', () => {
    expect(typeof tremor).toBe('object');
    expect(tremor.name).toBe('Tremor');
    expect(isLairRowClickable(tremor)).toBe(true);
    expect(lairRowAffordance(tremor)).toBe('save');
  });

  it('save fields: DC 15 Dexterity, dc_success none (no damage authored)', () => {
    expect(tremor.save_dc).toBe(15);
    expect(tremor.save_type).toBe('Dexterity');
    expect(tremor.dc_success).toBe('none');
    expect(tremor.damage_dice_primary).toBeUndefined();
    expect(tremor.damage_type_primary).toBeUndefined();
    expect(tremor.save_effect).toMatch(/deals no damage/i);
  });

  it('save_effect vocabulary extracts ONLY prone (MA-0017 damageless seam)', () => {
    expect(tremor.save_effect).toBe('Failure: The target is knocked prone. Success: unaffected. This effect deals no damage.');
    expect(extractConditionsFromSaveEffect(tremor.save_effect)).toEqual(['prone']);
  });

  it('description keeps the canonical prose verbatim + advisory ground/flight exclusion', () => {
    expect(tremor.description).toMatch(/^A tremor shakes the lair in a 60-foot radius around the dragon\./i);
    expect(tremor.description).toMatch(/Each creature other than the dragon on the ground in that area must succeed on a DC 15 Dexterity saving throw or be knocked prone/i);
    expect(tremor.description).toMatch(/ground\/flight gate is GM-enforced/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + prone', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: tremor,
      monsterName: 'Adult Red Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(tremor.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(tremor, null, ['prone']);
  });

  it('sibling rows untouched: [0] Magma Geyser stays MA-0128 half-damage save row; [2] volcanic gases structured as of MA-0130', () => {
    expect(dragon.lair_actions[0].name).toBe('Magma Geyser');
    expect(dragon.lair_actions[0].dc_success).toBe('half');
    expect(typeof dragon.lair_actions[2]).toBe('object');
    expect(dragon.lair_actions[2].name).toBe('Volcanic Gases');
  });

  it('ancient-red-dragon scope guard: its nameless tremor dict is NOT touched by this fix', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-red-dragon');
    expect(ancient.lair_actions[1].name).toBeUndefined();
  });
});

// MA-0130: Adult Red Dragon lair_actions[2] volcanic gases was a RAW STRING
// (MA-0097/MA-0118 inert fingerprint) — behind the MonsterCardBody.jsx string
// short-circuit (:339-340) the row rendered prose with zero affordance: no
// DC 13 Constitution roll, no poisoned/incapacitated, no logs (live inert,
// 2026-09-15). Data-only fix byte-mirroring the VERIFIED MA-0075 zone-cloud
// shape (Blue→Brass sand cloud): named "Volcanic Gases" save+zone dict arming
// the untouched MA-0024 seam — chip → 20-ft Radius picker (zone.radius_ft at
// MonsterCardModal breathAoeShape :52, before the MA-0084 prose path) →
// zone-arm te `lair_volcanic_gas` + tracking key + arm log → per-target save
// at DC 13 CON → poisoned + incapacitated on fail via the MA-0017/MA-0063
// damageless grant (canonical vocabulary; dc_success "none" suppresses the
// MV-19/20 half-damage boilerplate on BOTH surfaces). The RAW turn-start
// repeat save and initiative-count-20 cloud cadence stay GM-advisory
// (no initiative-20 lair seam, no turn-start zone-save consumer for lair
// clouds — MA-0024/MA-0075 residual). Sibling rows [0]/[1] untouched.
describe('MA-0130 adult-red-dragon volcanic gases data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-red-dragon');
  const cloud = dragon.lair_actions[2];

  it('row is now a structured clickable SAVE row named Volcanic Gases', () => {
    expect(typeof cloud).toBe('object');
    expect(cloud.name).toBe('Volcanic Gases');
    expect(isLairRowClickable(cloud)).toBe(true);
    expect(lairRowAffordance(cloud)).toBe('save');
  });

  it('save fields: DC 13 Constitution, dc_success none (no damage authored)', () => {
    expect(cloud.save_dc).toBe(13);
    expect(cloud.save_type).toBe('Constitution');
    expect(cloud.dc_success).toBe('none');
    expect(cloud.damage_dice_primary).toBeUndefined();
    expect(cloud.damage_type_primary).toBeUndefined();
    expect(cloud.save_effect).toMatch(/deals no damage/i);
  });

  it('save_effect vocabulary extracts ONLY incapacitated + poisoned (MA-0017 damageless seam)', () => {
    expect(cloud.save_effect).toBe('Failure: The target is poisoned until the end of its turn and is incapacitated while poisoned in this way. Success: unaffected. This effect deals no damage.');
    expect(extractConditionsFromSaveEffect(cloud.save_effect)).toEqual(['incapacitated', 'poisoned']);
  });

  it('machine-readable persisting zone: 20-ft radius, lair_volcanic_gas key, repeat_save', () => {
    expect(cloud.zone.radius_ft).toBe(20);
    expect(cloud.zone.effect_key).toBe('lair_volcanic_gas');
    expect(cloud.zone.repeat_save).toBe(true);
    expect(cloud.zone.advisory).toMatch(/GM-enforced/);
    expect(cloud.duration).toMatch(/poisoned until end of turn/i);
    expect(cloud.duration).toMatch(/incapacitated while poisoned/i);
  });

  it('description carries the verbatim mechanics (20-ft sphere, DC 13 CON, poisoned, incapacitated, initiative 20)', () => {
    expect(cloud.description).toMatch(/^Volcanic gases form a cloud in a 20-foot-radius sphere centered on a point the dragon can see within 120 feet of it\./i);
    expect(cloud.description).toMatch(/lasts until initiative count 20 on the next round/i);
    expect(cloud.description).toMatch(/starts its turn in the cloud must succeed on a DC 13 Constitution saving throw or be poisoned until the end of its turn/i);
    expect(cloud.description).toMatch(/While poisoned in this way, a creature is incapacitated/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + poisoned/incapacitated', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: cloud,
      monsterName: 'Adult Red Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(cloud.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(cloud, null, ['incapacitated', 'poisoned']);
  });

  it('lair_volcanic_gas te is registered in the target-effect registry (Lair group)', async () => {
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_volcanic_gas');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Volcanic Gas (Lair)');
    expect(def.group).toBe('Lair');
  });

  it('sibling rows untouched: [0] Magma Geyser half-damage save row; [1] Tremor damageless save row', () => {
    expect(dragon.lair_actions[0].name).toBe('Magma Geyser');
    expect(dragon.lair_actions[0].dc_success).toBe('half');
    expect(dragon.lair_actions[1].name).toBe('Tremor');
    expect(dragon.lair_actions[1].save_dc).toBe(15);
  });

  it('ancient-red-dragon scope guard: its nameless volcanic-gases dict is NOT touched by this fix', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-red-dragon');
    expect(ancient.lair_actions[2].name).toBeUndefined();
    expect(ancient.lair_actions[2].zone).toBeUndefined();
  });
});

// MA-0149: Adult White Dragon lair_actions[0] freezing fog was a NAMELESS
// dict (MV-24/MA-0118 inert fingerprint) — its save legs (DC 10 Constitution,
// 3d6 Cold, half-on-success) fully matched the verbatim description prose
// (manifest agreed, no drift), but the isLairRowClickable name-gate
// (monsterLairActions.js:26) killed clickability → static "." row, zero
// affordance, zero save prompt, zero damage, zero logs (live inert,
// 2026-09-14). Data-only fix mirroring the VERIFIED MA-0128 shape: named
// "Freezing Fog" save dict + dc_success "half" (prose: "half as much damage
// on a successful one"), save legs untouched — chip "DC 10 Constitution" →
// handleSaveRoll → MA-0084 radius picker (sphereRadiusFeet on the verbatim
// "20-foot-radius sphere" prose, NO zone field needed MA-0129 precedent),
// full-on-fail / floor-half untouched. End-of-turn re-damage, heavily
// obscured area, wind dispersal and initiative-20 cadence stay GM-advisory
// prose residuals (no turn-end zone-damage consumer, no initiative lair
// seam — MA-0024 residual). Sibling rows [1] ice shards / [2] wall of ice
// raw strings stay static by design.
describe('MA-0149 adult-white-dragon freezing fog data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-white-dragon');
  const fog = dragon.lair_actions[0];

  it('row is now a structured clickable SAVE row named Freezing Fog (was nameless inert dict)', () => {
    expect(typeof fog).toBe('object');
    expect(fog.name).toBe('Freezing Fog');
    expect(isLairRowClickable(fog)).toBe(true);
    expect(lairRowAffordance(fog)).toBe('save');
  });

  it('save fields: DC 10 Constitution, 3d6 Cold, dc_success half (prose-agreed)', () => {
    expect(fog.save_dc).toBe(10);
    expect(fog.save_type).toBe('Constitution');
    expect(fog.damage_dice_primary).toBe('3d6');
    expect(fog.damage_type_primary).toBe('Cold');
    expect(fog.dc_success).toBe('half');
    expect(fog.description).toMatch(/DC 10 Constitution saving throw/i);
    expect(fog.description).toMatch(/half as much damage on a successful one/i);
    expect(fog.description).toMatch(/20-foot-radius sphere/i);
  });

  it('no save_effect authored — zero condition extraction (pure damage row)', () => {
    expect(fog.save_effect).toBeUndefined();
    expect(extractConditionsFromSaveEffect(fog.save_effect)).toEqual([]);
  });

  it('save row routes through handleSaveRoll with 3d6 formula and no conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: fog,
      monsterName: 'Adult White Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: '3d6',
      saveConditions: extractConditionsFromSaveEffect(fog.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(fog, '3d6', []);
  });

  it('sibling rows untouched: [1] ice shards and [2] wall of ice stay raw strings', () => {
    expect(typeof dragon.lair_actions[1]).toBe('string');
    expect(typeof dragon.lair_actions[2]).toBe('string');
  });

  it('ancient-white-dragon scope guard: its nameless fog dict (with save_effect) is NOT touched by this fix', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-white-dragon');
    expect(ancient.lair_actions[0].name).toBeUndefined();
    expect(ancient.lair_actions[0].save_effect).toBeDefined();
    expect(ancient.lair_actions[0].dc_success).toBeUndefined();
  });

  it('young-white-dragon scope guard: its fog rows (string + nameless dict) untouched', () => {
    const young = monstersData.find(m => m.index === 'young-white-dragon');
    expect(typeof young.lair_actions[0]).toBe('string');
    expect(young.lair_actions[1].name).toBeUndefined();
  });
});
