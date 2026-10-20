// @maintained-by-ai
// MA-0024 lair-action gated-row model — service BEHAVIOR lane + whole-DB
// lair DATA census. This file once carried ~60 per-ticket data-lock
// describes (587 its); it now verifies the service contract once and drives
// every row in monsters.json PROGRAMMATICALLY (names-by-name census, #1086),
// so the coverage is WIDER (all 38 lair carriers × all 98 rows) while the
// count is minimal.
//
// Cite-owner split (do not duplicate here):
//   - initiative-seam insertion / assembly: initiativeService.test.js (#1079),
//     encounterToInitiative.test.js. Lair actions are GM-clicked by design —
//     NO initiative-20 automation seam, no wall-clock anywhere
//     (LAIR_ADVISORY_NOTE; no-timers mandate) — cited, not re-driven.
//   - te registration CONTENT: targetEffectDefinitions.test.js golden census
//     (#820). Here only the DATA⇄REGISTRY join (authored keys resolve).
//   - chip render + failed-save condition grants: MonsterCardModal.lair-*.
//     test.jsx, SaveAttackAoeModal.lair-*.test.jsx, saveProcessing tests
//     (MA-0017 seam) own those consumers.
//   - legendary uses/gate economics: monsterLegendaryUses lane (#1082/#1092).
//     Lair rows carry no uses counter — one click = one adjudicated effect.
//
// Old→new map: MA-0024 classification/resolve suites → describes below
// (fixtures kept). MA-0041/0062/0074/0117/0128/0379/0594/1059/1209/1753…
// per-row save-field prose locks → "save rows prose-agree" tripwire.
// MA-0085/0137/0255/0200 typo locks → "machine dice rollable" tripwire.
// MA-0042/0063/0075/0097/0130/0166/0177/0199/0210/0254/0378/0582/0595/0596/
// 1649 zone locks → "zone te join" + golden affordance census.
// MA-0107/0222 dream-plane → "dream-plane join" (consumer: saveProcessing.
// dream-plane). MA-0140/0151/0221/0265/1207/1208/1060/0380 advisory logs →
// advisory route contract + whole-disk advisory census. Per-ticket
// "sibling untouched" guards → golden census (any drift re-flags here).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isLairRowClickable,
  lairRowAffordance,
  resolveLairRow,
  buildLairRefusalLog,
  buildLairAdvisoryLog,
} from './monsterLairActions.js';
import { canRollExpression } from '../dice/diceRoller.js';
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
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

// Every structured lair row in the whole DB, by monster index + position.
const ALL_ROWS = monstersData
  .filter(m => Array.isArray(m.lair_actions))
  .flatMap(m => m.lair_actions.map((la, i) => ({ m, i, la, key: `${m.index}[${i}]` })));

function handlers() {
  return {
    setPopupHtml: vi.fn(),
    handleSaveRoll: vi.fn(),
    handleAttack: vi.fn(),
    handleDamage: vi.fn(),
    handleZone: vi.fn(),
  };
}

afterEach(() => vi.clearAllMocks());

describe('MA-0024 classification contract — isLairRowClickable / lairRowAffordance', () => {
  it.each([
    ['legacy raw string (live carrier: lich[0])', monstersData.find(m => m.index === 'lich').lair_actions[0]],
    ['null', null],
    ['nameless dict WITH save_dc (live carrier: lich[2], DC 18)', monstersData.find(m => m.index === 'lich').lair_actions[2]],
    ['named row with no mechanic keys (live carrier: vampire-nightbringer[0])', monstersData.find(m => m.index === 'vampire-nightbringer').lair_actions[0]],
    ['named row whose only dice is the unparseable letter-O typo', { name: 'Spew', damage_dice_primary: '1dlO' }],
  ])('%s is never clickable and unresolvable', (_label, row) => {
    expect(isLairRowClickable(row)).toBe(false);
    expect(lairRowAffordance(row)).toBeNull();
  });

  it.each([
    ['save (authored save_dc)', { name: 'Grasping Tide', save_dc: 14, save_type: 'Strength' }, 'save'],
    ['attack (attack_bonus)', { name: 'Jagged Ice Shards', attack_bonus: 7 }, 'attack'],
    ['damage (rollable dice, no save/attack)', { name: 'Spew', damage_dice_primary: '3d6' }, 'damage'],
    ['zone (zone.radius_ft with NO save — MA-0043 shape)', { name: 'Shroud of Darkness', zone: { radius_ft: 15, no_save: true } }, 'zone'],
    ['advisory (explicit advisory key)', { name: 'Wall of Ice', advisory: 'wall_of_ice' }, 'advisory'],
    ['CLA-325: advisory beats save_dc — control-spell save stays a GM record', PHANTASMAL, 'advisory'],
    ['zone-without-save beats advisory', { name: 'Fog', advisory: 'fog_cloud', zone: { radius_ft: 20 } }, 'zone'],
    ['save beats attack_bonus (save leg adjudicates)', { name: 'Composite', save_dc: 15, attack_bonus: 9 }, 'save'],
    ['zone WITH save keeps save affordance (insect-cloud shape)', { name: 'Insect Cloud', save_dc: 15, zone: { radius_ft: 20 } }, 'save'],
  ])('%s classifies as its lane', (_label, row, expected) => {
    expect(isLairRowClickable(row)).toBe(true);
    expect(lairRowAffordance(row)).toBe(expected);
  });
});

describe('resolveLairRow — one click, one adjudicated effect', () => {
  const dragon = i => monstersData.find(m => m.index === i).lair_actions;

  it.each([
    ['save', dragon('adult-black-dragon')[0], 'save'],
    ['attack', dragon('adult-white-dragon')[1], 'attack'],
    ['damage', { name: 'Spew', damage_dice_primary: '3d6', description: 'x' }, 'damage'],
    ['zone', dragon('adult-black-dragon')[2], 'zone'],
  ])('%s lane routes through its handler with the documented payload and nothing else', async (_label, row, lane) => {
    const h = handlers();
    const res = await resolveLairRow({
      action: row, monsterName: 'Test 1', campaignName: 'test-campaign', ...h,
      saveDamageFormula: '4d8-passthru', saveConditions: ['prone'],
    });
    expect(res).toEqual({ resolved: true, affordance: lane });
    const handlerByLane = { save: 'handleSaveRoll', attack: 'handleAttack', damage: 'handleDamage', zone: 'handleZone' };
    const spy = h[handlerByLane[lane]];
    const call = { save: [row, '4d8-passthru', ['prone']], attack: [row.name, row.attack_bonus, row], damage: [row.name, row.damage_dice_primary, '', row], zone: [row] }[lane];
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(...call);
    for (const other of Object.values(handlerByLane)) {
      if (other !== handlerByLane[lane]) expect(h[other]).not.toHaveBeenCalled();
    }
    expect(h.setPopupHtml).not.toHaveBeenCalled();
  });

  it('advisory row: popup + exactly one spell-named ability_use log, zero rolls (CLA-325)', async () => {
    const logs = [];
    const h = handlers();
    const res = await resolveLairRow({
      action: PHANTASMAL, monsterName: 'Aboleth 1', campaignName: 'test-campaign', ...h,
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(h.handleSaveRoll).not.toHaveBeenCalled();
    expect(h.handleAttack).not.toHaveBeenCalled();
    expect(h.handleDamage).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].characterName).toBe('Aboleth 1');
    expect(logs[0].abilityName).toBe('Phantasmal Force');
    expect(logs[0].description).toContain('phantasmal force');
    expect(logs[0].description).toContain('save DC 16 Intelligence');
    expect(logs[0].description).toMatch(/initiative 20.*GM-enforced|GM-enforced/);
    expect(logs[0].description).toMatch(/24-hour/i);
  });

  it.each([
    ['named row with no mechanic (vampire-nightbringer[0])', monstersData.find(m => m.index === 'vampire-nightbringer').lair_actions[0], 'Children of the Night'],
    ['legacy raw string (lich[0])', monstersData.find(m => m.index === 'lich').lair_actions[0], 'Lair Action'],
  ])('unresolvable %s: refusal popup + lair_action_refused log, zero handlers', async (_label, row, expectedAbility) => {
    const logs = [];
    const h = handlers();
    const res = await resolveLairRow({
      action: row, monsterName: 'Test 1', campaignName: 'test-campaign', ...h,
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: false, reason: 'unresolvable' });
    expect(String(h.setPopupHtml.mock.calls[0][0])).toContain('Lair Action Refused');
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('lair_action_refused');
    expect(logs[0].abilityName).toBe(expectedAbility);
    for (const lane of ['handleSaveRoll', 'handleAttack', 'handleDamage', 'handleZone']) expect(h[lane]).not.toHaveBeenCalled();
  });

  it('MA-0380: rows with advisory_message log/popup their own honest copy; default rows keep the MA-0024 illusion byte-copy', async () => {
    const logs = [];
    const msg = 'rolls d10 for ONE random eye ray; GM adjudicates';
    const row = { name: 'Surfaced Eye', advisory: 'eye_rays', advisory_message: msg, description: 'x' };
    const h = handlers();
    const res = await resolveLairRow({
      action: row, monsterName: 'Beholder 1', campaignName: 'test-campaign', ...h,
      deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
    });
    expect(res).toEqual({ resolved: true, affordance: 'advisory' });
    expect(logs).toHaveLength(1);
    expect(logs[0].description).toContain(msg);
    expect(logs[logs.length - 1].description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(String(h.setPopupHtml.mock.calls[0][0])).toContain(msg);
    expect(String(h.setPopupHtml.mock.calls[0][0])).not.toMatch(/no components required, concentration/i);
    // default copy preserved byte-identical for rows WITHOUT advisory_message:
    expect(buildLairAdvisoryLog({ monsterName: 'Aboleth 1', action: PHANTASMAL }).description)
      .toContain('casts phantasmal force (save DC 16 Intelligence) — advisory record');
  });

  it('refusal log builder carries monster/action names and the refusal automationType', () => {
    const log = buildLairRefusalLog({ monsterName: 'Aboleth 1', actionName: 'X' });
    expect(log.automationType).toBe('lair_action_refused');
    expect(log.characterName).toBe('Aboleth 1');
    expect(log.description).toContain('Zero effect');
  });
});

describe('monsters.json lair census — whole-DB tripwires (replaces per-ticket data locks)', () => {
  it('golden affordance census: 63 save / 13 zone / 3 attack / 14 advisory, inert roster by name', () => {
    const counts = {};
    const inert = [];
    for (const { key, la } of ALL_ROWS) {
      const aff = lairRowAffordance(la);
      counts[String(aff)] = (counts[String(aff)] || 0) + 1;
      if (!aff) inert.push(key);
    }
    expect(counts).toEqual({ save: 63, zone: 13, attack: 3, advisory: 14, null: 5 });
    expect(inert.sort()).toEqual([
      'lich[0]', 'lich[1]', 'lich[2]', 'vampire-nightbringer[0]', 'vampire-nightbringer[1]',
    ].sort());
    // invariants: raw strings and nameless dicts never clickable; every
    // clickable row has a name and a non-null lane.
    for (const { la } of ALL_ROWS) {
      if (typeof la === 'string' || (la && !la.name)) expect(isLairRowClickable(la)).toBe(false);
      if (la && isLairRowClickable(la)) expect(lairRowAffordance(la)).not.toBeNull();
    }
  });

  it('every row in the DB routes through its classified lane exactly once (inert rows refuse exactly once)', async () => {
    for (const { key, la } of ALL_ROWS) {
      const h = handlers();
      const logs = [];
      const res = await resolveLairRow({
        action: la, monsterName: `Census ${key}`, campaignName: 'test-campaign', ...h,
        saveDamageFormula: '1d4', saveConditions: ['prone'],
        deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
      });
      const aff = lairRowAffordance(la);
      if (!aff) {
        expect(res, key).toEqual({ resolved: false, reason: 'unresolvable' });
        expect(logs, key).toHaveLength(1);
        expect(logs[0].automationType, key).toBe('lair_action_refused');
        for (const lane of ['handleSaveRoll', 'handleAttack', 'handleDamage', 'handleZone']) expect(h[lane], key).not.toHaveBeenCalled();
      } else if (aff === 'save') {
        expect(res, key).toEqual({ resolved: true, affordance: 'save' });
        expect(h.handleSaveRoll, key).toHaveBeenCalledWith(la, '1d4', ['prone']);
        expect(h.handleZone, key).not.toHaveBeenCalled();
      } else if (aff === 'attack') {
        expect(res, key).toEqual({ resolved: true, affordance: 'attack' });
        expect(h.handleAttack, key).toHaveBeenCalledWith(la.name, la.attack_bonus, la);
        expect(h.handleSaveRoll, key).not.toHaveBeenCalled();
      } else if (aff === 'zone') {
        expect(res, key).toEqual({ resolved: true, affordance: 'zone' });
        expect(h.handleZone, key).toHaveBeenCalledWith(la);
        expect(h.handleSaveRoll, key).not.toHaveBeenCalled();
        expect(h.setPopupHtml, key).not.toHaveBeenCalled();
      } else {
        expect(res, key).toEqual({ resolved: true, affordance: 'advisory' });
      }
      expect(logs, key).toHaveLength(aff === 'advisory' || aff === null ? 1 : 0);
    }
  });

  it('advisory census: every advisory row logs ONE ability_use named after the row with the initiative-20 GM-enforced note, zero handler rolls', async () => {
    const advRows = ALL_ROWS.filter(({ la }) => lairRowAffordance(la) === 'advisory');
    expect(advRows.length).toBeGreaterThan(10);
    for (const { key, la } of advRows) {
      const h = handlers();
      const logs = [];
      await resolveLairRow({
        action: la, monsterName: `Census ${key}`, campaignName: 'test-campaign', ...h,
        deps: { addEntry: (_c, e) => { logs.push(e); return Promise.resolve(); } },
      });
      expect(logs, key).toHaveLength(1);
      expect(logs[0].type, key).toBe('ability_use');
      expect(logs[0].abilityName, key).toBe(la.name);
      expect(logs[0].description, key).toMatch(/initiative 20 \(GM-enforced/i);
      if (la.advisory_message) expect(logs[0].description, key).toContain(la.advisory_message);
      for (const lane of ['handleSaveRoll', 'handleAttack', 'handleDamage', 'handleZone']) expect(h[lane], key).not.toHaveBeenCalled();
    }
  });

  it('save rows prose-agree: numeric DC + type, description DC clause matches, dc_success honest (MA-0041/0128 drift families)', () => {
    const failures = [];
    for (const { key, la } of ALL_ROWS) {
      if (lairRowAffordance(la) !== 'save') continue;
      if (typeof la.save_dc !== 'number') failures.push(`${key}: non-numeric save_dc`);
      if (!la.save_type) failures.push(`${key}: save row without save_type`);
      const md = String(la.description || '').match(/DC (\d+) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i);
      // Rows citing a spell by name (spike growth etc.) carry no inline DC clause — prose-optional by design.
      if (md) {
        if (+md[1] !== la.save_dc) failures.push(`${key}: description DC ${md[1]} != save_dc ${la.save_dc}`);
        if (md[2].toLowerCase() !== String(la.save_type).toLowerCase()) failures.push(`${key}: description ${md[2]} != save_type ${la.save_type}`);
      }
      if (la.dc_success != null && !['half', 'none', 'full'].includes(la.dc_success)) failures.push(`${key}: dc_success=${la.dc_success}`);
      // Engine default for a save row's success leg is 'half' (MonsterCardModal resolveBlockSaveDcSuccess :286), so half-text with an ABSENT dc_success is honest; an authored value must agree.
      if (/half damage/i.test(la.save_effect || '') && la.dc_success != null && la.dc_success !== 'half') failures.push(`${key}: 'Half damage' text vs dc_success=${la.dc_success}`);
    }
    expect(failures).toEqual([]);
  });

  it('machine dice rollable everywhere (MA-0085/0137/0255 letter-O typo family) — descriptions may keep typos, fields may not', () => {
    expect(canRollExpression('1dlO')).toBe(false);
    for (const { key, la } of ALL_ROWS) {
      for (const field of ['damage_dice_primary', 'damage_dice_secondary']) {
        if (la?.[field]) expect(canRollExpression(la[field]), `${key}.${field}=${la[field]}`).toBe(true);
      }
    }
  });

  it('pure-damage save_effect boilerplate extracts ZERO conditions — no condition words smuggled into damage-only rows', () => {
    const pure = ALL_ROWS.filter(({ la }) => lairRowAffordance(la) === 'save' && /^Failure: \d+ \(\d+d\d+\) \w+ damage\. Success:/i.test(la.save_effect || ''));
    expect(pure.length).toBe(10);
    for (const { key, la } of pure) expect(extractConditionsFromSaveEffect(la.save_effect), key).toEqual([]);
  });

  it('zone te join: every authored zone.effect_key resolves in the registry; lair_* keys live in the Lair group (registration content: #820 golden census)', () => {
    const keys = new Set(ALL_ROWS.map(({ la }) => la?.zone?.effect_key).filter(Boolean));
    expect(keys.size).toBeGreaterThan(8);
    for (const key of keys) {
      const def = getEffectDefinition(key);
      expect(def, key).toBeTruthy();
      if (key.startsWith('lair_')) expect(def.group, key).toBe('Lair');
    }
  });

  it('dream-plane join (MA-0107/MA-0222): the two gold rows arm lair_dream_plane and NEVER the demiplane parser (consumer: saveProcessing.dream-plane)', () => {
    const dreamRows = ALL_ROWS.filter(({ la }) => /dream plane/i.test(la?.save_effect || ''));
    expect(dreamRows.map(({ key }) => key)).toEqual(['adult-gold-dragon[1]', 'ancient-gold-dragon[1]']);
    for (const { key, la } of dreamRows) {
      expect(parseDreamPlaneBanishClause(la.save_effect), key).toEqual({ effect: 'lair_dream_plane' });
      expect(parseBanishTransportClause(la.save_effect), key).toBeNull();
      expect(extractConditionsFromSaveEffect(la.save_effect), key).toEqual([]);
    }
  });

  it('distinct clickable names within every lair block (consumers key effects by action.name — MA-1779)', () => {
    for (const m of monstersData.filter(m => Array.isArray(m.lair_actions))) {
      const names = m.lair_actions.filter(la => lairRowAffordance(la)).map(la => la.name);
      expect(new Set(names).size, m.index).toBe(names.length);
    }
  });
});
