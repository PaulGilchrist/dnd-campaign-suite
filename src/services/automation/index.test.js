// ── #1997 index.test.js — MAIN canonical MECHANICS lane for automation/index.js ──
// Seam map: index.mistyWanderer.test.js header (#1995, closed 2 KEEP law) plus
// #1996 index.psychicTeleportation.test.js (closed 3 shed). Subject: resolveHandler
// (L675-700), executeHandler (L702-749), inline dispatchers spell_modifier L334 and
// damage_reduction L341-347, and the PASSIVE_RULE_EFFECTS table L290-297.
// THIS lane is the law for mechanics — feature lanes never re-pin it:
//   • null-shape early-outs L703-705 → strict null-shape table, no-side-effect guard.
//   • no-handler null seams: single-object table miss L699→L738-740 and array
//     no-actionable L729-730.
//   • error-catch composition L745-748 — exact console.error `[automation] Handler
//     ${type}/${effect} failed:` and full-string popup { type:'popup', payload:{
//     type:'automation_info', name, description:'Failed to execute <name>' } }.
//     Composed inline, NOT via automationInfoPopup (asserted bypassed).
//   • generic auto-array scan L716-734 — actionable filter L717-721 (registered type
//     + casting_time/action/trigger; passive_rule via PASSIVE_RULE_EFFECTS) and the
//     generic first-actionable ordering. The CLA-229 misty_wanderer prefer L723-727
//     is #1995's — no misty pin here.
//   • CLA-192 replacesWarMagic prefer L722 (prefer queries actionable, not raw auto).
//   • passive_rule route mechanics L676-677 — full PASSIVE_RULE_EFFECTS table,
//     including the savant school 5th-arg mapping from SAVANT_SCHOOLS L278-283.
//   • auto_effect table mechanics generically — unrecognized effect falls through every
//     effect route to the table miss → null (psychic route #1996, implosion
//     fingerprint #1998, web row #1999, misty #1995).
//   • table-lookup fallthrough L699 — dispatch, exact 5-arg forwarding through L743,
//     result pass-through L744. Prod-caller liveness verified 2026-10-16:
//     useCharActionsAutomation.js L448 (5-arg with characters), CharReactions.jsx
//     L255/L520, useAreaEffectHandlers.js, triggerSpells.js, useCombatSuperiorityModal
//     .js L219 (live stamps combat_superiority_attack_rider/_prompt_skill_check).
//   • SP-042 Eyebite row KEPT: sole home for this dispatch row + saveDc data fix
//     (handlers/spells/eyebiteHandler.test.js covers handler internals only).
// Shed here (feature subject files exist, exact names): SP-056 Grease spells.json
//   data pins (9 tests) → the grease pair home handlers/spells/
//   greaseAreaSaveHandler.handle.test.js (#1922) + greaseAreaSaveHandler.areaSave
//   .test.js (#1921) — registration live at index.js L556, cited there. The pure
//   data-shape assertions (range/duration/classes/area_of_effect) are flagged for
//   absorption by that pair — see FINAL REPORT.
// Old-file fix: it mocked '../../../shared/popupResponse.js' (root shared/ module)
// which NEVER intercepted the automationInfoPopup index.js imports from
// '../shared/popupResponse.js' (src/services/shared) — spell_modifier ran the real
// popup. Correct-path mock + exact-args pins below.
// Registration-symmetry audit (2026-10-16, cluster flagged in FINAL REPORT, NOT
// deleted): 29 HANDLER_MAP keys have zero prod producers across public/data,
// public/campaigns runtime data, and programmatic type stamps in src/server.
// No timers; turn-based row-click dispatch only; test-campaign only.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';

// ── Module-level mocks (paths exactly as index.js imports them) ──────────────

vi.mock('./handlers/combat/saveOnlyHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'save_only' })),
}));
vi.mock('./handlers/healing/healingHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'shared_healing' })),
}));
vi.mock('./handlers/combat/autoRerollHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'auto_reroll' })),
}));
vi.mock('./handlers/class-wizard/SavantHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'savant' })),
}));
vi.mock('./handlers/combat/damageReductionHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'damage_reduction' })),
}));
vi.mock('./handlers/class-sorcerer/protectiveFieldHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'protective_field' })),
}));
vi.mock('./handlers/class-barbarian/persistentRageHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'persistent_rage' })),
}));
vi.mock('./handlers/superiorDefenseHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'superior_defense' })),
}));
vi.mock('./handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'war_magic_cantrip' })),
}));
vi.mock('./handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
  handle: vi.fn(async () => ({ result: 'war_magic_spell' })),
}));
vi.mock('./handlers/spells/eyebiteHandler.js', () => ({
  handle: vi.fn(async () => ({ type: 'modal', modalName: 'eyebiteEffect', payload: { saveDc: 17 } })),
}));
vi.mock('../shared/popupResponse.js', () => ({
  automationInfoPopup: vi.fn(() => ({
    type: 'popup',
    payload: { type: 'automation_info', name: 'SENTINEL', automationType: 'spell_modifier', description: 'popup pass-through' },
  })),
}));

import { handle as saveOnlyHandle } from './handlers/combat/saveOnlyHandler.js';
import { handle as healingHandle } from './handlers/healing/healingHandler.js';
import { handle as autoRerollHandle } from './handlers/combat/autoRerollHandler.js';
import { handle as savantHandle } from './handlers/class-wizard/SavantHandler.js';
import { handle as damageReductionHandle } from './handlers/combat/damageReductionHandler.js';
import { handle as protectiveFieldHandle } from './handlers/class-sorcerer/protectiveFieldHandler.js';
import { handle as persistentRageHandle } from './handlers/class-barbarian/persistentRageHandler.js';
import { handle as superiorDefenseHandle } from './handlers/superiorDefenseHandler.js';
import { handle as cantripHandle } from './handlers/class-fighter-rogue/warMagicCantripHandler.js';
import { handle as spellHandle } from './handlers/class-fighter-rogue/warMagicSpellHandler.js';
import { handle as eyebiteHandle } from './handlers/spells/eyebiteHandler.js';
import { automationInfoPopup } from '../shared/popupResponse.js';

// ── Helpers ─────────────────────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    abilities: [{ name: 'Strength', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return { name: 'Test Action', automation: { ...automation } };
}

const characters = [{ name: 'Companion', level: 3 }];

beforeEach(() => {
  vi.clearAllMocks();
});

// ── null-shape early-outs (L703-705) ──────────────────────────────────────────

describe('executeHandler — null-shape table (L703-705)', () => {
  it.each([
    ['null action', null],
    ['undefined action', undefined],
    ['empty object', {}],
    ['automation: null', { automation: null }],
    ['automation: undefined', { automation: undefined }],
    ['name-only action (automation missing)', { name: 'No Automation' }],
  ])('returns null without touching any handler for %s', async (_label, action) => {
    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName, characters)).toBeNull();
    expect(saveOnlyHandle).not.toHaveBeenCalled();
    expect(healingHandle).not.toHaveBeenCalled();
    expect(autoRerollHandle).not.toHaveBeenCalled();
    expect(savantHandle).not.toHaveBeenCalled();
    expect(eyebiteHandle).not.toHaveBeenCalled();
    expect(automationInfoPopup).not.toHaveBeenCalled();
  });
});

// ── no-handler null seams: table miss (L699→L738-740) and array miss (L729-730) ──

describe('executeHandler — no-handler null seams', () => {
  it('returns null for a bare automation:{} — matches no route, misses the table', async () => {
    expect(await executeHandler({ name: 'Bare', automation: {} }, makePlayerStats(), campaignName, mapName)).toBeNull();
  });

  it('returns null for an automation.type absent from HANDLER_MAP (L699 miss → L738)', async () => {
    expect(await executeHandler(makeAction({ type: 'nonexistent_type' }), makePlayerStats(), campaignName, mapName)).toBeNull();
    expect(saveOnlyHandle).not.toHaveBeenCalled();
  });

  it('auto_effect with an unrecognized effect falls through every effect route to the table miss → null', async () => {
    // Generic auto_effect table-miss law; effect routes themselves: psychic #1996,
    // implosion fingerprint #1998, misty #1995. A wrong-route mutation returns non-null.
    const action = makeAction({ type: 'auto_effect', effect: 'nonexistent_effect', trigger: 'turn_start' });
    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toBeNull();
  });

  it('returns null for an array with no actionable entries (L729-730)', async () => {
    const action = { name: 'Dead Rows', automation: [{ type: 'unknown_type' }, { type: 'passive_rule', effect: 'unknown_savant' }, null] };
    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toBeNull();
    expect(autoRerollHandle).not.toHaveBeenCalled();
    expect(savantHandle).not.toHaveBeenCalled();
  });

  it('returns null for an empty array and for an all-null array', async () => {
    expect(await executeHandler({ name: 'Empty', automation: [] }, makePlayerStats(), campaignName, mapName)).toBeNull();
    expect(await executeHandler({ name: 'Nulls', automation: [null, null] }, makePlayerStats(), campaignName, mapName)).toBeNull();
  });
});

// ── table-lookup fallthrough: dispatch, 5-arg forwarding, pass-through ─────────

describe('executeHandler — table fallthrough dispatch (L699 → L743-744)', () => {
  it('forwards all five args to the resolved handler and passes its result through', async () => {
    const stats = makePlayerStats();
    const action = makeAction({ type: 'save_only', saveType: 'DEX' });
    const sentinel = { type: 'modal', modalName: 'savePrompt', payload: { saveType: 'DEX' } };
    saveOnlyHandle.mockResolvedValueOnce(sentinel);

    const result = await executeHandler(action, stats, campaignName, mapName, characters);

    expect(saveOnlyHandle).toHaveBeenCalledTimes(1);
    expect(saveOnlyHandle).toHaveBeenCalledWith(action, stats, campaignName, mapName, characters);
    expect(saveOnlyHandle.mock.calls[0][0]).toBe(action); // single-object path forwards the ORIGINAL action, not a copy
    expect(result).toBe(sentinel); // L744 identity pass-through
  });

  it('healing and self_healing share the same registered handler function', async () => {
    const stats = makePlayerStats();
    expect(await executeHandler(makeAction({ type: 'healing' }), stats, campaignName, mapName)).toEqual({ result: 'shared_healing' });
    expect(await executeHandler(makeAction({ type: 'self_healing' }), stats, campaignName, mapName)).toEqual({ result: 'shared_healing' });
    expect(healingHandle).toHaveBeenCalledTimes(2);
    expect(healingHandle.mock.calls[1][0].automation.type).toBe('self_healing');
  });
});

// ── error-catch composition (L745-748) ─────────────────────────────────────────

describe('executeHandler — error catch (L745-748)', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('catches an async rejection: exact console message, exact popup, popup helper bypassed', async () => {
    const action = makeAction({ type: 'healing' });
    action.name = 'Cure Wounds';
    const err = new Error('boom');
    healingHandle.mockRejectedValueOnce(err);

    const result = await executeHandler(action, makePlayerStats(), campaignName, mapName, characters);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[automation] Handler healing/undefined failed:', err);
    expect(result).toEqual({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Cure Wounds', description: 'Failed to execute Cure Wounds' },
    });
    expect(automationInfoPopup).not.toHaveBeenCalled(); // L747 composes inline, not via the helper
  });

  it('catches a sync throw via a passive_rule row and interpolates effect into the console message', async () => {
    const action = makeAction({ type: 'passive_rule', effect: 'abjuration_savant' });
    action.name = 'Savant Guard';
    const err = new Error('sync boom');
    savantHandle.mockImplementationOnce(() => {
      throw err;
    });

    const result = await executeHandler(action, makePlayerStats(), campaignName, mapName, characters);

    expect(console.error).toHaveBeenCalledWith('[automation] Handler passive_rule/abjuration_savant failed:', err);
    expect(result).toEqual({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Savant Guard', description: 'Failed to execute Savant Guard' },
    });
  });
});

// ── generic auto-array scan (L716-734) — NOT the CLA-229 prefer (#1995) ──────

describe('executeHandler — generic auto-array scan (L716-734)', () => {
  it('skips unregistered types and null entries, dispatches the first actionable entry', async () => {
    const action = { name: 'Scan', automation: [{ type: 'unknown_type' }, null, { type: 'auto_reroll', action: 'action' }] };

    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toEqual({ result: 'auto_reroll' });
    expect(autoRerollHandle).toHaveBeenCalledTimes(1);
  });

  it('inside an array, a registered entry WITHOUT casting_time/action/trigger is not actionable', async () => {
    const action = { name: 'Scan', automation: [{ type: 'healing' }, { type: 'auto_reroll', casting_time: '1 action' }] };

    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toEqual({ result: 'auto_reroll' });
    expect(healingHandle).not.toHaveBeenCalled();
  });

  it('a bare single-object automation still dispatches — the actionable filter is array-only', async () => {
    const action = makeAction({ type: 'healing' });

    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toEqual({ result: 'shared_healing' });
    expect(healingHandle).toHaveBeenCalledTimes(1);
  });

  it('generic ordering: the first actionable entry wins', async () => {
    const action = { name: 'Order', automation: [{ type: 'auto_reroll', action: 'action' }, { type: 'healing', action: 'action' }] };

    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toEqual({ result: 'auto_reroll' });
    expect(healingHandle).not.toHaveBeenCalled();
  });

  it.each([
    ['unregistered passive_rule is skipped, next actionable dispatches', [{ type: 'passive_rule', effect: 'unknown_savant' }, { type: 'auto_reroll', action: 'action' }], { result: 'auto_reroll' }],
    ['registered passive_rule is actionable without casting_time', [{ type: 'passive_rule', effect: 'divination_savant' }], { result: 'savant' }],
  ])('array filter %s (L719-720)', async (_label, automation, expected) => {
    expect(await executeHandler({ name: 'Passive Scan', automation }, makePlayerStats(), campaignName, mapName)).toEqual(expected);
  });

  // CLA-192 regression: Eldritch Knight lv18 Improved War Magic declares
  // automation [war_magic_cantrip, war_magic_spell(replacesWarMagic)]. The spell
  // half must dispatch so the row offers level 1-2 spells; previously automation[0]
  // (the lv7 cantrip picker) always won.
  it('CLA-192: the replacesWarMagic half is preferred over the leading cantrip half', async () => {
    const cantrip = { type: 'war_magic_cantrip', spellList: 'wizard_cantrips', action: 'action', casting_time: '1 action' };
    const spell = { type: 'war_magic_spell', spellList: 'wizard_spells', maxSpellLevel: 2, action: 'action', casting_time: '1 action', replacesWarMagic: true };
    const action = { name: 'Improved War Magic', automation: [cantrip, spell] };

    const result = await executeHandler(action, makePlayerStats(), campaignName, mapName, characters);

    expect(result).toEqual({ result: 'war_magic_spell' });
    expect(spellHandle).toHaveBeenCalledTimes(1);
    expect(cantripHandle).not.toHaveBeenCalled();
    // L732: forwarded action spreads the ORIGINAL but swaps automation to the selected row
    expect(spellHandle.mock.calls[0][0].automation).toBe(spell);
    expect(spellHandle.mock.calls[0][4]).toBe(characters);
  });

  it('CLA-192: replacesWarMagic on a NON-actionable entry cannot win — cantrip half still dispatches', async () => {
    // The prefer at L722 queries `actionable`, never the raw array.
    const action = {
      name: 'Improved War Magic',
      automation: [
        { type: 'war_magic_cantrip', spellList: 'wizard_cantrips', action: 'action', casting_time: '1 action' },
        { type: 'war_magic_spell', replacesWarMagic: true }, // no action/casting_time/trigger → filtered out
      ],
    };

    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toEqual({ result: 'war_magic_cantrip' });
    expect(spellHandle).not.toHaveBeenCalled();
  });

  it('CLA-192 control: base War Magic single-object automation dispatches the cantrip half', async () => {
    const action = makeAction({ type: 'war_magic_cantrip', spellList: 'wizard_cantrips', action: 'action', casting_time: '1 action' });

    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toEqual({ result: 'war_magic_cantrip' });
    expect(cantripHandle).toHaveBeenCalledTimes(1);
  });
});

// ── passive_rule route mechanics (L676-677, PASSIVE_RULE_EFFECTS L290-297) ────

describe('executeHandler — passive_rule route (full PASSIVE_RULE_EFFECTS table)', () => {
  it.each([
    ['abjuration_savant', 'Abjuration'],
    ['divination_savant', 'Divination'],
    ['evocation_savant', 'Evocation'],
    ['illusion_savant', 'Illusion'],
  ])('routes %s to SavantHandler with school %s as the 5th arg (wrapper drops characters)', async (effect, school) => {
    const action = makeAction({ type: 'passive_rule', effect });
    const stats = makePlayerStats();

    const result = await executeHandler(action, stats, campaignName, mapName, characters);

    expect(savantHandle).toHaveBeenCalledTimes(1);
    expect(savantHandle).toHaveBeenCalledWith(action, stats, campaignName, mapName, school);
    expect(result).toEqual({ result: 'savant' });
  });

  it('routes persistent_rage straight to persistentRageHandler with all five args', async () => {
    const action = makeAction({ type: 'passive_rule', effect: 'persistent_rage' });
    const stats = makePlayerStats();

    const result = await executeHandler(action, stats, campaignName, mapName, characters);

    expect(persistentRageHandle).toHaveBeenCalledWith(action, stats, campaignName, mapName, characters);
    expect(result).toEqual({ result: 'persistent_rage' });
  });

  it('routes superior_defense straight to superiorDefenseHandler with all five args', async () => {
    const action = makeAction({ type: 'passive_rule', effect: 'superior_defense' });
    const stats = makePlayerStats();

    const result = await executeHandler(action, stats, campaignName, mapName, characters);

    expect(superiorDefenseHandle).toHaveBeenCalledWith(action, stats, campaignName, mapName, characters);
    expect(result).toEqual({ result: 'superior_defense' });
  });

  it('table miss (unknown or missing effect) falls through HANDLER_MAP.passive_rule (absent) → null', async () => {
    expect(await executeHandler(makeAction({ type: 'passive_rule', effect: 'unknown_savant' }), makePlayerStats(), campaignName, mapName)).toBeNull();
    expect(await executeHandler(makeAction({ type: 'passive_rule' }), makePlayerStats(), campaignName, mapName)).toBeNull();
    expect(savantHandle).not.toHaveBeenCalled();
    expect(persistentRageHandle).not.toHaveBeenCalled();
    expect(superiorDefenseHandle).not.toHaveBeenCalled();
  });
});

// ── spell_modifier inline dispatcher (L334) ────────────────────────────────────

describe('executeHandler — spell_modifier dispatcher (L334)', () => {
  it('returns null for name === "Metamagic" WITHOUT invoking automationInfoPopup', async () => {
    const action = makeAction({ type: 'spell_modifier' });
    action.name = 'Metamagic';

    expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toBeNull();
    expect(automationInfoPopup).not.toHaveBeenCalled();
  });

  it('any other name delegates to automationInfoPopup(action) and passes its return through', async () => {
    const action = makeAction({ type: 'spell_modifier' });
    action.name = 'Quickened Spell';

    const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

    expect(automationInfoPopup).toHaveBeenCalledTimes(1);
    expect(automationInfoPopup).toHaveBeenCalledWith(action);
    expect(result).toEqual({
      type: 'popup',
      payload: { type: 'automation_info', name: 'SENTINEL', automationType: 'spell_modifier', description: 'popup pass-through' },
    });
  });

  it('comparison is strict equality: lowercase "metamagic" gets the popup, not null', async () => {
    const action = makeAction({ type: 'spell_modifier' });
    action.name = 'metamagic';

    const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(automationInfoPopup).toHaveBeenCalledWith(action);
  });
});

// ── damage_reduction inline dispatcher (L341-347) ──────────────────────────────

describe('executeHandler — damage_reduction dispatcher (L341-347)', () => {
  it('cost.resource psionicEnergy steers to protectiveFieldHandler (dispatcher arrow forwards 4 — drops characters, arity benign)', async () => {
    const action = makeAction({ type: 'damage_reduction', cost: { resource: 'psionicEnergy' } });
    const stats = makePlayerStats();

    const result = await executeHandler(action, stats, campaignName, mapName, characters);

    expect(protectiveFieldHandle).toHaveBeenCalledWith(action, stats, campaignName, mapName); // L341 arrow has 4 params; characters dropped before invoke
    expect(damageReductionHandle).not.toHaveBeenCalled();
    expect(result).toEqual({ result: 'protective_field' });
  });

  it.each([
    ['another resource', { resource: 'ki' }],
    ['empty cost object', {}],
    ['undefined cost', undefined],
  ])('cost %s falls through to damageReductionHandler', async (_label, cost) => {
    const action = makeAction({ type: 'damage_reduction', cost });

    const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

    expect(damageReductionHandle).toHaveBeenCalledTimes(1);
    expect(protectiveFieldHandle).not.toHaveBeenCalled();
    expect(result).toEqual({ result: 'damage_reduction' });
  });
});

// ── SP-042 Eyebite regression (kept: sole home for dispatch row + saveDc fix) ──
// Reported: casting Eyebite produced no effect (handler never invoked, an info
// popup shown instead of the effect modal). Separately, the spell data was missing
// saveDc, so the WIS save DC fell back to the default 10.

describe('SP-042 Eyebite row (L527)', () => {
  it('routes type:eyebite via the table fallthrough to its handler and returns the modal', async () => {
    const action = makeAction({ type: 'eyebite', saveType: 'WIS', saveDc: 'spell_save_dc', range: '60 ft', duration: '1_minute' });
    const stats = makePlayerStats();

    const result = await executeHandler(action, stats, campaignName, mapName);

    expect(eyebiteHandle).toHaveBeenCalledTimes(1);
    expect(eyebiteHandle).toHaveBeenCalledWith(action, stats, campaignName, mapName, undefined); // 4-arg caller: characters forwarded as undefined (arity benign)
    expect(result).toEqual({ type: 'modal', modalName: 'eyebiteEffect', payload: { saveDc: 17 } });
  });

  it.each([
    'public/data/spells.json',
    'public/data/2024/spells.json',
  ])('declares saveDc: spell_save_dc for Eyebite in %s', (dataFile) => {
    const spells = JSON.parse(readFileSync(resolve(process.cwd(), dataFile), 'utf8'));
    const automation = spells.find((s) => s.index === 'eyebite')?.automation;

    expect(automation).toBeDefined();
    expect(automation.saveType).toBe('WIS');
    expect(automation.saveDc).toBe('spell_save_dc');
  });
});
