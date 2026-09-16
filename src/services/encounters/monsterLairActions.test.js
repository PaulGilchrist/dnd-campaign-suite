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
import { canRollExpression } from '../dice/diceRoller.js';
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

  it('ancient-copper-dragon scope guard: rows since FIXED by MA-0210/MA-0211 (see those locks)', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-copper-dragon');
    expect(typeof ancient.lair_actions[0]).toBe('object');
    expect(ancient.lair_actions[0].name).toBe('Stone Spikes');
    expect(ancient.lair_actions[1].name).toBe('Liquid Mud');
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

  it('ancient-gold-dragon scope guard: [0] structured as of MA-0221; [1] byte-mirror of this row as of MA-0222', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-gold-dragon');
    expect(ancient.lair_actions[0]).toEqual(glimpse);
    expect(ancient.lair_actions[1]).toEqual(banish);
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

  it('ancient-red-dragon scope guard: its tremor dict structured later by MA-0243 (was nameless here)', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-red-dragon');
    expect(ancient.lair_actions[1].name).toBe('Tremor');
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

  it('ancient-red-dragon scope guard: its volcanic-gases dict structured later by MA-0244 (was nameless here)', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-red-dragon');
    expect(ancient.lair_actions[2].name).toBe('Volcanic Gases');
    expect(ancient.lair_actions[2].zone.effect_key).toBe('lair_volcanic_gas');
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
// seam — MA-0024 residual). Sibling row [1] ice shards was converted to a
// structured ATTACK row in MA-0150; [2] wall of ice advisory row in MA-0151.
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

  it('sibling rows: [1] ice shards structured ATTACK row (MA-0150), [2] wall of ice advisory row (MA-0151)', () => {
    expect(typeof dragon.lair_actions[1]).toBe('object');
    expect(typeof dragon.lair_actions[2]).toBe('object');
    expect(lairRowAffordance(dragon.lair_actions[2])).toBe('advisory');
  });

  it('ancient-white-dragon scope guard: its fog dict was nameless at MA-0149 time; structured later by MA-0263', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-white-dragon');
    expect(ancient.lair_actions[0].name).toBe('Freezing Fog');
    expect(ancient.lair_actions[0].save_effect).toBeDefined();
    expect(ancient.lair_actions[0].dc_success).toBe('half');
  });

  it('young-white-dragon scope guard: its fog rows (string + nameless dict) untouched', () => {
    const young = monstersData.find(m => m.index === 'young-white-dragon');
    expect(typeof young.lair_actions[0]).toBe('string');
    expect(young.lair_actions[1].name).toBeUndefined();
  });
});

// MA-0150: Adult White Dragon lair_actions[1] jagged ice shards was a raw
// string (MA-0118 inert fingerprint) → static text row, zero affordance,
// zero attack roll, zero damage, zero logs (live inert, 2026-09-14). Data-only
// fix: converted to a structured ATTACK row. The 'attack' affordance and its
// resolution leg ALREADY exist in the lair pipeline (lairRowAffordance
// monsterLairActions.js:43, resolveLairRow :99-101) and reuse the UNCHANGED
// monster attack seam (handleAttack(name, bonus, action)) — the same handler
// the Actions-row "+N" links and the legendary attack rows
// (resolveLegendaryRowMechanic, MonsterCardModal.jsx:263, Adult Black Dragon
// Water Surge-style range rows) ride. No new architecture. Data shape mirrors
// the VERIFIED ranged attack rows (Adult Brass Dragon Blazing Light:
// attack_bonus + range + damage dice/type): chip "Jagged Ice Shards" →
// handleAttack at +7 vs armed target AC, 3d6 Piercing auto-damage on hit,
// 120-ft range gate via resolveAttackRange/computeMapRangeState. "Up to
// three creatures" stays GM-click-per-target (MA-0068/MA-0009 convention —
// handleAttack adjudicates the single armed target per click); ceiling
// placement and initiative-20 cadence stay GM-advisory (MA-0024 residual).
describe('MA-0150 adult-white-dragon jagged ice shards data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-white-dragon');
  const shards = dragon.lair_actions[1];

  it('row is now a structured clickable ATTACK row named Jagged Ice Shards (was raw string)', () => {
    expect(typeof shards).toBe('object');
    expect(shards.name).toBe('Jagged Ice Shards');
    expect(isLairRowClickable(shards)).toBe(true);
    expect(lairRowAffordance(shards)).toBe('attack');
  });

  it('attack fields: +7 to hit, 120 ft range, 3d6 Piercing (prose-agreed)', () => {
    expect(shards.attack_bonus).toBe(7);
    expect(shards.range).toBe('120 ft.');
    expect(shards.damage_dice_primary).toBe('3d6');
    expect(shards.damage_type_primary).toBe('Piercing');
    expect(shards.description).toMatch(/\+7 to hit/i);
    expect(shards.description).toMatch(/up to three creatures/i);
    expect(shards.description).toMatch(/within 120 feet/i);
    expect(shards.description).toMatch(/10 \(3d6\) piercing damage/i);
  });

  it('no save authored on the row — zero save-prompt routing', () => {
    expect(shards.save_dc).toBeUndefined();
    expect(shards.save_effect).toBeUndefined();
    expect(extractConditionsFromSaveEffect(shards.save_effect)).toEqual([]);
  });

  it('attack row routes through the UNCHANGED monster attack seam: handleAttack(name, +7, row)', async () => {
    const handleAttack = vi.fn();
    const handleSaveRoll = vi.fn();
    const handleDamage = vi.fn();
    const res = await resolveLairRow({
      action: shards,
      monsterName: 'Adult White Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack,
      handleDamage,
    });
    expect(res).toEqual({ resolved: true, affordance: 'attack' });
    expect(handleAttack).toHaveBeenCalledWith('Jagged Ice Shards', 7, shards);
    expect(handleSaveRoll).not.toHaveBeenCalled();
    expect(handleDamage).not.toHaveBeenCalled();
  });

  it('sibling rows untouched: [0] Freezing Fog save row (MA-0149) and [2] wall of ice advisory row (MA-0151)', () => {
    expect(dragon.lair_actions[0].name).toBe('Freezing Fog');
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('save');
    expect(dragon.lair_actions[2].name).toBe('Wall of Ice');
    expect(lairRowAffordance(dragon.lair_actions[2])).toBe('advisory');
  });

  it('ancient-white-dragon scope guard: its jagged-ice row was raw at MA-0150 time; structured later by MA-0264 (adult numerics byte-mirrored)', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-white-dragon');
    expect(typeof ancient.lair_actions[1]).toBe('object');
    expect(ancient.lair_actions[1].name).toBe('Jagged Ice Shards');
    expect(ancient.lair_actions[1].attack_bonus).toBe(7);
    expect(ancient.lair_actions[1].description).toBe(shards.description);
  });

  it('young-white-dragon scope guard: its nameless jagged-ice dict is NOT touched by this fix', () => {
    const young = monstersData.find(m => m.index === 'young-white-dragon');
    const jagged = (young.lair_actions || []).find(r => typeof r === 'object' && r?.description?.includes('Jagged ice shards'));
    expect(jagged).toBeDefined();
    expect(jagged.name).toBeUndefined();
    expect(jagged.attack_bonus).toBeUndefined();
    expect(isLairRowClickable(jagged)).toBe(false);
  });
});

// MA-0151: Adult White Dragon lair_actions[2] wall of ice was a raw string
// (MA-0118 inert fingerprint) → static text row, zero affordance, zero logs
// (live inert, 2026-09-14). Data-only fix mirroring the MA-0107 fog-split
// advisory vocabulary ({name, advisory:"<key>", description}): the row is a
// pure terrain/object action — AC 5 / 30 hp per 10-ft section, fire
// vulnerability, acid/cold/necrotic/poison/psychic immunity, 5-ft push on
// appear, 120-ft placement gate, keyed replacement ("disappears when used
// again or the dragon dies") — with NO save, attack, or damage leg, so the
// MA-0024 save/attack/damage/zone affordances cannot adjudicate any clause.
// It arms the ADVISORY affordance instead: clickable .mc-dice-link-lair chip
// → advisory popup + spell-named ability_use record, initiative-20 cadence
// GM-enforced (§7 residual). True terrain-object enforcement (wall as
// persistent AC/HP object, push-on-appear, keyed replacement, a
// lair_wall_of_ice te) is the documented §7 residual — NOT built here.
describe('MA-0151 adult-white-dragon wall of ice advisory data lock', () => {
  const dragon = monstersData.find(m => m.index === 'adult-white-dragon');
  const wall = dragon.lair_actions[2];
  const VERBATIM = "The dragon creates an opaque wall of ice on a solid surface it can see within 120 feet of it. The wall can be up to 30 feet long, 30 feet high, and 1 foot thick. When the wall appears, each creature within its area is pushed 5 feet out of the wall's space, appearing on whichever side of the wall it wants. Each 10-foot sec\u00ad tion of the wall has AC 5, 30 hit points, vulnerability to fire damage, and immunity to acid, cold, necrotic, poison, and psychic damage. The wall disappears when the dragon uses this lair action again or when the dragon dies.";

  it('row is now a named clickable ADVISORY row (was inert raw string)', () => {
    expect(typeof wall).toBe('object');
    expect(wall.name).toBe('Wall of Ice');
    expect(wall.advisory).toBe('wall_of_ice');
    expect(isLairRowClickable(wall)).toBe(true);
    expect(lairRowAffordance(wall)).toBe('advisory');
  });

  it('description kept verbatim (terrain-object clauses retained as GM-advisory prose, §7 residual)', () => {
    expect(wall.description).toBe(VERBATIM);
    expect(wall.description).toMatch(/AC 5, 30 hit points/i);
    expect(wall.description).toMatch(/pushed 5 feet/i);
    expect(wall.description).toMatch(/within 120 feet/i);
    expect(wall.description).toMatch(/disappears when the dragon uses this lair action again/i);
  });

  it('no machine-readable enforcement keys — no fake save/attack/damage/zone authored', () => {
    expect(wall.save_dc).toBeUndefined();
    expect(wall.save_type).toBeUndefined();
    expect(wall.attack_bonus).toBeUndefined();
    expect(wall.damage_dice_primary).toBeUndefined();
    expect(wall.zone).toBeUndefined();
  });

  it('advisory click logs ability_use record, zero save/attack/damage/zone', async () => {
    const logs = [];
    const setPopupHtml = vi.fn();
    const res = await resolveLairRow({
      action: wall,
      monsterName: 'Adult White Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      handleSaveRoll: vi.fn(),
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone: vi.fn(),
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].abilityName).toBe('Wall of Ice');
    expect(logs[0].description).toMatch(/casts wall of ice/i);
    expect(logs[0].description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(logs[0].description).not.toMatch(/save DC/i);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringMatching(/Lair Action — Wall of Ice/));
  });

  it('sibling rows intact: [0] Freezing Fog save row (MA-0149), [1] Jagged Ice Shards attack row (MA-0150)', () => {
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('save');
    expect(dragon.lair_actions[0].save_dc).toBe(10);
    expect(lairRowAffordance(dragon.lair_actions[1])).toBe('attack');
    expect(dragon.lair_actions[1].attack_bonus).toBe(7);
  });

  it('no lair_wall_of_ice te registered (§7 residual model not built)', async () => {
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    expect(getEffectDefinition('lair_wall_of_ice')).toBeFalsy();
  });

  it('ancient-white-dragon scope guard: its wall of ice raw string was untouched by this fix; structured later by MA-0265', () => {
    const ancient = monstersData.find(m => m.index === 'ancient-white-dragon');
    expect(typeof ancient.lair_actions[2]).toBe('object');
    expect(ancient.lair_actions[2].name).toBe('Wall of Ice');
    expect(ancient.lair_actions[2].advisory).toBe('wall_of_ice');
    expect(isLairRowClickable(ancient.lair_actions[2])).toBe(true);
  });
});

// MA-0165: Ancient Black Dragon lair_actions[0] grasping tide was a NAMELESS
// dict (MV-24/MA-0118 inert fingerprint) — save_dc 15 / save_type Strength
// were authored and prose-agreed, but the isLairRowClickable name-gate
// (monsterLairActions.js:26) killed clickability → static "." row, zero
// chip, zero save prompt, zero prone, zero logs (live inert, 2026-09-15).
// Data-only fix mirroring the VERIFIED MA-0074 recipe: named "Grasping Tide"
// save dict + dc_success "none" (damageless pull/prone, success = nothing) +
// save_effect carrying the prone clause (canonical vocabulary; Adult Black
// "Water Surge" / Aboleth "Grasping Tide" precedent prose). Pull distance and
// "into the water" clauses stay GM-advisory prose (§7 residual — no grid/pull
// consumer app-wide). Sibling rows untouched; young-black-dragon's identical
// nameless dict is the scope guard.
describe('MA-0165 ancient-black-dragon grasping tide data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-black-dragon');
  const tide = dragon.lair_actions[0];
  const VERBATIM = 'Pools of water that the dragon can see within 120 feet of it surge outward in a grasping tide. Any creature on the ground within 20 feet of such a pool must succeed on a DC 15 Strength saving throw or be pulled up to 20 feet into the water and knocked prone.';

  it('row is now a structured clickable SAVE row named Grasping Tide (was nameless inert dict)', () => {
    expect(typeof tide).toBe('object');
    expect(tide.name).toBe('Grasping Tide');
    expect(isLairRowClickable(tide)).toBe(true);
    expect(lairRowAffordance(tide)).toBe('save');
  });

  it('save fields: DC 15 Strength, dc_success none (prose-agreed, success = nothing)', () => {
    expect(tide.save_dc).toBe(15);
    expect(tide.save_type).toBe('Strength');
    expect(tide.dc_success).toBe('none');
    expect(tide.description).toBe(VERBATIM);
    expect(tide.description).toMatch(/DC 15 Strength saving throw/i);
  });

  it('save_effect carries the prone clause — prone extracted on fail, no other conditions over-extracted', () => {
    expect(tide.save_effect).toMatch(/knocked prone/i);
    expect(extractConditionsFromSaveEffect(tide.save_effect)).toEqual(['prone']);
  });

  it('save row routes through handleSaveRoll with zero damage formula and prone conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: tide,
      monsterName: 'Ancient Black Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(tide.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(tide, null, ['prone']);
  });

  it('sibling rows untouched: [1] insect cloud dict (structured by MA-0166), [2] darkness dict (structured by MA-0167)', () => {
    expect(dragon.lair_actions[1].name).toBe('Insect Cloud');
    expect(dragon.lair_actions[1].damage_dice_primary).toBe('3d6');
    expect(dragon.lair_actions[2].name).toBe('Darkness');
    expect(dragon.lair_actions[2].zone.no_save).toBe(true);
  });

  it('young-black-dragon scope guard: its raw-string and identical nameless grasping-tide dict are NOT touched by this fix', () => {
    const young = monstersData.find(m => m.index === 'young-black-dragon');
    expect(typeof young.lair_actions[0]).toBe('string');
    expect(young.lair_actions[1].description).toBe(VERBATIM);
    expect(young.lair_actions[1].name).toBeUndefined();
    expect(young.lair_actions[1].dc_success).toBeUndefined();
    expect(young.lair_actions[1].save_effect).toBeUndefined();
    expect(isLairRowClickable(young.lair_actions[1])).toBe(false);
  });
});

// MA-0166: Ancient Black Dragon lair_actions[1] swarming-insect cloud was a
// NAMELESS dict (MA-0118/MV-24 inert fingerprint — same as MA-0165 [0] on
// this same monster): save_dc 15 / Constitution / 3d6 Piercing authored and
// prose-agreed, but the isLairRowClickable name-gate (monsterLairActions.js:26)
// killed clickability → static "." row, zero chip, zero picker, zero damage.
// Data-only fix byte-mirroring the VERIFIED Adult Black Dragon sibling
// template (MA-0042/MA-0075 recipe): named "Insect Cloud" save row +
// dc_success "half" + save_effect + persisting 20-ft zone
// (repeat_turn_end advisory — no turn-end zone-damage consumer, §7) +
// advisory duration. "cloudwhen" typo fixed to "cloud when" in the process.
// te `lair_insect_cloud` already registered (targetEffectDefinitions.js) —
// zoneTeForAction derives it from name+zone with zero code change.
describe('MA-0166 ancient-black-dragon insect cloud data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-black-dragon');
  const cloud = dragon.lair_actions[1];
  const adult = monstersData.find(m => m.index === 'adult-black-dragon');
  const adultCloud = adult.lair_actions[1];

  it('row is now a structured clickable SAVE row named Insect Cloud (was nameless inert dict)', () => {
    expect(typeof cloud).toBe('object');
    expect(cloud.name).toBe('Insect Cloud');
    expect(isLairRowClickable(cloud)).toBe(true);
    expect(lairRowAffordance(cloud)).toBe('save');
  });

  it('byte-mirrors the VERIFIED adult-black-dragon sibling row exactly (MA-0075 parity recipe)', () => {
    expect(cloud).toEqual(adultCloud);
    expect(Object.keys(cloud)).toEqual(Object.keys(adultCloud));
    expect(Object.keys(cloud.zone)).toEqual(Object.keys(adultCloud.zone));
  });

  it('authored save/damage fields: DC 15 Constitution, 3d6 Piercing, half on success', () => {
    expect(cloud.save_dc).toBe(15);
    expect(cloud.save_type).toBe('Constitution');
    expect(cloud.damage_dice_primary).toBe('3d6');
    expect(cloud.damage_type_primary).toBe('Piercing');
    expect(cloud.dc_success).toBe('half');
    expect(cloud.save_effect).toBe('Failure: 10 (3d6) piercing damage. Success: Half damage.');
  });

  it('machine-readable persisting zone: 20-ft radius, repeat_turn_end advisory, advisory duration', () => {
    expect(cloud.zone).toEqual({ radius_ft: 20, repeat_turn_end: true });
    expect(cloud.duration).toBe('until dismissed or used again (advisory)');
  });

  it('description fixed: "cloudwhen" typo repaired to "cloud when", canonical mechanics intact', () => {
    expect(cloud.description).not.toMatch(/cloudwhen/);
    expect(cloud.description).toMatch(/in the cloud when it appears/i);
    expect(cloud.description).toMatch(/20-foot-radius sphere/i);
    expect(cloud.description).toMatch(/DC 15 Constitution saving throw/i);
    expect(cloud.description).toMatch(/ends its turn in the cloud takes 10 \(3d6\) piercing damage/i);
  });

  it('damage save row: no condition over-extraction from the damage-only save_effect', () => {
    expect(extractConditionsFromSaveEffect(cloud.save_effect)).toEqual([]);
  });

  it('save row routes through handleSaveRoll with the full damage formula, zero attack/zone calls', async () => {
    const handleSaveRoll = vi.fn();
    const handleZone = vi.fn();
    const res = await resolveLairRow({
      action: cloud,
      monsterName: 'Ancient Black Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone,
      saveDamageFormula: '3d6',
      saveConditions: [],
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(cloud, '3d6', []);
    expect(handleZone).not.toHaveBeenCalled();
  });

  it('sibling rows untouched: [0] MA-0165 Grasping Tide, [2] MA-0167 Darkness zone dict', () => {
    expect(dragon.lair_actions[0].name).toBe('Grasping Tide');
    expect(dragon.lair_actions[2].name).toBe('Darkness');
    expect(dragon.lair_actions[2].zone.effect_key).toBe('lair_darkness');
  });

  it('young-black-dragon scope guard: its nameless insect-cloud dict [2] is NOT touched by this fix', () => {
    const young = monstersData.find(m => m.index === 'young-black-dragon');
    const youngCloud = young.lair_actions[2];
    expect(youngCloud.name).toBeUndefined();
    expect(youngCloud.dc_success).toBeUndefined();
    expect(youngCloud.zone).toBeUndefined();
    expect(youngCloud.description).toMatch(/cloudwhen/);
    expect(isLairRowClickable(youngCloud)).toBe(false);
  });

  it('adult-black-dragon template row untouched by this fix (still the verified MA-0042 shape)', () => {
    expect(adultCloud.name).toBe('Insect Cloud');
    expect(adultCloud.zone).toEqual({ radius_ft: 20, repeat_turn_end: true });
    expect(adultCloud.description).toMatch(/in the cloud when it appears/i);
  });
});

// MA-0167: Ancient Black Dragon lair_actions[2] save-less 15-ft magical
// darkness was a LEGACY RAW STRING (MA-0118 fingerprint) — it hit the
// typeof la === 'string' static branch in MonsterCardBody.jsx BEFORE the
// isLairRowClickable name-gate was even consulted → zero chip, zero
// affordance, zero handler, inert live (2026-09-15). Data-only fix
// byte-mirroring the VERIFIED MA-0085 save-less zone recipe + MA-0043
// darkness default-noun shape: named "Darkness" zone dict
// {radius_ft:15, no_save:true, effect_key:"lair_darkness", noun:"darkness"}
// → affordance 'zone' → zoneOnly picker "15-foot darkness. No saving throw"
// → te arm + ability_use log, ZERO save prompt, ZERO damage. te
// `lair_darkness` already registered (MA-0043) — no re-register, no code
// change. Light/darkvision/dispel clauses and dismiss persistence stay
// GM-advisory (§7 — no light-level model, no initiative-20 lair seam).
describe('MA-0167 ancient-black-dragon darkness zone data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-black-dragon');
  const dark = dragon.lair_actions[2];
  const adult = monstersData.find(m => m.index === 'adult-black-dragon');
  const adultDark = adult.lair_actions[2];
  const VERBATIM = "Magical darkness spreads from a point the dragon chooses within 60 feet of it, filling a 15-foot-radius sphere until the dragon dismisses it as an action, uses this lair action again, or dies. The darkness spreads around corners. A creature with darkvision can't see through this darkness, and nonmagical light can't illuminate it. If any of the effect's area overlaps with an area of light created by a spell of 2nd level or lower, the spell that created the light is dispelled.";

  it('row is now a structured clickable ZONE row named Darkness (was raw-string inert)', () => {
    expect(typeof dark).toBe('object');
    expect(dark.name).toBe('Darkness');
    expect(isLairRowClickable(dark)).toBe(true);
    expect(lairRowAffordance(dark)).toBe('zone');
  });

  it('description verbatim (manifest MA-0167), no fabricated save/dice fields', () => {
    expect(dark.description).toBe(VERBATIM);
    expect(dark.save_dc).toBeUndefined();
    expect(dark.save_type).toBeUndefined();
    expect(dark.damage_dice_primary).toBeUndefined();
    expect(dark.damage_type_primary).toBeUndefined();
    expect(dark.save_effect).toBeUndefined();
    expect(dark.dc_success).toBeUndefined();
  });

  it('save-less zone shape mirrors MA-0043/MA-0085 recipe: 15-ft, no_save, lair_darkness key, darkness noun', () => {
    expect(dark.zone).toEqual({ radius_ft: 15, no_save: true, effect_key: 'lair_darkness', noun: 'darkness' });
    expect(dark.zone.radius_ft).toBe(15);
    expect(dark.zone.no_save).toBe(true);
    expect(dark.zone.effect_key).toBe('lair_darkness');
    expect(dark.zone.noun).toBe('darkness');
    expect(dark.duration).toBe('until dismissed, used again, or dragon dies (advisory)');
  });

  it('te lair_darkness already registered (MA-0043) — no duplicate registration needed', async () => {
    const { getEffectDefinition, TARGET_EFFECT_DEFINITIONS } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_darkness');
    expect(def).toBeDefined();
    expect(def.label).toBe('Magical Darkness (Lair)');
    expect(def.group).toBe('Lair');
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'lair_darkness')).toHaveLength(1);
  });

  it('zone row routes through handleZone with ZERO save/attack/damage handlers', async () => {
    const handleZone = vi.fn();
    const handleSaveRoll = vi.fn();
    const setPopupHtml = vi.fn();
    const res = await resolveLairRow({
      action: dark,
      monsterName: 'Ancient Black Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone,
    });
    expect(res).toEqual({ resolved: true, affordance: 'zone' });
    expect(handleZone).toHaveBeenCalledWith(dark);
    expect(handleSaveRoll).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('sibling rows intact: [0] MA-0165 Grasping Tide save row, [1] MA-0166 Insect Cloud save row', () => {
    expect(dragon.lair_actions[0].name).toBe('Grasping Tide');
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('save');
    expect(dragon.lair_actions[1].name).toBe('Insect Cloud');
    expect(lairRowAffordance(dragon.lair_actions[1])).toBe('save');
    expect(dragon.lair_actions[1].zone).toEqual({ radius_ft: 20, repeat_turn_end: true });
  });

  it('MA-0043/MA-0085 template rows untouched (adult-black shroud, adult-bronze fog)', () => {
    expect(adultDark.name).toBe('Shroud of Darkness');
    expect(adultDark.zone.radius_ft).toBe(15);
    expect(adultDark.zone.effect_key).toBe('lair_darkness');
    const bronze = monstersData.find(m => m.index === 'adult-bronze-dragon');
    expect(bronze.lair_actions[0].name).toBe('Fog Cloud');
    expect(bronze.lair_actions[0].zone.noun).toBe('fog');
  });

  it('scope guard: legacy raw-string lair rows elsewhere never become clickable', () => {
    const young = monstersData.find(m => m.index === 'young-black-dragon');
    const rawRow = young.lair_actions.find(la => typeof la === 'string');
    expect(typeof rawRow).toBe('string');
    expect(isLairRowClickable(rawRow)).toBe(false);
    expect(lairRowAffordance(rawRow)).toBeNull();
  });
});

// MA-0176: Ancient Blue Dragon lair_actions[0] ceiling-collapse was a NAMELESS
// dict (MV-24/MA-0118 inert fingerprint — same shape as MA-0165 on ancient
// black): save_dc 15 / Dexterity authored and prose-agreed, but the
// isLairRowClickable name-gate (monsterLairActions.js:26) killed clickability
// → static "." row, zero chip, zero DC 15 DEX prompt, zero 3d6 bludgeoning,
// zero prone/restrained (live inert, 2026-09-15). Data-only fix byte-mirroring
// the VERIFIED adult-blue-dragon sibling template (MA-0074 pattern): named
// "Ceiling Collapse" save row + damage_dice_primary 3d6 + Bludgeoning +
// dc_success "half" + save_effect carrying the prone/restrained clause
// (canonical CONDITIONS vocabulary — extractConditionsFromSaveEffect arms both)
// + rescue_check advisory. Description verbatim + appended advisory clause:
// buried-state and the DC 10 Strength rescue are GM-enforced (no
// buried-state/rescue-engine consumer). Sibling rows [1]/[2] untouched
// (queued MA-0177/MA-0178).
describe('MA-0176 ancient-blue-dragon ceiling collapse data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-blue-dragon');
  const ceiling = dragon.lair_actions[0];
  const adult = monstersData.find(m => m.index === 'adult-blue-dragon');
  const adultCeiling = adult.lair_actions[0];
  const VERBATIM = 'Part of the ceiling collapses above one creature that the dragon can see within 120 feet of it. The creature must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) bludgeoning damage and be knocked prone and buried. The buried target is restrained and unable to breathe or stand up. A creature can take an action to make a DC 10 Strength check, ending the buried state on a success.';

  it('row is now a structured clickable SAVE row named Ceiling Collapse (was nameless inert dict)', () => {
    expect(typeof ceiling).toBe('object');
    expect(ceiling.name).toBe('Ceiling Collapse');
    expect(isLairRowClickable(ceiling)).toBe(true);
    expect(lairRowAffordance(ceiling)).toBe('save');
  });

  it('save/damage fields: DC 15 Dexterity, 3d6 Bludgeoning, half on success (prose-agreed)', () => {
    expect(ceiling.save_dc).toBe(15);
    expect(ceiling.save_type).toBe('Dexterity');
    expect(ceiling.damage_dice_primary).toBe('3d6');
    expect(ceiling.damage_type_primary).toBe('Bludgeoning');
    expect(ceiling.dc_success).toBe('half');
  });

  it('description verbatim + appended GM-enforced advisory clause for buried-state/DC 10 STR rescue', () => {
    expect(ceiling.description).toMatch(new RegExp(`^${VERBATIM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    expect(ceiling.description).toMatch(/GM-enforced \(no buried-state or rescue-engine consumer\)/);
  });

  it('save_effect byte-mirrors the VERIFIED adult-blue sibling row (prone+restrained clause, half on success)', () => {
    expect(ceiling.save_effect).toBe(adultCeiling.save_effect);
    expect(ceiling.save_effect).toMatch(/knocked prone and buried/i);
    expect(extractConditionsFromSaveEffect(ceiling.save_effect)).toEqual(['prone', 'restrained']);
  });

  it('rescue_check byte-mirrors the adult-blue sibling (DC 10 STR ends buried, advisory-only)', () => {
    expect(ceiling.rescue_check).toEqual(adultCeiling.rescue_check);
    expect(ceiling.rescue_check.ability).toBe('Strength');
    expect(ceiling.rescue_check.dc).toBe(10);
    expect(ceiling.rescue_check.ends).toBe('buried');
    expect(ceiling.rescue_check.advisory).toMatch(/GM-enforced \(no rescue-engine consumer\)/);
  });

  it('save row routes through handleSaveRoll with 3d6 formula and prone/restrained, zero attack/zone calls', async () => {
    const handleSaveRoll = vi.fn();
    const handleZone = vi.fn();
    const res = await resolveLairRow({
      action: ceiling,
      monsterName: 'Ancient Blue Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone,
      saveDamageFormula: '3d6',
      saveConditions: extractConditionsFromSaveEffect(ceiling.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(ceiling, '3d6', ['prone', 'restrained']);
    expect(handleZone).not.toHaveBeenCalled();
  });

  it('sibling rows: [1] sand cloud structured as of MA-0177; [2] lightning arcs structured as of MA-0178', () => {
    expect(dragon.lair_actions[1].name).toBe('Sand Cloud');
    expect(isLairRowClickable(dragon.lair_actions[1])).toBe(true);
    expect(dragon.lair_actions[2].name).toBe('Lightning Arcs');
    expect(dragon.lair_actions[2].save_dc).toBe(15);
    expect(dragon.lair_actions[2].save_type).toBe('Dexterity');
    expect(isLairRowClickable(dragon.lair_actions[2])).toBe(true);
  });

  it('adult-blue-dragon template row untouched by this fix (still the verified MA-0074 Falling Ceiling shape)', () => {
    expect(adultCeiling.name).toBe('Falling Ceiling');
    expect(adultCeiling.damage_type_primary).toBe('Bludgeoning');
    expect(adultCeiling.description).toBe(VERBATIM);
  });

  it('scope guard: nameless ceiling dicts elsewhere (page-90 variant, young-blue raw string) stay inert', () => {
    const variants = monstersData.filter(m => Array.isArray(m.lair_actions) &&
      m.lair_actions.some(la => typeof la === 'object' && la && la.description === VERBATIM && !la.name));
    expect(variants.length).toBeGreaterThanOrEqual(1);
    for (const v of variants) {
      expect(['adult-blue-dragon', 'ancient-blue-dragon']).not.toContain(v.index);
      for (const la of v.lair_actions) {
        if (typeof la === 'object' && la && la.description === VERBATIM) {
          expect(la.name).toBeUndefined();
          expect(isLairRowClickable(la)).toBe(false);
        }
      }
    }
    const young = monstersData.find(m => m.index === 'young-blue-dragon');
    const youngRaw = young.lair_actions.find(la => typeof la === 'string' && la.startsWith('Part of the ceiling collapses'));
    expect(typeof youngRaw).toBe('string');
    expect(isLairRowClickable(youngRaw)).toBe(false);
  });
});

// MA-0177: Ancient Blue Dragon lair_actions[1] sand cloud was a NAMELESS dict
// (MV-24/MA-0118 inert fingerprint — extends the MA-0176 whole-block
// nameless-inert signature): save_dc 15 / Constitution authored and
// prose-agreed, but the isLairRowClickable name-gate (monsterLairActions.js:26)
// killed clickability → static "." row, zero chip, zero DC 15 CON prompt, zero
// blinded, zero 20-ft zone armed (live inert, 2026-09-15). Data-only fix
// byte-mirroring the VERIFIED MA-0063/MA-0075 adult-blue sand-cloud zone
// shape onto the ancient row: name "Sand Cloud", dc_success "none" (damageless
// honest "no damage" copy), save_effect blinded 1 min + end-of-turn repeat-save
// prose, zone {radius_ft 20, effect_key lair_sand_cloud, repeat_save, advisory},
// duration advisory. Descriptions already byte-identical. Repeat-save NPC
// auto-repeat stays advisory (no NPC turn-end zone-save consumer). Sibling row
// [2] lightning arcs untouched (queued MA-0178).
describe('MA-0177 ancient-blue-dragon sand cloud data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-blue-dragon');
  const cloud = dragon.lair_actions[1];
  const adult = monstersData.find(m => m.index === 'adult-blue-dragon');
  const adultCloud = adult.lair_actions[1];

  it('row is now a structured clickable SAVE row named Sand Cloud (was nameless inert dict)', () => {
    expect(typeof cloud).toBe('object');
    expect(cloud.name).toBe('Sand Cloud');
    expect(isLairRowClickable(cloud)).toBe(true);
    expect(lairRowAffordance(cloud)).toBe('save');
  });

  it('byte-mirrors the VERIFIED MA-0063 adult-blue sibling row (JSON.stringify equality)', () => {
    expect(Object.keys(cloud)).toEqual(Object.keys(adultCloud));
    expect(Object.keys(cloud.zone)).toEqual(Object.keys(adultCloud.zone));
    expect(JSON.stringify(cloud)).toBe(JSON.stringify(adultCloud));
  });

  it('description kept verbatim from the original dict (byte-identical to adult sibling)', () => {
    expect(cloud.description).toBe(adultCloud.description);
    expect(cloud.description).toMatch(/20-foot-radius sphere/i);
    expect(cloud.description).toMatch(/Each creature in the cloud must succeed on a DC 15 Constitution saving throw/i);
    expect(cloud.description).toMatch(/blinded for 1 minute/i);
    expect(cloud.description).toMatch(/repeat the saving throw at the end of each of its turns/i);
  });

  it('no damage authored (dc_success none) — honest "no damage" copy on a pure blinded control row', () => {
    expect(cloud.damage_dice_primary).toBeUndefined();
    expect(cloud.damage_type_primary).toBeUndefined();
    expect(cloud.dc_success).toBe('none');
    expect(cloud.save_effect).toMatch(/deals no damage/i);
  });

  it('save_effect vocabulary → MA-0017 seam extracts ONLY blinded', () => {
    expect(extractConditionsFromSaveEffect(cloud.save_effect)).toEqual(['blinded']);
  });

  it('machine-readable persisting zone: 20-ft radius, lair_sand_cloud key, repeat_save', async () => {
    expect(cloud.zone.radius_ft).toBe(20);
    expect(cloud.zone.effect_key).toBe('lair_sand_cloud');
    expect(cloud.zone.repeat_save).toBe(true);
    expect(cloud.zone.advisory).toMatch(/GM-enforced/);
    expect(cloud.duration).toMatch(/blinded 1 minute/i);
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_sand_cloud');
    expect(def).toBeTruthy();
    expect(def.effect).toBe('lair_sand_cloud');
  });

  it('save row routes through handleSaveRoll with blinded conditions, zero damage formula', async () => {
    const handleSaveRoll = vi.fn();
    const handleZone = vi.fn();
    const res = await resolveLairRow({
      action: cloud,
      monsterName: 'Ancient Blue Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone,
      saveDamageFormula: null,
      saveConditions: extractConditionsFromSaveEffect(cloud.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(cloud, null, ['blinded']);
    expect(handleZone).not.toHaveBeenCalled();
  });

  it('scope guard: sibling lightning-arcs row [2] structured as of MA-0178, no zone (line row)', () => {
    expect(dragon.lair_actions[2].name).toBe('Lightning Arcs');
    expect(dragon.lair_actions[2].save_dc).toBe(15);
    expect(dragon.lair_actions[2].save_type).toBe('Dexterity');
    expect(dragon.lair_actions[2].zone).toBeUndefined();
    expect(isLairRowClickable(dragon.lair_actions[2])).toBe(true);
  });

  it('scope guard: adult-blue template row untouched by this fix (still the verified MA-0063 shape)', () => {
    expect(adultCloud.name).toBe('Sand Cloud');
    expect(adultCloud.save_dc).toBe(15);
    expect(adult.lair_actions.length).toBe(3);
  });
});

// MA-0178: Ancient Blue Dragon lair_actions[2] lightning arcs was a NAMELESS
// dict (MV-24/MA-0118 inert fingerprint — completes the MA-0176/0177 whole-block
// nameless-inert sweep): save_dc 15 / Dexterity authored and prose-agreed, but
// the isLairRowClickable name-gate (monsterLairActions.js:26) killed clickability
// → static "." row, zero chip, zero DC 15 DEX line prompt, zero 3d6 lightning
// (live inert, 2026-09-15). Double gap (MV-14 family): the 10 (3d6) lightning
// existed in description prose only — no damage_dice_primary. Data-only fix
// byte-mirroring the VERIFIED MA-0064 adult-blue lightning-arcs row: name
// "Lightning Arcs", damage_dice_primary 3d6, Lightning, dc_success "half",
// honest half-on-success save_effect. Line shape (5-ft wide, 120-ft endpoints,
// GM-positioned) rides the live MA-0064 max-feet-token gate fix in
// breathAoeShape (MonsterCardModal.jsx) — no code change, no zone key.
describe('MA-0178 ancient-blue-dragon lightning arcs data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-blue-dragon');
  const arcs = dragon.lair_actions[2];
  const adult = monstersData.find(m => m.index === 'adult-blue-dragon');
  const adultArcs = adult.lair_actions[2];

  it('row is now a structured clickable SAVE row named Lightning Arcs (was nameless inert dict)', () => {
    expect(typeof arcs).toBe('object');
    expect(arcs.name).toBe('Lightning Arcs');
    expect(isLairRowClickable(arcs)).toBe(true);
    expect(lairRowAffordance(arcs)).toBe('save');
  });

  it('byte-mirrors the VERIFIED MA-0064 adult-blue sibling row (JSON.stringify equality)', () => {
    expect(Object.keys(arcs)).toEqual(Object.keys(adultArcs));
    expect(JSON.stringify(arcs)).toBe(JSON.stringify(adultArcs));
  });

  it('save/damage fields: DC 15 Dexterity, 3d6 Lightning, half on success (prose-agreed)', () => {
    expect(arcs.save_dc).toBe(15);
    expect(arcs.save_type).toBe('Dexterity');
    expect(arcs.damage_dice_primary).toBe('3d6');
    expect(arcs.damage_type_primary).toBe('Lightning');
    expect(arcs.dc_success).toBe('half');
    expect(arcs.save_effect).toBe('Failure: 10 (3d6) Lightning damage. Success: Half damage.');
  });

  it('description kept verbatim from the original dict (byte-identical to adult sibling, line-shape prose)', () => {
    expect(arcs.description).toBe(adultArcs.description);
    expect(arcs.description).toMatch(/5-foot-wide line/i);
    expect(arcs.description).toMatch(/within 120 feet of the dragon and 120 feet of each other/i);
    expect(arcs.description).toMatch(/DC 15 Dexterity saving throw/i);
    expect(arcs.description).toMatch(/10 \(3d6\) lightning damage/i);
  });

  it('damageless save_effect extracts NO conditions (pure damage row); no zone key (line, not cloud)', () => {
    expect(extractConditionsFromSaveEffect(arcs.save_effect)).toEqual([]);
    expect(arcs.zone).toBeUndefined();
    expect(arcs.duration).toBeUndefined();
  });

  it('save row routes through handleSaveRoll with the 3d6 formula, zero zone/attack calls', async () => {
    const handleSaveRoll = vi.fn();
    const handleZone = vi.fn();
    const res = await resolveLairRow({
      action: arcs,
      monsterName: 'Ancient Blue Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone,
      saveDamageFormula: '3d6',
      saveConditions: [],
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(arcs, '3d6', []);
    expect(handleZone).not.toHaveBeenCalled();
  });

  it('whole-block now-chipped lock: [0] Ceiling Collapse, [1] Sand Cloud, [2] Lightning Arcs all clickable', () => {
    expect(dragon.lair_actions.length).toBe(3);
    for (const row of dragon.lair_actions) {
      expect(typeof row).toBe('object');
      expect(row.name).toBeTruthy();
      expect(isLairRowClickable(row)).toBe(true);
      expect(lairRowAffordance(row)).not.toBeNull();
    }
    expect(dragon.lair_actions.map(r => r.name)).toEqual(['Ceiling Collapse', 'Sand Cloud', 'Lightning Arcs']);
  });

  it('scope guard: adult-blue template row untouched by this fix (still the verified MA-0064 shape)', () => {
    expect(adultArcs.name).toBe('Lightning Arcs');
    expect(adultArcs.damage_dice_primary).toBe('3d6');
    expect(adultArcs.damage_type_primary).toBe('Lightning');
    expect(adultArcs.dc_success).toBe('half');
    expect(adult.lair_actions.length).toBe(3);
  });
});

// MA-0188/MA-0189: Ancient Brass Dragon lair block — both rows were nameless
// dicts (stray-`.` inert, zero chips). Fix byte-mirrors the adult-brass
// verified rows verbatim: MA-0074 named Strength save (push+prone advisory,
// no damage) and MA-0063/0075 Sand Cloud zone shape (lair_sand_cloud te,
// repeat-save advisory).
describe('MA-0188/MA-0189 ancient brass dragon lair rows byte-mirror adult-brass', () => {
  const ancient = monstersData.find(m => m.index === 'ancient-brass-dragon');
  const adult = monstersData.find(m => m.index === 'adult-brass-dragon');

  it('both rows named and byte-identical to the adult-brass siblings', () => {
    expect(JSON.stringify(ancient.lair_actions[0])).toBe(JSON.stringify(adult.lair_actions[0]));
    expect(JSON.stringify(ancient.lair_actions[1])).toBe(JSON.stringify(adult.lair_actions[1]));
    expect(isLairRowClickable(ancient.lair_actions[0])).toBe(true);
    expect(isLairRowClickable(ancient.lair_actions[1])).toBe(true);
  });

  it('Strong Wind: DC 15 Strength, dc_success none, prone in save_effect vocab, no damage fields', () => {
    const wind = ancient.lair_actions[0];
    expect(wind.name).toBe('Strong Wind');
    expect(wind.save_dc).toBe(15);
    expect(wind.save_type).toBe('Strength');
    expect(wind.dc_success).toBe('none');
    expect(wind.damage_dice_primary == null).toBe(true);
    expect(extractConditionsFromSaveEffect(wind.save_effect)).toContain('prone');
    expect(lairRowAffordance(wind)).toBe('save');
  });

  it('Sand Cloud: zone radius 20 lair_sand_cloud repeat_save, blinded vocab, honest no-damage copy', () => {
    const cloud = ancient.lair_actions[1];
    expect(cloud.name).toBe('Sand Cloud');
    expect(cloud.zone.radius_ft).toBe(20);
    expect(cloud.zone.effect_key).toBe('lair_sand_cloud');
    expect(cloud.zone.repeat_save).toBe(true);
    expect(cloud.dc_success).toBe('none');
    expect(extractConditionsFromSaveEffect(cloud.save_effect)).toContain('blinded');
    expect(cloud.save_effect).toMatch(/deals no damage/i);
  });
});

// MA-0199/MA-0200: Ancient Bronze Dragon lair block — fog raw-string +
// nameless Thunderclap dict (with 1dlO letter-O typo) both inert. Fix
// byte-mirrors the adult-bronze verified rows: MA-0085 fog zone shape
// (lair_fog_cloud te, no_save) + named DC 15 CON 1d10 save row.
describe('MA-0199/MA-0200 ancient bronze dragon lair rows byte-mirror adult-bronze', () => {
  const ancient = monstersData.find(m => m.index === 'ancient-bronze-dragon');
  const adult = monstersData.find(m => m.index === 'adult-bronze-dragon');

  it('no raw strings; both rows byte-identical to adult siblings; clickable', () => {
    expect(ancient.lair_actions.every(r => typeof r === 'object')).toBe(true);
    expect(JSON.stringify(ancient.lair_actions[0])).toBe(JSON.stringify(adult.lair_actions[0]));
    expect(JSON.stringify(ancient.lair_actions[1])).toBe(JSON.stringify(adult.lair_actions[1]));
    expect(isLairRowClickable(ancient.lair_actions[0])).toBe(true);
    expect(isLairRowClickable(ancient.lair_actions[1])).toBe(true);
    expect(JSON.stringify(ancient.lair_actions)).not.toMatch(/1dlO/);
  });

  it('Fog Cloud: zone-only affordance, lair_fog_cloud te key, no save fields', () => {
    const fog = ancient.lair_actions[0];
    expect(fog.name).toBe('Fog Cloud');
    expect(fog.zone.no_save).toBe(true);
    expect(fog.zone.radius_ft).toBe(20);
    expect(fog.zone.effect_key).toBe('lair_fog_cloud');
    expect(fog.zone.noun).toBe('fog');
    expect(fog.save_dc == null).toBe(true);
    expect(lairRowAffordance(fog)).toBe('zone');
  });

  it('Thunderclap: DC 15 CON 1d10 Thunder, dc_success none, deafened vocab, save affordance', () => {
    const tc = ancient.lair_actions[1];
    expect(tc.name).toBe('Thunderclap');
    expect(tc.save_dc).toBe(15);
    expect(tc.save_type).toBe('Constitution');
    expect(tc.damage_dice_primary).toBe('1d10');
    expect(tc.damage_type_primary).toBe('Thunder');
    expect(tc.dc_success).toBe('none');
    expect(extractConditionsFromSaveEffect(tc.save_effect)).toContain('deafened');
    expect(lairRowAffordance(tc)).toBe('save');
  });
});

// MA-0210/MA-0211: Ancient Copper Dragon lair block — raw-string Stone
// Spikes + nameless Liquid Mud dict both inert. Fix: register lair_spike_growth
// te (registry rule) + MA-0085 zone dict; name the mud row with MA-0075
// save+zone shape (lair_mud te, 10-ft square → 5-ft radius precedent,
// dc_success none honest no-damage copy).
describe('MA-0210/MA-0211 ancient copper dragon lair rows', () => {
  const ancient = monstersData.find(m => m.index === 'ancient-copper-dragon');

  it('Stone Spikes: named zone dict, no_save, lair_spike_growth key, te registered', async () => {
    const spikes = ancient.lair_actions[0];
    expect(typeof spikes).toBe('object');
    expect(spikes.name).toBe('Stone Spikes');
    expect(spikes.zone.radius_ft).toBe(20);
    expect(spikes.zone.no_save).toBe(true);
    expect(spikes.zone.effect_key).toBe('lair_spike_growth');
    expect(spikes.save_dc == null).toBe(true);
    expect(isLairRowClickable(spikes)).toBe(true);
    expect(lairRowAffordance(spikes)).toBe('zone');
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('lair_spike_growth');
    expect(def).toBeTruthy();
    expect(def.group).toBe('Lair');
  });

  it('Liquid Mud: named save row DC 15 DEX, dc_success none, restrained vocab, lair_mud zone te radius 5', () => {
    const mud = ancient.lair_actions[1];
    expect(mud.name).toBe('Liquid Mud');
    expect(mud.save_dc).toBe(15);
    expect(mud.save_type).toBe('Dexterity');
    expect(mud.dc_success).toBe('none');
    expect(extractConditionsFromSaveEffect(mud.save_effect)).toContain('restrained');
    expect(mud.save_effect).toMatch(/deals no damage/i);
    expect(mud.zone.radius_ft).toBe(5);
    expect(mud.zone.effect_key).toBe('lair_mud');
    expect(isLairRowClickable(mud)).toBe(true);
    expect(lairRowAffordance(mud)).toBe('save');
  });
});

// MA-0221: Ancient Gold Dragon lair_actions[0] was a RAW STRING (MV-24 inert
// fingerprint) — behind the MonsterCardBody.jsx string short-circuit (:340) the
// row rendered prose with zero affordance: no chip, zero click delta, zero logs
// (live inert, 2026-09-15). Data-only fix byte-mirroring the VERIFIED MA-0107
// adult-gold-dragon self-buff advisory row (same canonical text): named
// "Glimpse the Future" advisory dict → affordance 'advisory' → clickable
// .mc-dice-link-lair chip → advisory popup + spell-named ability_use record.
// No monster-self advantage te consumer exists (§7) and no initiative-20 lair
// seam — the advantage-until-init-20 clause is GM-enforced advisory, mirroring
// the verified siblings' documented behavior. Sibling [1] dream-plane dict was
// left untouched here (MA-0222 scope) — landed in MA-0222 byte-mirroring the
// VERIFIED adult-gold "Dream Plane Banishment" row.
describe('MA-0221 ancient-gold-dragon glimpse the future advisory data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-gold-dragon');
  const glimpse = dragon.lair_actions[0];
  const adult = monstersData.find(m => m.index === 'adult-gold-dragon');
  const adultGlimpse = adult.lair_actions[0];

  it('[0] is now a named clickable ADVISORY row (was inert raw string)', () => {
    expect(typeof glimpse).toBe('object');
    expect(glimpse.name).toBe('Glimpse the Future');
    expect(glimpse.advisory).toBe('glimpse_the_future');
    expect(isLairRowClickable(glimpse)).toBe(true);
    expect(lairRowAffordance(glimpse)).toBe('advisory');
  });

  it('byte-mirrors the VERIFIED MA-0107 adult-gold-dragon row exactly', () => {
    expect(glimpse).toEqual(adultGlimpse);
    expect(Object.keys(glimpse)).toEqual(Object.keys(adultGlimpse));
  });

  it('description kept verbatim from the original string row (advantage until initiative count 20)', () => {
    expect(glimpse.description).toBe('The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round.');
  });

  it('no machine-readable enforcement keys — no fake save/attack/damage/zone authored', () => {
    expect(glimpse.save_dc).toBeUndefined();
    expect(glimpse.save_type).toBeUndefined();
    expect(glimpse.save_effect).toBeUndefined();
    expect(glimpse.attack_bonus).toBeUndefined();
    expect(glimpse.damage_dice_primary).toBeUndefined();
    expect(glimpse.zone).toBeUndefined();
  });

  it('advisory click logs ability_use record + popup, zero save/attack/damage/zone', async () => {
    const logs = [];
    const setPopupHtml = vi.fn();
    const res = await resolveLairRow({
      action: glimpse,
      monsterName: 'Ancient Gold Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      handleSaveRoll: vi.fn(),
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone: vi.fn(),
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].characterName).toBe('Ancient Gold Dragon 1');
    expect(logs[0].abilityName).toBe('Glimpse the Future');
    expect(logs[0].description).toMatch(/casts glimpse the future/i);
    expect(logs[0].description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(logs[0].description).not.toMatch(/save DC/i);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringMatching(/Lair Action — Glimpse the Future/));
  });

  it('no glimpse-the-future te registered (no self-advantage consumer — advisory model)', async () => {
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    expect(getEffectDefinition('lair_glimpse_the_future')).toBeFalsy();
  });

  it('sibling scope guard: [1] dream-plane row structured as of MA-0222 (byte-mirror of VERIFIED MA-0107)', () => {
    const banish = dragon.lair_actions[1];
    expect(banish.name).toBe('Dream Plane Banishment');
    expect(banish.save_dc).toBe(15);
    expect(banish.save_type).toBe('Charisma');
    expect(isLairRowClickable(banish)).toBe(true);
    expect(banish).toEqual(adult.lair_actions[1]);
  });

  it('template scope guard: adult-gold-dragon rows untouched by this fix (MA-0107 shape)', () => {
    expect(adultGlimpse.name).toBe('Glimpse the Future');
    expect(adult.lair_actions[1].name).toBe('Dream Plane Banishment');
  });
});

// MA-0222: Ancient Gold Dragon lair_actions[1] was a NAMELESS dict (MV-24
// name-gate fingerprint) — DC 15 Charisma save_dc/save_type present in data
// yet the row rendered a static `<strong>.</strong>` + prose with zero
// affordance (live inert, 2026-09-15): isLairRowClickable (:26) gates on
// !row.name before the DC branch is ever consulted, and no save_effect meant
// parseDreamPlaneBanishClause could never arm the lair_dream_plane te even
// behind the gate. Data-only fix byte-mirroring the VERIFIED MA-0107
// adult-gold-dragon "Dream Plane Banishment" row (identical canonical
// description text): named SAVE row → affordance 'save' → "DC 15 Charisma"
// chip → handleSaveRoll → failed save arms lair_dream_plane te + rounds:2
// expiry clock + badge (saveProcessing grantDreamPlaneBanishment :618-643).
// Contested-Charisma escape check and initiative-20 expiry/reappearance stay
// GM-enforced advisory (no initiative lair seam §7).
describe('MA-0222 ancient-gold-dragon dream plane banishment data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-gold-dragon');
  const banish = dragon.lair_actions[1];
  const adult = monstersData.find(m => m.index === 'adult-gold-dragon');
  const adultBanish = adult.lair_actions[1];

  it('[1] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof banish).toBe('object');
    expect(banish.name).toBe('Dream Plane Banishment');
    expect(isLairRowClickable(banish)).toBe(true);
    expect(lairRowAffordance(banish)).toBe('save');
  });

  it('byte-mirrors the VERIFIED MA-0107 adult-gold-dragon row exactly', () => {
    expect(banish).toEqual(adultBanish);
    expect(Object.keys(banish)).toEqual(Object.keys(adultBanish));
  });

  it('[1] save fields: DC 15 Charisma kept byte-intact, dc_success none (no damage authored)', () => {
    expect(banish.save_dc).toBe(15);
    expect(banish.save_type).toBe('Charisma');
    expect(banish.dc_success).toBe('none');
    expect(banish.damage_dice_primary).toBeUndefined();
    expect(banish.damage_type_primary).toBeUndefined();
  });

  it('[1] description kept verbatim (soft hyphen preserved)', () => {
    expect(banish.description).toMatch(/^One creature the dragon can see within 120 feet of it must succeed on a DC 15 Charisma saving throw or be banished to a dream plane/i);
    expect(banish.description).toMatch(/exis\xAD? tence the dragon has imagined into being/i);
    expect(banish.description).toMatch(/If the creature wins, it escapes the dream plane/i);
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

  it('[1] save row routes through handleSaveRoll, zero damage formula', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: banish,
      monsterName: 'Ancient Gold Dragon 1',
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

  it('scope guard: sibling [0] and adult-gold-dragon rows untouched by this fix', () => {
    expect(dragon.lair_actions[0].advisory).toBe('glimpse_the_future');
    expect(adultBanish.name).toBe('Dream Plane Banishment');
    expect(adult.lair_actions[0].advisory).toBe('glimpse_the_future');
  });
});

// MA-0231: Ancient Green Dragon lair_actions[0] was a NAMELESS save dict
// (save_dc 15 Strength, no name, no save_effect) — MA-0222 name-gate
// fingerprint (isLairRowClickable !row.name → false, monsterLairActions.js:26)
// rendered static <strong>.</strong>+prose with zero affordance. Data-only fix:
// canonical name + dc_success none + save_effect carrying the Restrained
// condition (MA-0117 adult-green verified vocabulary) so the MA-0017
// damageless save seam routes at DC 15 STR. Rescue/adjudication clauses
// (DC 15 STR action to break free, wilt-on-reuse/on-death expiry) remain
// GM-advisory residual annotated in save_effect (no rescue-engine or
// lair-cadence consumer).
describe('MA-0231 ancient-green-dragon grasping roots and vines data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-green-dragon');
  const roots = dragon.lair_actions[0];

  it('[0] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof roots).toBe('object');
    expect(roots.name).toBe('Grasping Roots and Vines');
    expect(isLairRowClickable(roots)).toBe(true);
    expect(lairRowAffordance(roots)).toBe('save');
  });

  it('save fields: DC 15 Strength kept byte-intact, dc_success none (no damage authored)', () => {
    expect(roots.save_dc).toBe(15);
    expect(roots.save_type).toBe('Strength');
    expect(roots.dc_success).toBe('none');
    expect(roots.damage_dice_primary).toBeUndefined();
    expect(roots.damage_type_primary).toBeUndefined();
    expect(roots.save_effect).not.toMatch(/damage/i);
  });

  it('description kept byte-intact canonical prose', () => {
    expect(roots.description).toMatch(/^Grasping roots and vines erupt in a 20-foot radius/);
    expect(roots.description).toMatch(/DC 15 Strength saving throw or be restrained/i);
    expect(roots.description).toMatch(/wilt away when the dragon uses this lair action again or when the dragon dies\.$/);
  });

  it('save_effect vocabulary extracts ONLY restrained (MA-0017 damageless seam)', () => {
    expect(extractConditionsFromSaveEffect(roots.save_effect)).toEqual(['restrained']);
  });

  it('rescue/adjudication residuals annotated as GM-enforced in save_effect', () => {
    expect(roots.save_effect).toMatch(/DC 15 Strength action to break free/i);
    expect(roots.save_effect).toMatch(/GM-enforced/i);
    expect(roots.save_effect).toMatch(/no rescue-engine or lair-cadence consumer/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + restrained', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: roots,
      monsterName: 'Ancient Green Dragon 1',
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

  it('scope guard: adult-green sibling and young-green nameless rows untouched', () => {
    const adult = monstersData.find(m => m.index === 'adult-green-dragon');
    const young = monstersData.find(m => m.index === 'young-green-dragon');
    expect(adult.lair_actions[0].name).toBe('Grasping Roots');
    expect(adult.lair_actions[0].save_effect).toBe('The target is restrained by the roots and vines.');
    expect(young.lair_actions[0].name).toBeUndefined();
    expect(isLairRowClickable(young.lair_actions[0])).toBe(false);
    // MA-0232 fixed [1] (Wall of Thorns), MA-0233 fixed [2] (Fog Charm) in later passes.
    expect(dragon.lair_actions[2].name).toBe('Fog Charm');
  });
});

// MA-0232: Ancient Green Dragon lair_actions[1] was a NAMELESS thorn-wall
// save dict (save_dc 15 Dexterity, 4d8 Piercing, no name, no save_effect) —
// MA-0222 name-gate fingerprint (isLairRowClickable !row.name → false,
// monsterLairActions.js:26) rendered static <strong>.</strong>+prose with
// zero affordance (live: click logged zero, no prompt). Data-only fix,
// mirroring MA-0231/MA-0118: canonical "Wall of Thorns" name (adult-green sibling
// vocabulary) + dc_success "half" + save_effect encoding fail damage,
// half-on-success, push-5ft advisory — recurring contact-save cadence,
// wall-section object stats, movement cost and sinks-back expiry stay
// GM-advisory residuals inside save_effect (description byte-intact per
// brief; §7 no zone/object/movement-cost/lair-cadence consumer).
describe('MA-0232 ancient-green-dragon wall of thorns data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-green-dragon');
  const wall = dragon.lair_actions[1];

  it('[1] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof wall).toBe('object');
    expect(wall.name).toBe('Wall of Thorns');
    expect(isLairRowClickable(wall)).toBe(true);
    expect(lairRowAffordance(wall)).toBe('save');
  });

  it('save fields: DC 15 Dexterity, 4d8 Piercing kept byte-intact, dc_success half', () => {
    expect(wall.save_dc).toBe(15);
    expect(wall.save_type).toBe('Dexterity');
    expect(wall.damage_dice_primary).toBe('4d8');
    expect(wall.damage_type_primary).toBe('Piercing');
    expect(wall.dc_success).toBe('half');
  });

  it('description kept byte-intact canonical prose (advisories live in save_effect)', () => {
    expect(wall.description).toMatch(/^A wall of tangled brush bristling with thorns springs into existence/);
    expect(wall.description).toMatch(/DC 15 Dexterity saving throw/i);
    expect(wall.description).toMatch(/18 \(4d8\) piercing damage/i);
    expect(wall.description).toMatch(/half as much damage on a successful one/i);
    expect(wall.description).toMatch(/sinks back into the ground when the dragon uses this lair action again or when the dragon dies\.$/);
  });

  it('save_effect vocabulary: fail damage + half-on-success + push prose; NO canonical condition extracted (damage-only leg)', () => {
    expect(wall.save_effect).toMatch(/^The target takes 18 \(4d8\) piercing damage and is pushed 5 feet out of the wall's space/);
    expect(wall.save_effect).toMatch(/half as much damage on a successful save/);
    expect(extractConditionsFromSaveEffect(wall.save_effect)).toEqual([]);
  });

  it('advisory residuals annotated in save_effect: recurring cadence, wall-section stats, movement cost, sinks-back expiry (GM-enforced, no consumers)', () => {
    expect(wall.save_effect).toMatch(/recurring once-each-round contact-save cadence/i);
    expect(wall.save_effect).toMatch(/AC 5, 15 hit points per 10-foot section/i);
    expect(wall.save_effect).toMatch(/4-feet-of-movement-per-1-foot cost/i);
    expect(wall.save_effect).toMatch(/GM-enforced/i);
    expect(wall.save_effect).toMatch(/no zone\/object\/movement-cost\/lair-cadence consumer/i);
  });

  it('save row routes through handleSaveRoll with 4d8 formula + zero conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: wall,
      monsterName: 'Ancient Green Dragon 1',
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

  it('scope guard: nameless young-green thorn-wall twin and ancient siblings untouched', () => {
    const young = monstersData.find(m => m.index === 'young-green-dragon');
    expect(young.lair_actions[2].name).toBeUndefined();
    expect(isLairRowClickable(young.lair_actions[2])).toBe(false);
    expect(dragon.lair_actions[0].name).toBe('Grasping Roots and Vines');
    // MA-0233 fixed [2] (Fog Charm) in a later pass.
    expect(dragon.lair_actions[2].name).toBe('Fog Charm');
  });
});

// MA-0233: Ancient Green Dragon lair_actions[2] was a NAMELESS fog dict
// (save_dc 15 Wisdom, no name, no save_effect) — MA-0222 name-gate
// fingerprint (isLairRowClickable !row.name → false, monsterLairActions.js:26)
// rendered static <strong>.</strong>+prose with zero affordance (live: click
// logged zero, no prompt, no charmed grant). Data-only fix, mirroring
// MA-0119 adult-green verified sibling vocabulary: canonical "Fog Charm"
// name + dc_success "none" + save_effect carrying the Charmed condition
// (MA-0017 damageless failed-save seam) so the chip "DC 15 Wisdom" routes
// through handleSaveRoll and applySaveFailConditions grants charmed on fail,
// zero grant + zero damage on success (no damage fields authored). The
// "until initiative count 20 on the next round" expiry and fog-as-zone stay
// GM-advisory residuals annotated in save_effect (description byte-intact
// per brief; §7 no initiative lair seam / no zone consumer).
describe('MA-0233 ancient-green-dragon fog charm data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-green-dragon');
  const fog = dragon.lair_actions[2];

  it('[2] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof fog).toBe('object');
    expect(fog.name).toBe('Fog Charm');
    expect(isLairRowClickable(fog)).toBe(true);
    expect(lairRowAffordance(fog)).toBe('save');
  });

  it('save fields: DC 15 Wisdom kept byte-intact, dc_success none (no damage authored)', () => {
    expect(fog.save_dc).toBe(15);
    expect(fog.save_type).toBe('Wisdom');
    expect(fog.dc_success).toBe('none');
    expect(fog.damage_dice_primary).toBeUndefined();
    expect(fog.damage_type_primary).toBeUndefined();
    expect(fog.save_effect).not.toMatch(/damage/i);
  });

  it('description kept byte-intact canonical prose', () => {
    expect(fog.description).toMatch(/^Magical fog billows around one creature/);
    expect(fog.description).toMatch(/DC 15 Wisdom saving throw or be charmed/i);
    expect(fog.description).toMatch(/until initiative count 20 on the next round\.$/);
  });

  it('save_effect vocabulary extracts ONLY charmed (MA-0017 damageless seam, fail-only)', () => {
    expect(extractConditionsFromSaveEffect(fog.save_effect)).toEqual(['charmed']);
  });

  it('advisory residuals annotated in save_effect: init-count-20 expiry GM-enforced (no initiative lair seam, persists until manually cleared)', () => {
    expect(fog.save_effect).toMatch(/^The target is charmed by the dragon\./);
    expect(fog.save_effect).toMatch(/until initiative count 20 on the next round.*GM-enforced/i);
    expect(fog.save_effect).toMatch(/no initiative lair seam/i);
    expect(fog.save_effect).toMatch(/charmed condition persists until manually cleared/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + charmed', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: fog,
      monsterName: 'Ancient Green Dragon 1',
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

  it('scope guard: adult-green sibling byte-identical fix shape, young-green twin and ancient [0]/[1] untouched', () => {
    const adult = monstersData.find(m => m.index === 'adult-green-dragon');
    const young = monstersData.find(m => m.index === 'young-green-dragon');
    expect(adult.lair_actions[2].name).toBe('Fog Charm');
    expect(adult.lair_actions[2].save_effect).toBe('The target is charmed by the dragon.');
    expect(adult.lair_actions[2].dc_success).toBe('none');
    expect(young.lair_actions[2].name).toBeUndefined();
    expect(isLairRowClickable(young.lair_actions[2])).toBe(false);
    expect(dragon.lair_actions[0].name).toBe('Grasping Roots and Vines');
    expect(dragon.lair_actions[1].name).toBe('Wall of Thorns');
  });
});

// MA-0242: Ancient Red Dragon lair_actions[0] was a NAMELESS magma-geyser
// save dict (save_dc 15 Dexterity, 6d6 Fire half-on-success, no name) —
// MA-0222 name-gate fingerprint (isLairRowClickable !row.name → false,
// monsterLairActions.js:26) rendered static <strong>.</strong>+prose with
// zero affordance (live: click logged zero, no prompt). Data-only fix,
// mirroring the VERIFIED MA-0128 adult-red sibling: canonical "Magma Geyser"
// name + dc_success "half" (damage leg already authored byte-intact).
describe('MA-0242 ancient-red-dragon magma geyser data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-red-dragon');
  const geyser = dragon.lair_actions[0];

  it('[0] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof geyser).toBe('object');
    expect(geyser.name).toBe('Magma Geyser');
    expect(isLairRowClickable(geyser)).toBe(true);
    expect(lairRowAffordance(geyser)).toBe('save');
  });

  it('save fields: DC 15 Dexterity, 6d6 Fire kept byte-intact, dc_success half', () => {
    expect(geyser.save_dc).toBe(15);
    expect(geyser.save_type).toBe('Dexterity');
    expect(geyser.damage_dice_primary).toBe('6d6');
    expect(geyser.damage_type_primary).toBe('Fire');
    expect(geyser.dc_success).toBe('half');
  });

  it('description kept byte-intact canonical prose', () => {
    expect(geyser.description).toMatch(/^Magma erupts from a point on the ground/);
    expect(geyser.description).toMatch(/DC 15 Dexterity saving throw/i);
    expect(geyser.description).toMatch(/21 \(6d6\) fire damage on a failed save/i);
    expect(geyser.description).toMatch(/half as much damage on a successful one\.$/);
  });

  it('save_effect vocabulary: damage-only leg — NO canonical condition extracted', () => {
    expect(geyser.save_effect).toMatch(/^Failure: 21 \(6d6\) Fire damage\. Success: Half damage\.$/);
    expect(extractConditionsFromSaveEffect(geyser.save_effect)).toEqual([]);
  });

  it('save row routes through handleSaveRoll with 6d6 formula + zero conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: geyser,
      monsterName: 'Ancient Red Dragon 1',
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

  it('adult-red sibling parity: same canonical name + dc_success half, DC/type/dice identical', () => {
    const adult = monstersData.find(m => m.index === 'adult-red-dragon');
    const adultGeyser = adult.lair_actions[0];
    expect(adultGeyser.name).toBe('Magma Geyser');
    expect(adultGeyser.dc_success).toBe('half');
    expect(geyser.save_dc).toBe(adultGeyser.save_dc);
    expect(geyser.save_type).toBe(adultGeyser.save_type);
    expect(geyser.damage_dice_primary).toBe(adultGeyser.damage_dice_primary);
    expect(geyser.damage_type_primary).toBe(adultGeyser.damage_type_primary);
    expect(geyser.description).toBe(adultGeyser.description);
  });

  it('scope guard: ancient-red [1] tremor structured by MA-0243; [2] volcanic-gases structured later by MA-0244; young-red twin inert', () => {
    expect(dragon.lair_actions[1].name).toBe('Tremor');
    expect(isLairRowClickable(dragon.lair_actions[1])).toBe(true);
    expect(dragon.lair_actions[2].name).toBe('Volcanic Gases');
    expect(isLairRowClickable(dragon.lair_actions[2])).toBe(true);
    const young = monstersData.find(m => m.index === 'young-red-dragon');
    expect(young.lair_actions[0].name).toBeUndefined();
    expect(isLairRowClickable(young.lair_actions[0])).toBe(false);
  });
});

// MA-0243: Ancient Red Dragon lair_actions[1] was a NAMELESS tremor dict
// (save_dc 15 Dexterity, "knocked prone" save_effect, no name) — MA-0222
// name-gate fingerprint (isLairRowClickable !row.name → false,
// monsterLairActions.js:26) rendered static <strong>.</strong>+prose with
// zero affordance (live: forced click zero overlays, zero log lines).
// Data-only fix mirroring the VERIFIED MA-0129 adult-red sibling: canonical
// "Tremor" name + dc_success "none" armed on the row — save_dc/save_type/
// save_effect kept byte-intact, no damage fields authored (damageless
// failed-save prone lands via the MA-0017 seam; dc_success "none" suppresses
// the MV-19/20 half-damage boilerplate on both surfaces — MA-0129 precedent).
describe('MA-0243 ancient-red-dragon tremor data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-red-dragon');
  const tremor = dragon.lair_actions[1];

  it('[1] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof tremor).toBe('object');
    expect(tremor.name).toBe('Tremor');
    expect(isLairRowClickable(tremor)).toBe(true);
    expect(lairRowAffordance(tremor)).toBe('save');
  });

  it('save fields byte-intact: DC 15 Dexterity, dc_success none, no damage authored', () => {
    expect(tremor.save_dc).toBe(15);
    expect(tremor.save_type).toBe('Dexterity');
    expect(tremor.dc_success).toBe('none');
    expect(tremor.damage_dice_primary).toBeUndefined();
    expect(tremor.damage_type_primary).toBeUndefined();
  });

  it('save_effect kept byte-intact — vocabulary extracts ONLY prone (MA-0017 damageless seam)', () => {
    expect(tremor.save_effect).toBe('Failure: The target is knocked prone.');
    expect(extractConditionsFromSaveEffect(tremor.save_effect)).toEqual(['prone']);
  });

  it('description kept byte-intact canonical prose', () => {
    expect(tremor.description).toMatch(/^A tremor shakes the lair in a 60-foot radius around the dragon\./i);
    expect(tremor.description).toMatch(/Each creature other than the dragon on the ground in that area must succeed on a DC 15 Dexterity saving throw or be knocked prone\.$/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + prone', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: tremor,
      monsterName: 'Ancient Red Dragon 1',
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

  it('adult-red sibling parity (MA-0129 VERIFIED): same name + dc_success none, DC/type identical', () => {
    const adult = monstersData.find(m => m.index === 'adult-red-dragon');
    const adultTremor = adult.lair_actions[1];
    expect(adultTremor.name).toBe('Tremor');
    expect(tremor.name).toBe(adultTremor.name);
    expect(tremor.dc_success).toBe(adultTremor.dc_success);
    expect(tremor.save_dc).toBe(adultTremor.save_dc);
    expect(tremor.save_type).toBe(adultTremor.save_type);
  });

  it('young-red twin guard: nameless tremor dict stays nameless and inert (MA-0222 name-gate)', () => {
    const young = monstersData.find(m => m.index === 'young-red-dragon');
    const twin = young.lair_actions[2];
    expect(twin.description).toMatch(/^A tremor shakes the lair in a 60-foot radius/);
    expect(twin.name).toBeUndefined();
    expect(isLairRowClickable(twin)).toBe(false);
  });
});

// MA-0244: Ancient Red Dragon lair_actions[2] was a NAMELESS volcanic-gases
// save dict (save_dc 13 Constitution, "poisoned … incapacitated" save_effect,
// no name) — MA-0222 name-gate fingerprint (isLairRowClickable !row.name →
// false, monsterLairActions.js:26) rendered static <strong>.</strong>+prose
// with zero affordance (live: forced click zero overlays, zero log lines).
// Data-only fix byte-mirroring the VERIFIED MA-0130 adult-red sibling:
// canonical "Volcanic Gases" name + dc_success "none" + normalized save_effect
// (both canonical keywords in the Failure clause — extractConditionsFromSave-
// Effect parses poisoned + incapacitated, fail-only via the MA-0017 damageless
// seam) + zone dict arming lair_volcanic_gas te through the MA-0075 zone-cloud
// shape (20-ft radius picker, repeat_save advisory). description/save_dc/
// save_type kept byte-intact. Zone-until-initiative-20 cadence stays
// GM-advisory (same MA-0130 residual precedent).
describe('MA-0244 ancient-red-dragon volcanic gases data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-red-dragon');
  const cloud = dragon.lair_actions[2];

  it('[2] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof cloud).toBe('object');
    expect(cloud.name).toBe('Volcanic Gases');
    expect(isLairRowClickable(cloud)).toBe(true);
    expect(lairRowAffordance(cloud)).toBe('save');
  });

  it('save fields byte-intact: DC 13 Constitution, dc_success none, no damage authored', () => {
    expect(cloud.save_dc).toBe(13);
    expect(cloud.save_type).toBe('Constitution');
    expect(cloud.dc_success).toBe('none');
    expect(cloud.damage_dice_primary).toBeUndefined();
    expect(cloud.damage_type_primary).toBeUndefined();
  });

  it('save_effect normalized to adult vocabulary — extracts ONLY incapacitated + poisoned, fail-only', () => {
    expect(cloud.save_effect).toBe('Failure: The target is poisoned until the end of its turn and is incapacitated while poisoned in this way. Success: unaffected. This effect deals no damage.');
    expect(extractConditionsFromSaveEffect(cloud.save_effect)).toEqual(['incapacitated', 'poisoned']);
  });

  it('machine-readable persisting zone: 20-ft radius, lair_volcanic_gas key, repeat_save advisory', () => {
    expect(cloud.zone.radius_ft).toBe(20);
    expect(cloud.zone.effect_key).toBe('lair_volcanic_gas');
    expect(cloud.zone.repeat_save).toBe(true);
    expect(cloud.zone.advisory).toMatch(/GM-enforced/);
    expect(cloud.duration).toMatch(/poisoned until end of turn/i);
    expect(cloud.duration).toMatch(/incapacitated while poisoned/i);
  });

  it('description kept byte-intact canonical prose (20-ft sphere, DC 13 CON, initiative 20)', () => {
    expect(cloud.description).toMatch(/^Volcanic gases form a cloud in a 20-foot-radius sphere centered on a point the dragon can see within 120 feet of it\./i);
    expect(cloud.description).toMatch(/lasts until initiative count 20 on the next round/i);
    expect(cloud.description).toMatch(/starts its turn in the cloud must succeed on a DC 13 Constitution saving throw or be poisoned until the end of its turn/i);
    expect(cloud.description).toMatch(/While poisoned in this way, a creature is incapacitated/i);
  });

  it('save row routes through handleSaveRoll with zero damage formula + poisoned/incapacitated', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: cloud,
      monsterName: 'Ancient Red Dragon 1',
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

  it('adult-red sibling parity (MA-0130 VERIFIED): name/save_effect/zone/duration/dc_success byte-identical', () => {
    const adult = monstersData.find(m => m.index === 'adult-red-dragon');
    const adultCloud = adult.lair_actions[2];
    expect(cloud.name).toBe(adultCloud.name);
    expect(cloud.dc_success).toBe(adultCloud.dc_success);
    expect(cloud.save_dc).toBe(adultCloud.save_dc);
    expect(cloud.save_type).toBe(adultCloud.save_type);
    expect(cloud.save_effect).toBe(adultCloud.save_effect);
    expect(cloud.description).toBe(adultCloud.description);
    expect(cloud.zone).toEqual(adultCloud.zone);
    expect(cloud.duration).toBe(adultCloud.duration);
  });

  it('scope guard: ancient-red [0]/[1] fixed rows untouched; young-red twin rows stay nameless/inert (MA-0222 name-gate)', () => {
    expect(dragon.lair_actions[0].name).toBe('Magma Geyser');
    expect(dragon.lair_actions[0].dc_success).toBe('half');
    expect(dragon.lair_actions[1].name).toBe('Tremor');
    const young = monstersData.find(m => m.index === 'young-red-dragon');
    expect(typeof young.lair_actions[0]).toBe('string');
    expect(isLairRowClickable(young.lair_actions[0])).toBe(false);
    expect(young.lair_actions[1].name).toBeUndefined();
    expect(isLairRowClickable(young.lair_actions[1])).toBe(false);
    expect(young.lair_actions[2].name).toBeUndefined();
    expect(isLairRowClickable(young.lair_actions[2])).toBe(false);
  });
});

// MA-0254: Ancient Silver Dragon lair_actions[0] was a RAW STRING fog row —
// MA-0167 inert-raw-string fingerprint (no name token at all, static prose,
// zero affordance; live: forced click zero overlays, zero log lines, fog zone
// never armed). Data-only fix byte-mirroring the VERIFIED MA-0085/MA-0199
// adult/ancient-bronze fog siblings: name "Fog Cloud" + save-less zone dict
// (radius 20, no_save, noun fog, effect_key lair_fog_cloud, GM-enforced
// advisory) + initiative-20 duration; canonical silver prose ("as if") kept
// verbatim as description. lair_actions[1] cold wind stays UNTOUCHED
// (separate MA-0255 scope, incl. its 1dlO letter-O typo).
describe('MA-0254 ancient-silver-dragon fog cloud zone data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-silver-dragon');
  const fog = dragon.lair_actions[0];

  it('[0] is now a named clickable ZONE row (was inert raw string)', () => {
    expect(typeof fog).toBe('object');
    expect(fog.name).toBe('Fog Cloud');
    expect(isLairRowClickable(fog)).toBe(true);
    expect(lairRowAffordance(fog)).toBe('zone');
  });

  it('zone dict shape parity with VERIFIED bronze siblings (MA-0085/MA-0199)', () => {
    expect(fog.zone.radius_ft).toBe(20);
    expect(fog.zone.no_save).toBe(true);
    expect(fog.zone.noun).toBe('fog');
    expect(fog.zone.effect_key).toBe('lair_fog_cloud');
    expect(fog.zone.advisory).toMatch(/no saving throw/i);
    expect(fog.zone.advisory).toMatch(/GM-enforced/i);
    expect(fog.duration).toBe('until initiative count 20 next round (advisory)');
    const adult = monstersData.find(m => m.index === 'adult-bronze-dragon');
    const ancientBronze = monstersData.find(m => m.index === 'ancient-bronze-dragon');
    expect(JSON.stringify(fog.zone)).toBe(JSON.stringify(adult.lair_actions[0].zone));
    expect(JSON.stringify(fog.zone)).toBe(JSON.stringify(ancientBronze.lair_actions[0].zone));
    expect(fog.duration).toBe(adult.lair_actions[0].duration);
  });

  it('no save/damage fields authored; canonical silver prose kept verbatim as description', () => {
    expect(fog.save_dc).toBeUndefined();
    expect(fog.save_type).toBeUndefined();
    expect(fog.damage_dice_primary).toBeUndefined();
    expect(fog.damage_type_primary).toBeUndefined();
    expect(fog.save_effect).toBeUndefined();
    expect(fog.description).toBe('The dragon creates fog as if it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round.');
    expect(JSON.stringify(fog)).not.toMatch(/1dlO/);
  });

  it('[0] routes through handleZone with zero save/attack/damage handlers', async () => {
    const handleZone = vi.fn();
    const res = await resolveLairRow({
      action: fog,
      monsterName: 'Ancient Silver Dragon 1',
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

  it('scope guard: [1] cold wind row structured by MA-0255 in a later pass (1dlO typo still intact)', () => {
    const wind = dragon.lair_actions[1];
    expect(wind.name).toBe('Cold Wind');
    expect(wind.save_dc).toBe(15);
    expect(wind.save_type).toBe('Constitution');
    expect(wind.damage_dice_primary).toBe('1d10');
    expect(wind.damage_type_primary).toBe('Cold');
    expect(wind.description).toMatch(/1dlO/);
    expect(wind.description).toMatch(/blisteringly cold wind/i);
  });
});

// MA-0255: Ancient Silver Dragon lair_actions[1] was a NAMELESS cold-wind
// save dict (save_dc 15 Constitution, 1d10 Cold, no name, no dc_success) —
// MA-0222 name-gate fingerprint (isLairRowClickable !row.name → false,
// monsterLairActions.js:26) rendered static <strong>.</strong>+prose with
// zero affordance. Data-only fix, mirroring the VERIFIED adult-silver
// MA-0136 sibling: canonical "Cold Wind" name + dc_success "half"
// (canonical half-on-success) — save_dc/save_type/save_effect/damage fields
// byte-intact. The description OCR typo "1dlO" (MA-0137/MA-0200 letter-O
// family) stays byte-intact per brief: display-only, machine field
// damage_dice_primary "1d10" is authoritative (MV-12). Gas/vapor dispersal
// and flame-extinguishing clauses stay GM-advisory residuals (§7 no
// gas/flame consumer).
describe('MA-0255 ancient-silver-dragon cold wind data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-silver-dragon');
  const wind = dragon.lair_actions[1];
  const adult = monstersData.find(m => m.index === 'adult-silver-dragon');

  it('[1] is now a named clickable SAVE row (was nameless inert dict)', () => {
    expect(typeof wind).toBe('object');
    expect(wind.name).toBe('Cold Wind');
    expect(isLairRowClickable(wind)).toBe(true);
    expect(lairRowAffordance(wind)).toBe('save');
  });

  it('save fields: DC 15 Constitution, 1d10 Cold kept byte-intact, dc_success half', () => {
    expect(wind.save_dc).toBe(15);
    expect(wind.save_type).toBe('Constitution');
    expect(wind.damage_dice_primary).toBe('1d10');
    expect(wind.damage_type_primary).toBe('Cold');
    expect(wind.dc_success).toBe('half');
    expect(wind.save_effect).toBe('Failure: 5 (1d10) Cold damage.');
  });

  it('description kept byte-intact incl. 1dlO OCR typo (display-only; machine field is 1d10)', () => {
    expect(wind.description).toMatch(/^A blisteringly cold wind blows through the lair near the dragon\./);
    expect(wind.description).toMatch(/DC 15 Constitution saving throw/i);
    expect(wind.description).toMatch(/1dlO/);
    expect(wind.damage_dice_primary).toBe('1d10');
    expect(canRollExpression('1dlO')).toBe(false);
    expect(canRollExpression(wind.damage_dice_primary)).toBe(true);
  });

  it('adult-silver MA-0136 parity: same name, DC, type, dice, damage type, dc_success', () => {
    const adultWind = adult.lair_actions[1];
    expect(adultWind.name).toBe('Cold Wind');
    expect(wind.name).toBe(adultWind.name);
    expect(wind.save_dc).toBe(adultWind.save_dc);
    expect(wind.save_type).toBe(adultWind.save_type);
    expect(wind.damage_dice_primary).toBe(adultWind.damage_dice_primary);
    expect(wind.damage_type_primary).toBe(adultWind.damage_type_primary);
    expect(wind.dc_success).toBe(adultWind.dc_success);
  });

  it('damage-only leg: no canonical condition extracted from save_effect', () => {
    expect(extractConditionsFromSaveEffect(wind.save_effect)).toEqual([]);
  });

  it('save row routes through handleSaveRoll with 1d10 formula + zero conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: wind,
      monsterName: 'Ancient Silver Dragon 1',
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

  it('scope guard: [0] fog zone and young-silver inert twins untouched; wyrmling lair empty', () => {
    expect(dragon.lair_actions[0].name).toBe('Fog Cloud');
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('zone');
    const young = monstersData.find(m => m.index === 'young-silver-dragon');
    expect(typeof young.lair_actions[0]).toBe('string');
    expect(isLairRowClickable(young.lair_actions[1])).toBe(false);
    const wyrmling = monstersData.find(m => m.index === 'silver-dragon-wyrmling');
    expect(wyrmling.lair_actions).toEqual([]);
  });
});

// MA-0263: Ancient White Dragon lair_actions[0] freezing fog was a NAMELESS
// dict (MA-0222 name-gate fingerprint: isLairRowClickable !row.name hard gate
// at monsterLairActions.js:26 evaluated BEFORE the save_dc branch) — its save
// legs (DC 10 Constitution, 3d6 Cold, half-on-success) fully matched the
// verbatim description prose, but the row rendered static
// <strong>.</strong>+prose with zero chips (live inert, 2026-09-16: click →
// zero overlays, zero log lines). Data-only fix mirroring the VERIFIED
// MA-0255 cold-wind pattern (name + dc_success "half" + save_effect full/half
// mirror — save_effect was already authored, untouched) plus the VERIFIED
// MA-0254/MA-0085/MA-0199 fog zone dict keys (radius_ft 20, no_save, noun
// fog, effect_key lair_fog_cloud, GM-enforced advisory + advisory duration)
// so the picker confirm arms the lair_fog_cloud zone te. Save-row key shape
// mirrors MA-0149 adult-white sibling (same monster, fixed dict). Turn-end
// 10 (3d6) re-damage, heavily obscured area, wind dispersal and initiative-20
// cadence stay GM-advisory prose residuals (no turn-end zone-damage consumer,
// no initiative lair seam — MA-0024 residual).
describe('MA-0263 ancient-white-dragon freezing fog nameless-dict data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-white-dragon');
  const fog = dragon.lair_actions[0];

  it('[0] is now a named clickable SAVE row (name-gate no longer kills it)', () => {
    expect(typeof fog).toBe('object');
    expect(fog.name).toBe('Freezing Fog');
    expect(isLairRowClickable(fog)).toBe(true);
    expect(lairRowAffordance(fog)).toBe('save');
  });

  it('canonical save legs untouched: DC 10 Constitution, 3d6 Cold, dc_success half (prose-agreed)', () => {
    expect(fog.save_dc).toBe(10);
    expect(fog.save_type).toBe('Constitution');
    expect(fog.damage_dice_primary).toBe('3d6');
    expect(fog.damage_type_primary).toBe('Cold');
    expect(fog.dc_success).toBe('half');
    expect(fog.description).toMatch(/DC 10 Constitution saving throw/i);
    expect(fog.description).toMatch(/half as much damage on a successful one/i);
    expect(fog.description).toMatch(/20-foot-radius sphere/i);
  });

  it('save_effect authored ONCE — full/half mirror MA-0255 vocabulary, zero condition over-extraction', () => {
    expect(Object.keys(fog).filter(k => k === 'save_effect')).toHaveLength(1);
    expect(fog.save_effect).toMatch(/Failure: 10 \(3d6\) Cold damage\. Success: Half damage\./);
    expect(fog.save_effect).toMatch(/ends its turn in the fog takes 10 \(3d6\) cold damage/i);
    expect(extractConditionsFromSaveEffect(fog.save_effect)).toEqual([]);
  });

  it('zone dict keys resolve MA-0254 fog pattern (radius 20, no_save, noun fog, lair_fog_cloud, advisory duration)', () => {
    expect(fog.zone.radius_ft).toBe(20);
    expect(fog.zone.no_save).toBe(true);
    expect(fog.zone.noun).toBe('fog');
    expect(fog.zone.effect_key).toBe('lair_fog_cloud');
    expect(fog.zone.advisory).toMatch(/GM-enforced/i);
    expect(fog.zone.advisory).toMatch(/heavily obscured/i);
    expect(fog.duration).toMatch(/\(advisory\)$/);
    const adult = monstersData.find(m => m.index === 'adult-bronze-dragon');
    expect(Object.keys(fog.zone)).toEqual(Object.keys(adult.lair_actions[0].zone));
  });

  it('save row routes through handleSaveRoll with 3d6 formula + zero conditions', async () => {
    const handleSaveRoll = vi.fn();
    const res = await resolveLairRow({
      action: fog,
      monsterName: 'Ancient White Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone: vi.fn(),
      saveDamageFormula: '3d6',
      saveConditions: extractConditionsFromSaveEffect(fog.save_effect),
    });
    expect(res).toEqual({ resolved: true, affordance: 'save' });
    expect(handleSaveRoll).toHaveBeenCalledWith(fog, '3d6', []);
  });

  it('scope guard: adult-white MA-0149 sibling byte-untouched; [1] structured later by MA-0264, [2] structured later by MA-0265', () => {
    const adultWhite = monstersData.find(m => m.index === 'adult-white-dragon');
    expect(adultWhite.lair_actions[0].name).toBe('Freezing Fog');
    expect(adultWhite.lair_actions[0].save_dc).toBe(10);
    expect(adultWhite.lair_actions[0].zone).toBeUndefined();
    expect(typeof dragon.lair_actions[1]).toBe('object');
    expect(dragon.lair_actions[1].name).toBe('Jagged Ice Shards');
    expect(typeof dragon.lair_actions[2]).toBe('object');
    expect(isLairRowClickable(dragon.lair_actions[2])).toBe(true);
  });
});

// MA-0264: Ancient White Dragon lair_actions[1] jagged ice shards was a
// raw string (MA-0254/0221/0199 raw-string family fingerprint: bare
// "Jagged ice shards fall…" scalar → static <div class="mc-action"><span>
// row, no <strong> name, zero .mc-dice-link, unclickable; live inert
// 2026-09-16: click → zero overlays, zero log lines, control DC 10 CON fog
// chip alive). Data-only fix byte-mirroring the VERIFIED MA-0150 adult
// white sibling structured attack dict (name "Jagged Ice Shards",
// attack_bonus 7, range 120 ft., 3d6 Piercing, canonical prose incl. the
// up-to-three-targets clause retained verbatim as GM-adjudicated residual —
// multi-target leg has no multi-roll consumer, single-target resolution vs
// armed target is the documented MA-0024 model). No dc/zone keys authored:
// the adult sibling carries none (attack affordance routes via attack_bonus,
// monsterLairActions.js:43 → handleAttack :99). [2] wall of ice was a raw
// string at MA-0264 time; structured advisory dict later by MA-0265.
describe('MA-0264 ancient-white-dragon jagged ice shards raw-string data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-white-dragon');
  const shards = dragon.lair_actions[1];

  it('[1] is now a structured clickable ATTACK row named Jagged Ice Shards (was raw string)', () => {
    expect(typeof shards).toBe('object');
    expect(shards.name).toBe('Jagged Ice Shards');
    expect(isLairRowClickable(shards)).toBe(true);
    expect(lairRowAffordance(shards)).toBe('attack');
  });

  it('attack fields byte-mirror VERIFIED adult sibling: +7 to hit, 120 ft range, 3d6 Piercing (prose-agreed)', () => {
    const adult = monstersData.find(m => m.index === 'adult-white-dragon');
    expect(shards.attack_bonus).toBe(7);
    expect(shards.range).toBe('120 ft.');
    expect(shards.damage_dice_primary).toBe('3d6');
    expect(shards.damage_type_primary).toBe('Piercing');
    expect(shards.description).toBe(adult.lair_actions[1].description);
    expect(Object.keys(shards)).toEqual(Object.keys(adult.lair_actions[1]));
    expect(shards.description).toMatch(/\+7 to hit/i);
    expect(shards.description).toMatch(/up to three creatures/i);
    expect(shards.description).toMatch(/within 120 feet/i);
    expect(shards.description).toMatch(/10 \(3d6\) piercing damage/i);
  });

  it('no save/zone/advisory authored (adult sibling shape) — zero save-prompt or zone routing', () => {
    expect(shards.save_dc).toBeUndefined();
    expect(shards.save_effect).toBeUndefined();
    expect(shards.zone).toBeUndefined();
    expect(shards.advisory).toBeUndefined();
    expect(extractConditionsFromSaveEffect(shards.save_effect)).toEqual([]);
  });

  it('attack row routes through the UNCHANGED monster attack seam: handleAttack(name, +7, row)', async () => {
    const handleAttack = vi.fn();
    const handleSaveRoll = vi.fn();
    const handleDamage = vi.fn();
    const res = await resolveLairRow({
      action: shards,
      monsterName: 'Ancient White Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      handleSaveRoll,
      handleAttack,
      handleDamage,
    });
    expect(res).toEqual({ resolved: true, affordance: 'attack' });
    expect(handleAttack).toHaveBeenCalledWith('Jagged Ice Shards', 7, shards);
    expect(handleSaveRoll).not.toHaveBeenCalled();
    expect(handleDamage).not.toHaveBeenCalled();
  });

  it('scope guards: [0] MA-0263 fog dict byte-untouched; adult MA-0150 sibling byte-identical; young-white nameless dict still inert', () => {
    expect(dragon.lair_actions[0].name).toBe('Freezing Fog');
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('save');
    expect(typeof dragon.lair_actions[2]).toBe('object');
    expect(isLairRowClickable(dragon.lair_actions[2])).toBe(true);
    const adult = monstersData.find(m => m.index === 'adult-white-dragon');
    expect(JSON.stringify(adult.lair_actions[1])).toBe(JSON.stringify(shards));
    const young = monstersData.find(m => m.index === 'young-white-dragon');
    const jagged = (young.lair_actions || []).find(r => typeof r === 'object' && r?.description?.includes('Jagged ice shards'));
    expect(jagged).toBeDefined();
    expect(jagged.name).toBeUndefined();
    expect(isLairRowClickable(jagged)).toBe(false);
  });
});

// MA-0265: Ancient White Dragon lair_actions[2] wall of ice was a raw string
// (MA-0254/0264 raw-string family fingerprint: bare "The dragon creates an
// opaque wall of ice…" scalar → static <div class="mc-action"><span> row, no
// <strong> name, zero .mc-dice-link, unclickable; live inert 2026-09-16:
// trusted click → zero popups, zero log lines, control chips alive — DC 10
// CON fog save chip + Jagged Ice Shards attack chip). Data-only fix
// byte-mirroring the VERIFIED MA-0151 adult white sibling advisory dict
// (name "Wall of Ice", advisory "wall_of_ice", canonical description verbatim
// incl. AC 5 / 30 hp per 10-ft section, fire vulnerability, acid/cold/
// necrotic/poison/psychic immunity, 5-ft push on appear, 120-ft placement
// gate and keyed-replacement clauses retained as GM-advisory prose). Pure
// terrain/object action — no save/attack/damage/zone leg — so it arms the
// ADVISORY affordance: clickable .mc-dice-link-lair chip → advisory popup +
// spell-named ability_use record, initiative-20 cadence GM-enforced. True
// wall-object enforcement (per-section AC/HP, push-on-appear, keyed
// replacement, lair_wall_of_ice te) is the documented §7 residual — NOT
// built here (zero consumers app-wide).
describe('MA-0265 ancient-white-dragon wall of ice advisory data lock', () => {
  const dragon = monstersData.find(m => m.index === 'ancient-white-dragon');
  const wall = dragon.lair_actions[2];
  const VERBATIM = "The dragon creates an opaque wall of ice on a solid surface it can see within 120 feet of it. The wall can be up to 30 feet long, 30 feet high, and 1 foot thick. When the wall appears, each creature within its area is pushed 5 feet out of the wall's space, appearing on whichever side of the wall it wants. Each 10-foot sec\u00ad tion of the wall has AC 5, 30 hit points, vulnerability to fire damage, and immunity to acid, cold, necrotic, poison, and psychic damage. The wall disappears when the dragon uses this lair action again or when the dragon dies.";

  it('[2] is now a named clickable ADVISORY row (was inert raw string)', () => {
    expect(typeof wall).toBe('object');
    expect(wall.name).toBe('Wall of Ice');
    expect(wall.advisory).toBe('wall_of_ice');
    expect(isLairRowClickable(wall)).toBe(true);
    expect(lairRowAffordance(wall)).toBe('advisory');
  });

  it('description kept verbatim (terrain-object clauses retained as GM-advisory prose, §7 residual)', () => {
    expect(wall.description).toBe(VERBATIM);
    expect(wall.description).toMatch(/AC 5, 30 hit points/i);
    expect(wall.description).toMatch(/pushed 5 feet/i);
    expect(wall.description).toMatch(/within 120 feet/i);
    expect(wall.description).toMatch(/disappears when the dragon uses this lair action again/i);
  });

  it('adult MA-0151 sibling key-shape parity: keys [name, advisory, description] byte-identical dict', () => {
    const adult = monstersData.find(m => m.index === 'adult-white-dragon');
    expect(Object.keys(wall)).toEqual(Object.keys(adult.lair_actions[2]));
    expect(JSON.stringify(wall)).toBe(JSON.stringify(adult.lair_actions[2]));
  });

  it('no machine-readable enforcement keys — no fake save/attack/damage/zone authored', () => {
    expect(wall.save_dc).toBeUndefined();
    expect(wall.save_type).toBeUndefined();
    expect(wall.attack_bonus).toBeUndefined();
    expect(wall.damage_dice_primary).toBeUndefined();
    expect(wall.zone).toBeUndefined();
  });

  it('advisory click logs ability_use record, zero save/attack/damage/zone', async () => {
    const logs = [];
    const setPopupHtml = vi.fn();
    const res = await resolveLairRow({
      action: wall,
      monsterName: 'Ancient White Dragon 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      handleSaveRoll: vi.fn(),
      handleAttack: vi.fn(),
      handleDamage: vi.fn(),
      handleZone: vi.fn(),
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].abilityName).toBe('Wall of Ice');
    expect(logs[0].description).toMatch(/casts wall of ice/i);
    expect(logs[0].description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(logs[0].description).not.toMatch(/save DC/i);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringMatching(/Lair Action — Wall of Ice/));
  });

  it('scope guards: [0] MA-0263 fog save row and [1] MA-0264 shards attack row byte-untouched; no lair_wall_of_ice te registered (§7 residual)', async () => {
    expect(lairRowAffordance(dragon.lair_actions[0])).toBe('save');
    expect(lairRowAffordance(dragon.lair_actions[1])).toBe('attack');
    const { getEffectDefinition } = await import('../combat/conditions/targetEffectDefinitions.js');
    expect(getEffectDefinition('lair_wall_of_ice')).toBeFalsy();
  });
});
