// spellCastHandler .specialCases lane (#1971) — owns the named-feature special-case
// intercepts + shared plumbing fall-throughs of spellCastHandler.js:
// activateWarGodsBlessing (L122-137), the perSpellTracking reset block inside
// handleChannelDivinity (L170-184), the FETCH branches of lookupSpellData
// (URL selection L310 + fetch-reject/miss legs L311-315), and every addEntry
// .catch path (L110/L130/L183). SEPTET SEAM MAP lives in spellCastHandler.damage
// .test.js header (SEPTET HEAD — the law); this header carries this lane's
// closure + drift notes.
//
// Production liveness (verified): sole prod caller is the automation dispatch
// table `free_spell: handleSpellCast` (src/services/automation/index.js:313);
// executeHandler passes action.automation verbatim (its array-entry selection at
// index.js:716-734 picks an ENTRY of a feature's automation array, never an
// entry of auto.spell — the multi-spell arrays below reach handle intact).
// Prod rows per seam (scan of public/data/**.json + campaign JSON):
//   • WGB intercept — LIVE, unique fingerprint carrier: War God's Blessing
//     (2024/classes.json L3084): free_spell + ['Shield of Faith','Spiritual
//     Weapon'] + channel_divinity + noConcentration. Mirrored verbatim below.
//   • perSpellTracking reset (L170) — NO prod JSON caller today: the block
//     lives INSIDE handleChannelDivinity (needs resourceCost channel_divinity),
//     and no CD row carries perSpellTracking (feats.json Fey Magic/Shadow Magic
//     lack resourceCost; HexWarlock's multi Shadow Magic never enters CD —
//     route[1] + the null rc, #1970). Live, reachable code — pinned below as a
//     live-code contract on honestly-synthetic CD fixtures.
//   • Fetch URL legs — LIVE on both arms: rules '2024' + Fey Magic verbatim
//     (2024/feats.json L1255: ['Misty Step'], no CD, no counters, length-1 →
//     lookup, Misty Step absent from the test sheet); rules '5e' + Favored
//     Enemy automation[1] verbatim (5e/classes.json L8451: "Hunter's Mark",
//     uses_expression but NO usesMax → both FREE_CAST_ROUTES miss, #1970 D3).
//   • majesty reject leg — assigned HERE by the #1967 handoff ("specialCases
//     #1971 owns the addEntry .catch path … happy-path log pin only there");
//     fixture mirrors the prod Mantle of Majesty row (2024/classes.json L1960).
//
// Drift findings (locked AS-IS, flagged for consolidation):
//   D1: the "named-feature" intercept is STRUCTURAL, not name-gated (L123 tests
//     only noConcentration + Array + length>1 inside the CD branch): ANY row with
//     that fingerprint stamps '_War_Gods_Blessing_active' — pinned with a foreign
//     name. Prod-unique scan keeps it honest: only War God's Blessing carries the
//     fingerprint today.
//   D2: the WGB popup hardcodes 'Channel Divinity expended.' and 'For 1 minute' —
//     auto.duration is never consulted (prod's duration:'1_minute' coincides).
//     The stamp is a CONSTANT key regardless of action name. Locked.
//   D3: the reset block overwrites unconditionally with NULL (not false / not
//     delete) — even over stored `true`. null/false/undefined are truthy-
//     equivalent for #1968's `!used` reads, but the written value is null. Locked.
//   D4 (keys): action-name sanitizing replaces only \s — the colon survives
//     ('Channel Divinity: Charm' → '_Channel_Divinity:_Charm_…'). Locked.
//   Q1: lookupSpellData's find-miss returns UNDEFINED (L313), not the explicit
//     null (L315 sits after the catch) — both flow onward to the #1969 popup;
//     the JSON-success miss is SILENT (console.warn fires only on reject). Locked.
//   Q2: the URL ternary default arm sends EVERY non-'2024' value (undefined
//     included) to '/data/spells.json' — '2024' is the only URL-switching value.
//     Both arms + default pinned below.
//
// ── Lane closure / handoff ──
// • #1970 owns ALL charge VALUES/counters: my legs filter setRuntimeValue to my
//   own keys (or null-valued writes) and never assert channelDivinityCharges
//   values or first-write order (their WGB test already pins charge-first).
// • #1968 owns the chooser/'Available free casts:' and non-tracking multi html;
//   #1969 owns grantFreeCastPopup/'Free cast of:' html + first-cast stamp —
//   on my continue/gate legs those strings appear ONLY as result-identity
//   discriminators, never as content pins.
// • #1967 owns the majesty happy path (buff stamps, concentration call); only the
//   addEntry-reject console.error leg is mine per their header.
// • Known-spell SHORT-CIRCUIT (fetch NOT called) is .damage canonical — my
//   fixtures supply known spells silently instead of pinning fetch-absence.
// • wildCompanion reject log ('[spellCastHandler:log-error]') is #1972's tag —
//   the three '[spellCast] Error:' catches (L110/L130/L183) are the full set
//   pinned here.
// • Fixes vs old file: dispatch mislabels 'spell'→'free_spell' (index.js:313,
//   D3 family); WGB spell list fabricated 'Attack of Opportunity/Reaction Attack'
//   → prod verbatim; URL fixtures moved off 'Divine Smite' (a damage ability) to
//   prod-grounded Fey Magic/Favored Enemy rows; missing pins added: gate arms,
//   own full-string log/html, console.warn tag, null-overwrite semantics, the
//   L166-before-L170 seam order, block-at-zero side-effect guards.
// No game timers — turn-based handler; tests await directly, no setTimeout,
// no vi.waitFor needed.
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

// Known no-damage spells so any continue-leg lands on the #1969 grant popup
// (known-spell short-circuit — .damage canonical, exercised silently here).
const knownSpells = [
  { name: 'Shield of Faith', school: 'Abjuration' },
  { name: 'Spiritual Weapon', school: 'Evocation' },
  { name: 'Charm Person', school: 'Enchantment' },
  { name: 'Channelless Devotion', school: 'Abjuration' },
];

const ps = () => makePlayerStats({ spellAbilities: { spells: knownSpells } });

function storedTable(map = {}) {
  runtimeState.getRuntimeValue.mockImplementation((who, key) =>
    (key in map ? map[key] : null));
}

// Read-through table: the reset block's null writes DELETE the keys, so #1968's
// chooser re-read on the continue leg sees the reset (static tables would keep
// the stale `true` and fake the exhausted popup).
function liveTable(initial = {}) {
  const store = { ...initial };
  runtimeState.getRuntimeValue.mockImplementation((who, key) => (key in store ? store[key] : null));
  runtimeState.setRuntimeValue.mockImplementation(async (who, key, value) => {
    if (value === null) delete store[key]; else store[key] = value;
  });
}

// Fail-fast regression guard: on the intercept/reset legs nothing may fetch —
// an accidental route change hits this rejection instead of the network.
function noFetch() {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('intercept/reset legs never look spells up'));
}

// My lane's writes only: the charge decrement is #1970 canonical, the grant/
// chooser freeCast-true stamps are #1968/#1969 — my reset block writes NULL.
const nullWrites = () => runtimeState.setRuntimeValue.mock.calls.filter(c => c[2] === null);

// Prod verbatim: public/data/2024/classes.json L3084 (the unique fingerprint
// carrier of the activateWarGodsBlessing intercept, D1).
function warGodsBlessing(overrides = {}) {
  return {
    name: "War God's Blessing",
    description: "You can expend a use of your Channel Divinity to cast Shield of Faith or Spiritual Weapon rather than expending a spell slot. When you cast either spell in this way, the spell doesn't require Concentration. Instead the spell lasts for 1 minute.",
    automation: {
      type: 'free_spell',
      spell: ['Shield of Faith', 'Spiritual Weapon'],
      resourceCost: 'channel_divinity',
      noConcentration: true,
      duration: '1_minute',
      action: 'action',
      casting_time: '1 action',
      recharge: 'short_or_long_rest',
      ...overrides,
    },
  };
}

describe('spellCastHandler.specialCases - activateWarGodsBlessing intercept (L122-137, #1971 canonical)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    noFetch();
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('prod War God\'s Blessing: activation stamp + full own-popup html + full own-log string — bare html, zero side effects', async () => {
    const action = warGodsBlessing();

    const result = await handle(action, ps(), campaignName, null);

    // Own composition (map: intercept content is mine) — exact full html, and
    // the payload is BARE html: never an automation_info echo, never #1968's
    // chooser, never #1969's grant (D2: 'Channel Divinity expended.'/'For 1
    // minute' are hardcoded prose of THIS function).
    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: `<b>War God's Blessing</b><br/>${action.description}<br/><br/><b>Channel Divinity expended.</b><br/>For 1 minute, you can cast <b>Shield of Faith and Spiritual Weapon</b> without expending a spell slot. The spells do not require Concentration.<br/><br/><em>Open your spell sheet and cast them normally — no spell slot will be consumed.</em>`,
      },
    });

    // Full-contract activation stamp, exactly once. Charge VALUES and their
    // write-order stay #1970 — the key-set guard only proves nothing foreign
    // is written on this route.
    const keys = runtimeState.setRuntimeValue.mock.calls.map(c => c[1]);
    expect(keys.filter(k => k === '_War_Gods_Blessing_active')).toHaveLength(1);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_War_Gods_Blessing_active', true, campaignName,
    );
    expect(keys.every(k => k === 'channelDivinityCharges' || k === '_War_Gods_Blessing_active')).toBe(true);
    // No buff/concentration/expiration/storage machinery on this intercept.
    expect(nullWrites()).toEqual([]);
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();

    // Own log, exact full string (L129 interpolation).
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: "War God's Blessing",
      description: 'TestWizard activated War God\'s Blessing for 1 minute. Shield of Faith and Spiritual Weapon can be cast without expending a spell slot or requiring Concentration.',
    });
  });

  it('D1: the gate is the structural fingerprint, not the name — any CD+noConc+multi row stamps the CONSTANT _War_Gods_Blessing_active key', async () => {
    const action = {
      name: 'Synthetic Benediction',
      description: 'Same fingerprint, different name.',
      automation: {
        type: 'free_spell',
        spell: ['Shield of Faith', 'Spiritual Weapon'],
        resourceCost: 'channel_divinity',
        noConcentration: true,
      },
    };

    const result = await handle(action, ps(), campaignName, null);

    expect(result.payload.html).toContain('<b>Synthetic Benediction</b>');
    expect(result.payload.html).toContain('Channel Divinity expended.');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_War_Gods_Blessing_active', true, campaignName,
    );
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      abilityName: 'Synthetic Benediction',
    }));
  });

  it('description fallback (L134 action.description || ""): missing description renders an empty segment, nothing crashes', async () => {
    const action = warGodsBlessing();
    delete action.description;

    const result = await handle(action, ps(), campaignName, null);

    expect(result.payload.html).toBe(
      `<b>War God's Blessing</b><br/><br/><br/><b>Channel Divinity expended.</b><br/>For 1 minute, you can cast <b>Shield of Faith and Spiritual Weapon</b> without expending a spell slot. The spells do not require Concentration.<br/><br/><em>Open your spell sheet and cast them normally — no spell slot will be consumed.</em>`,
    );
  });

  it('gate-arm table (L123): each failed arm skips the intercept — no stamp, no own log, flow continues (discriminators only)', async () => {
    const arms = [
      {
        // Arm: noConcentration missing → falls to #1968's non-tracking grant.
        label: 'no noConcentration',
        action: {
          name: 'Channel Divinity: Charisma',
          automation: {
            type: 'free_spell',
            spell: ['Shield of Faith', 'Spiritual Weapon'],
            resourceCost: 'channel_divinity',
          },
        },
        discriminator: 'You can now cast', // #1968 non-tracking phrase
      },
      {
        // Arm: spell not an array → single-spell continue → #1969 grant.
        label: 'spell is a string',
        action: {
          name: 'Battle Focus',
          automation: {
            type: 'free_spell',
            spell: 'Shield of Faith',
            resourceCost: 'channel_divinity',
            noConcentration: true,
          },
        },
        discriminator: 'Free cast of:', // #1969 canonical phrase
      },
      {
        // Arm: length>1 fails on a single-entry array.
        label: 'single-entry array',
        action: {
          name: 'Battle Focus',
          automation: {
            type: 'free_spell',
            spell: ['Shield of Faith'],
            resourceCost: 'channel_divinity',
            noConcentration: true,
          },
        },
        discriminator: 'Free cast of:',
      },
    ];

    for (const arm of arms) {
      runtimeState.setRuntimeValue.mockClear();
      logService.addEntry.mockClear();
      const result = await handle(arm.action, ps(), campaignName, null);

      expect(result.type, arm.label).toBe('popup');
      expect(result.payload.html, arm.label).toContain(arm.discriminator);
      expect(result.payload.html, arm.label).not.toContain('do not require Concentration');
      expect(runtimeState.setRuntimeValue, arm.label).not.toHaveBeenCalledWith(
        'TestWizard', '_War_Gods_Blessing_active', true, campaignName,
      );
      // The intercept's own log never fires when its gate misses.
      expect(logService.addEntry, arm.label).not.toHaveBeenCalled();
    }
  });

  it('seam order (L166 before L170): WGB fingerprint + perSpellTracking → intercept returns BEFORE the reset — zero null writes, WGB prose logged', async () => {
    const action = warGodsBlessing({ perSpellTracking: true });

    const result = await handle(action, ps(), campaignName, null);

    expect(result.payload.html).toContain('do not require Concentration');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_War_Gods_Blessing_active', true, campaignName,
    );
    // Reset block unreachable behind the intercept (D3 sentinel: null writes).
    expect(nullWrites()).toEqual([]);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry.mock.calls[0][1].description).toContain('activated War God\'s Blessing for 1 minute');
  });

  it('block-at-zero upstream: charges spent → automation_info block, neither the stamp nor the reset nor any log fires', async () => {
    // Charge-block payload content is #1970's — identity discrimination only.
    storedTable({ 'channelDivinityCharges': 0 });
    const action = warGodsBlessing({ perSpellTracking: true });

    const result = await handle(action, ps(), campaignName, null);

    expect(result.payload.type).toBe('automation_info');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(nullWrites()).toEqual([]);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});

describe('spellCastHandler.specialCases - perSpellTracking reset inside handleChannelDivinity (L170-184)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    noFetch();
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('array leg: nulls every used+freeKey in loop order over stored TRUE (D3), logs free-casts prose, continues to #1968 chooser', async () => {
    // SYNTHETIC (D-decl above): prod ships NO CD+perSpellTracking row — this
    // live, reachable block has no prod JSON caller today. Fingerprint:
    // channel_divinity + perSpellTracking + 2-spell array (no uses/counters,
    // no noConcentration → no upstream intercept).
    const action = {
      name: 'Channel Divinity: Charm',
      automation: {
        type: 'free_spell',
        spell: ['Charm Person', 'Shield of Faith'],
        resourceCost: 'channel_divinity',
        perSpellTracking: true,
      },
    };
    // Spent state from a previous press (#1968 consumed them, a fresh channel
    // must reopen them): stored true → unconditional null overwrite, visible to
    // the chooser's re-read via the live table.
    liveTable({
      '_Channel_Divinity:_Charm_Charm_Person_used': true,
      '_Channel_Divinity:_Charm_Charm_Person_freeCast': true,
      '_Channel_Divinity:_Charm_Shield_of_Faith_used': true,
      '_Channel_Divinity:_Charm_Shield_of_Faith_freeCast': true,
    });

    const result = await handle(action, ps(), campaignName, null);

    // My own writes, exact table in loop order, null sentinel (D3/D4 colon key).
    expect(nullWrites()).toEqual([
      ['TestWizard', '_Channel_Divinity:_Charm_Charm_Person_used', null, campaignName],
      ['TestWizard', '_Channel_Divinity:_Charm_Charm_Person_freeCast', null, campaignName],
      ['TestWizard', '_Channel_Divinity:_Charm_Shield_of_Faith_used', null, campaignName],
      ['TestWizard', '_Channel_Divinity:_Charm_Shield_of_Faith_freeCast', null, campaignName],
    ]);

    // Own log, exact full string (L182; charges interpolation rides #1970 math).
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: 'Channel Divinity: Charm',
      description: 'TestWizard activated Channel Divinity: Charm, gaining free casts of Charm Person or Shield of Faith. Channel Divinity charges: 1.',
    });

    // Continue-leg identity: reset returns null → #1968's chooser re-stamps
    // freeKeys true (their content/stamp, discriminator phrase only).
    expect(result.type).toBe('popup');
    expect(result.payload.html).toContain('Available free casts:');
  });

  it('non-array spell leg: string spell gets the same used/free null pair and single-name prose, continues to #1969 grant', async () => {
    const action = {
      name: 'Channel Divinity: Charm',
      automation: {
        type: 'free_spell',
        spell: 'Charm Person',
        resourceCost: 'channel_divinity',
        perSpellTracking: true,
      },
    };

    const result = await handle(action, ps(), campaignName, null);

    expect(nullWrites()).toEqual([
      ['TestWizard', '_Channel_Divinity:_Charm_Charm_Person_used', null, campaignName],
      ['TestWizard', '_Channel_Divinity:_Charm_Charm_Person_freeCast', null, campaignName],
    ]);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: 'TestWizard activated Channel Divinity: Charm, gaining free casts of Charm Person. Channel Divinity charges: 1.',
    }));
    // Single spell → the bare grant (identity discriminator, content #1969).
    expect(result.type).toBe('popup');
    expect(result.payload.html).toContain('Free cast of:');
  });

  it('reset gate (L170): perSpellTracking falsy or spell absent → zero _used null writes and the block never logs', async () => {
    const gates = [
      {
        label: 'no perSpellTracking',
        action: {
          name: 'Channel Divinity: War Cry',
          automation: {
            type: 'free_spell',
            spell: ['Charm Person', 'Shield of Faith'],
            resourceCost: 'channel_divinity',
          },
        },
      },
      {
        label: 'perSpellTracking without a spell',
        action: {
          name: 'Channelless Devotion',
          automation: {
            type: 'free_spell',
            resourceCost: 'channel_divinity',
            perSpellTracking: true,
          },
        },
      },
    ];

    for (const gate of gates) {
      runtimeState.setRuntimeValue.mockClear();
      logService.addEntry.mockClear();
      const result = await handle(gate.action, ps(), campaignName, null);

      expect(result.type, gate.label).toBe('popup');
      expect(nullWrites(), gate.label).toEqual([]);
      expect(logService.addEntry, gate.label).not.toHaveBeenCalled();
    }
  });
});

describe('spellCastHandler.specialCases - lookupSpellData FETCH branches (URL selection + reject/miss, L306-316)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('prod Fey Magic + rules 2024: fetch fires against /data/2024/spells.json exactly once', async () => {
    // Verbatim feat automation (2024/feats.json L1255). Length-1 array, no CD,
    // no counters → both routes miss → lookup. Sheet is EMPTY so fetch fires.
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ name: 'Misty Step', school: 'Conjuration' }]),
    });

    const result = await handle({
      name: 'Fey Magic',
      automation: {
        type: 'free_spell',
        spell: ['Misty Step'],
        perSpellTracking: true,
        recharge: 'long_rest',
        casting_time: '1 bonus action',
      },
    }, makePlayerStats({ rules: '2024', spellAbilities: { spells: [] } }), campaignName, null);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('/data/2024/spells.json');
    // Found spell has no damage → #1969 popup lane receives it (their content).
    expect(result.type).toBe('popup');
  });

  it('prod Favored Enemy + rules 5e: uses_expression WITHOUT usesMax misses both routes and fetches /data/spells.json', async () => {
    // Verbatim automation[1] (5e/classes.json L8451) — #1970 D3 fall-through.
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ name: "Hunter's Mark", school: 'Divination' }]),
    });

    const result = await handle({
      name: 'Favored Enemy',
      automation: {
        type: 'free_spell',
        spell: "Hunter's Mark",
        uses_expression: 'favored_enemy_min_1',
        recharge: 'long_rest',
        concentration: true,
        noConcentration: false,
        action: 'bonus_action',
        casting_time: '1 bonus action',
      },
    }, makePlayerStats({ rules: '5e', spellAbilities: { spells: [] } }), campaignName, null);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('/data/spells.json');
    expect(result.type).toBe('popup');
  });

  it('rules absent/default arm (L310 ternary else): every non-2024 value falls to /data/spells.json', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ name: 'Misty Step', school: 'Conjuration' }]),
    });

    const result = await handle({
      name: 'Fey Magic',
      automation: {
        type: 'free_spell',
        spell: ['Misty Step'],
        perSpellTracking: true,
        recharge: 'long_rest',
        casting_time: '1 bonus action',
      },
    }, makePlayerStats({ spellAbilities: { spells: [] } }), campaignName, null);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('/data/spells.json');
    expect(result.type).toBe('popup');
  });

  it('fetch reject (L314): exact console.warn tag, popup fall-through (type only — content #1969), no console.error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockReturnValue();
    const errorSpy = vi.spyOn(console, 'error').mockReturnValue();
    const networkError = new Error('Network error');
    globalThis.fetch = vi.fn().mockRejectedValue(networkError);

    const result = await handle({
      name: 'Favored Enemy',
      automation: {
        type: 'free_spell',
        spell: "Hunter's Mark",
        uses_expression: 'favored_enemy_min_1',
        recharge: 'long_rest',
        casting_time: '1 bonus action',
      },
    }, makePlayerStats({ rules: '5e', spellAbilities: { spells: [] } }), campaignName, null);

    expect(warnSpy).toHaveBeenCalledWith('[spellCastHandler] Spell not found in spell data:', networkError);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(result.type).toBe('popup');
    // Lookup errors never touch the campaign log (only the three catches do).
    expect(logService.addEntry).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('Q1 fetch ok but spell absent: find-miss returns undefined SILENTLY — popup fires, console.warn never', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockReturnValue();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue([]) });

    const result = await handle({
      name: 'Favored Enemy',
      automation: {
        type: 'free_spell',
        spell: "Hunter's Mark",
        uses_expression: 'favored_enemy_min_1',
        recharge: 'long_rest',
        casting_time: '1 bonus action',
      },
    }, makePlayerStats({ rules: '5e', spellAbilities: { spells: [] } }), campaignName, null);

    expect(globalThis.fetch).toHaveBeenCalledWith('/data/spells.json');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(result.type).toBe('popup');
    warnSpy.mockRestore();
  });
});

describe('spellCastHandler.specialCases - addEntry .catch paths (L110/L130/L183, "[spellCast] Error:")', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    noFetch();
    logService.addEntry.mockRejectedValue(new Error('Log error'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('logs console.error when addEntry rejects in Mantle of Majesty (leg assigned here by the #1967 handoff)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    // Prod row verbatim shape (2024/classes.json L1960) — the majesty gate
    // (name + free_spell + concentration, #1967) still owns the happy path.
    const action = {
      name: 'Mantle of Majesty',
      automation: {
        type: 'free_spell',
        spell: 'Command',
        freeCasts: 'at_will_while_active',
        action: 'bonus_action',
        duration: '1_minute',
        concentration: true,
        casting_time: '1 bonus action',
      },
    };

    await handle(action, makePlayerStats(), campaignName, null);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[spellCast] Error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('logs console.error when addEntry rejects in War God\'s Blessing — the activation stamp lands BEFORE the log fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    const action = warGodsBlessing();

    const result = await handle(action, ps(), campaignName, null);

    // The stamp awaits before addEntry is even called — a dead log service
    // cannot undo the activation.
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_War_Gods_Blessing_active', true, campaignName,
    );
    expect(result.type).toBe('popup');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[spellCast] Error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('logs console.error when addEntry rejects in the perSpellTracking reset — null writes are unaffected', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    const action = {
      name: 'Channel Divinity: Charm',
      automation: {
        type: 'free_spell',
        spell: ['Charm Person', 'Sleep'],
        resourceCost: 'channel_divinity',
        perSpellTracking: true,
      },
    };

    await handle(action, ps(), campaignName, null);

    expect(nullWrites()).toEqual([
      ['TestWizard', '_Channel_Divinity:_Charm_Charm_Person_used', null, campaignName],
      ['TestWizard', '_Channel_Divinity:_Charm_Charm_Person_freeCast', null, campaignName],
      ['TestWizard', '_Channel_Divinity:_Charm_Sleep_used', null, campaignName],
      ['TestWizard', '_Channel_Divinity:_Charm_Sleep_freeCast', null, campaignName],
    ]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[spellCast] Error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
