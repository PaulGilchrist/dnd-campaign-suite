// spellCastHandler .popup lane (#1969) — owns the single-spell free-cast popup
// composition of spellCastHandler.js: grantFreeCastPopup (L354-368) + castLabels
// (L11-15), reached at L417. SEPTET SEAM MAP lives in spellCastHandler.damage
// .test.js header (SEPTET HEAD — the law). Bare payload.html = this lane's
// result identity; automation_info popups with the automation echo belong to
// the earlier routes (#1967 gate legs, #1968 exhausted/chooser, #1970 blocks,
// #1972 refusal) — discriminated below, never content-pinned here.
//
// Production liveness (verified): sole prod caller is the automation dispatch
// table `free_spell: handleSpellCast` (src/services/automation/index.js:313).
// Live prod rows landing ON this lane (full scan of public/data/**.json):
//   • Fey Magic / Shadow Magic (public/data/2024/feats.json): single-element
//     spell ['Misty Step'] / ['Invisibility'] arrays, perSpellTracking,
//     NO uses/usesMax → FREE_CAST_ROUTES miss (L377/L379 both require
//     counters) → length 1 → popup grant, spellNames stamped VERBATIM — the
//     array pass-through (stamp is spellNames, html is spellName) is pinned
//     here because prod ships arrays.
//   • Spell-less free_spell rows resolve spellName = action.name (L385
//     fallback) — the name-lane leg pinned below.
//   • Synthetic ONLY (no prod row today): noConcentration/duration labels on
//     rows reaching THIS popup and the spell-less name-fallback row — prod
//     free_spell rows carry no noConcentration/duration fields reaching here
//     (free_spell+noConc multi is War God's Blessing, caught by
//     activateWarGodsBlessing #1971; uses+recharge+conc 'Detect Thoughts' is
//     intercepted by FREE_CAST_ROUTES[1] #1970). The castLabels legs below are
//     locked live-code contracts on honest synthetic fixtures.
//
// Quirk-lock (drift found at source, pinned AS-IS):
//   Q1: duration label uses replace('_', ' ') — FIRST underscore only
//     ('concentration_till_end_of_turn' → 'concentration till end_of_turn';
//     '1 day' renders verbatim, no underscore to replace).
//   Q2: an unknown spell (lookup null/undefined) STILL grants by NAME —
//     popup says "cast X normally — no spell slot will be consumed" for a
//     spell the spell sheet may not even list.
//   Q3: stored freeCast [] is truthy — never re-stamped (identity of the
//     stamp lives on the #1968 non-tracking multi lane; the ABSENCE of a
//     re-stamp here is this lane's input-state guard pin).
//
// ── Lane closure / handoff ──
// • Trimmed vs old: dispatch mislabels fixed (type was 'spell' — index.js:313
//   dispatches 'free_spell'; name was 'Divine Smite' — a damage ability that
//   never belongs on this lane, same D3 family as #1968); the repeat-cast block
//   asserted a STALE result object (dangling assertion, removed — re-cast now
//   re-asserts honestly); fragment toContain pins upgraded to full-string own
//   composition (canonical HERE per map: "all grantFreeCastPopup html/label/
//   stamp pins remain yours").
// • Foreign-canonical, NOT re-pinned: majesty/multi/counter/CD-charge/multi
//   gate-leg html and popups (#1967/#1968/#1970); rollExpression/EE non-fire
//   and type-only popup fallbacks (#1966); fetch URL SELECTION and fetch-reject
//   → popup type (#1971 — I pin composition on fetched data instead).
// • The '_Mantle_of_Majesty_freeCast' stamp never fires on this lane (the
//   majesty name-gate L370-372 consumes that action upstream, #1967) — even
//   the gate-miss fall-through (no concentration) keeps the majesty name but
//   never the buff write; pinned only as activeBuffs-absence below.
// No game timers — turn-based handler; tests await directly, no setTimeout.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './spellCastHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import storage from '../../../ui/storage.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

// Dispatch reality (index.js:313): automation.type is 'free_spell', not 'spell'.
// Base row mirrors the LIVE prod Fey Magic feat shape (2024/feats.json):
// free_spell + single spell + no counters → grantFreeCastPopup.
function makeAction(automation = {}, name = 'Fey Magic') {
  return {
    name,
    description: 'You always have the spell prepared.',
    automation: {
      type: 'free_spell',
      casting_time: '1 bonus action',
      ...automation,
    },
  };
}

const knownMistyStep = { name: 'Misty Step', school: 'Conjuration' };
const knownLight = { name: 'Light', school: 'Evocation' };

function spellNamesTable(map = {}) {
  runtimeState.getRuntimeValue.mockImplementation((who, key) =>
    (key in map ? map[key] : null));
}

describe('spellCastHandler.popup - grantFreeCastPopup canonical composition (#1969)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spellNamesTable({});
    // Default: fetch must NOT be reached — known-spell input on every popup
    // test here unless a test deliberately overrides with fetched data.
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('known spell: no lookup expected'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('first press grants the popup with the full own-composition html — bare payload, no automation echo (result identity)', async () => {
    const ps = makePlayerStats({ spellAbilities: { spells: [knownMistyStep] } });
    const action = makeAction({ spell: 'Misty Step' });

    const result = await handle(action, ps, campaignName, null);

    // Canonical full-string pin for this lane (map: grantFreeCastPopup html is
    // #1969's). Note the exact spacing: label runs flush against the name.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Fey Magic</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Misty Step',
      },
    });
    // Result identity: bare html payload ONLY — the automation_info + automation
    // echo shape belongs to the earlier blocked/info routes, never here.
    expect(Object.keys(result.payload)).toEqual(['html']);
    expect(result.payload.automation).toBeUndefined();
    expect(result.payload.description).toBeUndefined();
    expect(result.payload.type).toBeUndefined();
  });

  it('first press call table: one freeCast-key read, one spellNames stamp, zero side effects on the popup route', async () => {
    const ps = makePlayerStats({ spellAbilities: { spells: [knownMistyStep] } });
    const action = makeAction({ spell: 'Misty Step' });

    await handle(action, ps, campaignName, null);

    // The single read on this route is the grant latch, exact args.
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledTimes(1);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Fey_Magic_freeCast', campaignName);
    // First cast stamps the spell names array once (spellNames, NOT the scalar
    // spellName the html shows — prod Fey Magic ships spell:['Misty Step'],
    // so the array pass-through is prod-exact, not fixture invention).
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Magic_freeCast', ['Misty Step'], campaignName],
    ]);
    // Own-composition delegation guards: the popup never rolls, never re-fetches
    // a KNOWN spell (.damage #1966 canonical for known-damaging short-circuit;
    // this is the known-NON-damaging leg), never logs, concentrates, expires,
    // or persists — and never reads activeBuffs (majesty gate is #1967's).
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(runtimeState.getRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'activeBuffs', campaignName);
  });

  it('stored freeCast latch — truthy true AND truthy [] — never re-stamps, identical popup (Q3)', async () => {
    const ps = makePlayerStats({ spellAbilities: { spells: [knownMistyStep] } });

    for (const stored of [true, ['Misty Step'], []]) {
      spellNamesTable({ '_Fey_Magic_freeCast': stored });
      const result = await handle(makeAction({ spell: 'Misty Step' }), ps, campaignName, null);
      expect(runtimeState.setRuntimeValue, JSON.stringify(stored)).not.toHaveBeenCalled();
      expect(result.payload.html).toBe('<b>Fey Magic</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Misty Step');
    }
  });

  it('spellName fallback lane: spell-less free_spell rows resolve spellName and stamp to action.name (Q2 composition)', async () => {
    // Spell absent from the sheet → lookup fetches, finds nothing, returns null
    // (#1971 owns URL selection + fetch-reject) — yet the grant still fires
    // entirely from action.name. URL here is incidental to this lane's pin.
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => [] });
    const ps = makePlayerStats({ spellAbilities: { spells: [] } });
    const action = makeAction({}, 'Blessing of the Sea');

    const result = await handle(action, ps, campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Blessing of the Sea</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Blessing of the Sea',
      },
    });
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Blessing_of_the_Sea_freeCast', ['Blessing of the Sea'], campaignName],
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('mapName is a dead parameter: popup html and stamp byte-identical with or without it', async () => {
    const ps = makePlayerStats({ spellAbilities: { spells: [knownLight] } });

    const bare = await handle(makeAction({ spell: 'Light' }), ps, campaignName, null);
    const mapped = await handle(makeAction({ spell: 'Light' }), ps, campaignName, 'combat-map-1');

    expect(mapped).toEqual(bare);
    expect(mapped.payload.html).toBe('<b>Fey Magic</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Light');
    // Exactly two latch stamps across both presses (latch reads return null in
    // this fixture's table — the point is that _mapName adds no write, no key,
    // and no byte of output).
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Magic_freeCast', ['Light'], campaignName],
      ['TestWizard', '_Fey_Magic_freeCast', ['Light'], campaignName],
    ]);
  });

  it('unknown spell fetched but absent still grants by name — popup html and stamp from the name, not the data (Q2)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => [] });
    const ps = makePlayerStats({ spellAbilities: { spells: [] } });

    const result = await handle(makeAction({ spell: 'Heart Sight' }), ps, campaignName, null);

    // URL SELECTION is #1971 canonical; this pins the composition the fetch
    // leg hands to this lane: spellData undefined → popup grants anyway.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Fey Magic</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Heart Sight',
      },
    });
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Magic_freeCast', ['Heart Sight'], campaignName],
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('prod array spell: spell:["Misty Step"] stamps the array verbatim, html shows the scalar name', async () => {
    // Fey Magic verbatim (2024/feats.json, description trimmed for the pin):
    // length-1 array never reaches the #1968 multi gate (L409 > 1), html uses
    // the scalar spellName while the stamp carries the array.
    const ps = makePlayerStats({ spellAbilities: { spells: [knownMistyStep] } });
    const action = {
      name: 'Fey Magic',
      description: 'You always have that spell and the Misty Step spell prepared.',
      automation: {
        type: 'free_spell',
        spell: ['Misty Step'],
        perSpellTracking: true,
        recharge: 'long_rest',
        casting_time: '1 bonus action',
      },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.html).toBe('<b>Fey Magic</b><br/>You always have that spell and the Misty Step spell prepared.<br/><br/><b>Free cast of:</b> Misty Step');
    expect(result.payload.html).not.toContain('[');
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Magic_freeCast', ['Misty Step'], campaignName],
    ]);
  });
});

describe('spellCastHandler.popup - castLabels composition on the grant popup (L11-15, synthetic contracts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spellNamesTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('known spell: no lookup expected'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  const psKnown = () => makePlayerStats({ spellAbilities: { spells: [knownMistyStep] } });
  const htmlPrefix = '<b>Fey Magic</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Misty Step';

  it('noConcentration true appends the concentration label flush-right; false/absent append nothing', async () => {
    let result = await handle(makeAction({ spell: 'Misty Step', noConcentration: true }), psKnown(), campaignName, null);
    expect(result.payload.html).toBe(`${htmlPrefix} Does not require Concentration.`);

    result = await handle(makeAction({ spell: 'Misty Step', noConcentration: false }), psKnown(), campaignName, null);
    expect(result.payload.html).toBe(htmlPrefix);

    result = await handle(makeAction({ spell: 'Misty Step' }), psKnown(), campaignName, null);
    expect(result.payload.html).toBe(htmlPrefix);
  });

  it('duration label: first-underscore-only replacement, verbatim spaces, empty-string falsy drop (Q1)', async () => {
    let result = await handle(makeAction({ spell: 'Misty Step', duration: '1_hour' }), psKnown(), campaignName, null);
    expect(result.payload.html).toBe(`${htmlPrefix} Duration: 1 hour.`);

    // Q1: replace takes the FIRST underscore only — the tail keeps its own.
    result = await handle(makeAction({ spell: 'Misty Step', duration: 'concentration_till_end_of_turn' }), psKnown(), campaignName, null);
    expect(result.payload.html).toBe(`${htmlPrefix} Duration: concentration till_end_of_turn.`);

    // Already-spaced durations have no underscore — rendered verbatim,
    // leading space of the label preserved.
    result = await handle(makeAction({ spell: 'Misty Step', duration: '1 day' }), psKnown(), campaignName, null);
    expect(result.payload.html).toBe(`${htmlPrefix} Duration: 1 day.`);

    // '' is falsy — branch drops the label entirely.
    result = await handle(makeAction({ spell: 'Misty Step', duration: '' }), psKnown(), campaignName, null);
    expect(result.payload.html).toBe(htmlPrefix);
  });

  it('both labels compose in fixed order: name, noConc, dur — no separator drift', async () => {
    const result = await handle(
      makeAction({ spell: 'Misty Step', noConcentration: true, duration: '1_minute' }),
      psKnown(), campaignName, null,
    );
    expect(result.payload.html).toBe(`${htmlPrefix} Does not require Concentration. Duration: 1 minute.`);
  });

  it('missing description renders an empty span between the name and the grant line (action.description || "")', async () => {
    const action = makeAction({ spell: 'Misty Step' });
    delete action.description;

    const result = await handle(action, psKnown(), campaignName, null);

    expect(result.payload.html).toBe('<b>Fey Magic</b><br/><br/><br/><b>Free cast of:</b> Misty Step');
  });
});

describe('spellCastHandler.popup - fall-through arrivals at the grant lane (route-gate misses)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spellNamesTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('known spell: no lookup expected'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('majesty name without concentration reaches the bare popup — buff lane never touched (#1967 absence pair)', async () => {
    const ps = makePlayerStats({ spellAbilities: { spells: [{ name: 'Command', school: 'Enchantment' }] } });
    const action = makeAction({ spell: 'Command' }, 'Mantle of Majesty');

    const result = await handle(action, ps, campaignName, null);

    // Bare-html identity = popup lane; majesty's automation_info echo absent.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Mantle of Majesty</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Command',
      },
    });
    expect(runtimeState.getRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'activeBuffs', campaignName);
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Mantle_of_Majesty_freeCast', ['Command'], campaignName],
    ]);
  });

  it('channel-divinity continue leg: charges write precedes the grant stamp; charge MATH not pinned (#1970)', async () => {
    const ps = makePlayerStats({ spellAbilities: { spells: [{ name: 'Sanctuary', school: 'Abjuration' }] } });
    spellNamesTable({ 'channelDivinityCharges': 1 });
    const action = makeAction({ spell: 'Sanctuary', resourceCost: 'channel_divinity' }, 'Open Heaven');

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.html).toBe('<b>Open Heaven</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Sanctuary');
    // CONTINUE evidence only: the charges write runs BEFORE this lane's stamp,
    // its VALUE belongs to the resourceCost lane.
    expect(runtimeState.setRuntimeValue.mock.calls.map(c => c[1])).toEqual(['channelDivinityCharges', '_Open_Heaven_freeCast']);
    expect(runtimeState.getRuntimeValue.mock.calls.map(c => c[1])).toEqual(['channelDivinityCharges', '_Open_Heaven_freeCast']);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('counter-route misses land here: bare grant, never the (n remaining) counter text (_freeCastCount untouched, #1970)', async () => {
    const ps = makePlayerStats({ spellAbilities: { spells: [knownLight] } });

    // uses WITHOUT recharge → FREE_CAST_ROUTES[1] match fails (L379).
    const result = await handle(makeAction({ spell: 'Light', uses: 3 }), ps, campaignName, null);

    expect(result.payload.html).toBe('<b>Fey Magic</b><br/>You always have the spell prepared.<br/><br/><b>Free cast of:</b> Light');
    expect(result.payload.html).not.toContain('remaining');
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Magic_freeCast', ['Light'], campaignName],
    ]);
  });
});
