// @maintained-by-ai
// spellCastHandler .multiSpell lane (#1968) — owns handleMultiSpellFreeCast
// (L251-304) of spellCastHandler.js: the perSpellTracking used/freeKey stamping +
// availableSpells list + "All spells… used" popup, and the non-tracking
// channel-divinity popup with '_<Action>_freeCast' spell-array stamp.
// SEPTET SEAM MAP lives in spellCastHandler.damage.test.js header (SEPTET HEAD
// — the law); this header carries this lane's closure + drift notes.
//
// What "multiSpell" IS at source (verified — no mystique): the ONLY multi-spell
// machinery in this handler is the `spellNames.length > 1` gate at L409 feeding
// handleMultiSpellFreeCast. There is NO twin spell, NO quickened/2-cast, and NO
// multi_target(_spread) branch here — grep over the 418-line source finds none
// (the vestigial multi_target_spread flow flagged deleted-from-multiTargetHandler
// never lived in this handler either). "Multi" = automation.spell ARRAY of
// free casts granted together by one feature activation.
//
// Production liveness (verified): sole registration is `free_spell: handleSpellCast`
// in HANDLER_MAP (src/services/automation/index.js:313); automationInfoBuilder/
// spell.js:26 passes perSpellTracking through verbatim (`!!`), synthesizes nothing.
// Prod multi free_spell automations (full scan of public/data/**.json):
//   • LIVE on this lane — Star Map (public/data/2024/classes.json):
//     spell ['Guidance','Guiding Bolt'], uses_expression 'WIS modifier_min_1'
//     but NO usesMax → FREE_CAST_ROUTES[0].match (L377) requires BOTH → route
//     missed → falls through to the non-tracking branch here. Pinned below.
//   • INTERCEPTED before this lane — War God's Blessing (same file):
//     noConcentration + multi + channel_divinity is caught by
//     activateWarGodsBlessing (L122-137, specialCases #1971) inside
//     handleChannelDivinity, so its popup is NOT this function's html.
//   • NO prod JSON caller for the perSpellTracking multi branch today: every
//     perSpellTracking feat in 2024/feats.json is a SINGLE-spell array
//     (length 1 → never multi), and campaign HexWarlock's Shadow Magic carries
//     uses+recharge → intercepted by FREE_CAST_ROUTES[1] (#1970). The branch
//     is live, reachable code (any perSpellTracking + ≥2 spells + no uses/
//     usesMax/noConcentration-CD) — pinned below as a live-code contract on
//     explicit synthetic fixtures, honestly labeled.
//
// Drift findings (locked AS-IS in pins, flagged for future consolidation):
//   D1: the non-tracking html hardcodes "Channel Divinity expended." regardless
//     of resourceCost — Star Map's guidance grant claims Channel Divinity it
//     never spent. Pinned verbatim.
//   D2: the "All spells… used" recharge text is an INLINE ternary (L270-272)
//     that duplicates rechargeTextFor (L217-221, #1970 canonical) but lacks
//     its 'short_rest' arm — a short_rest feature here silently says "Long
//     Rest". Both legs pinned as-is.
//   D3: old-lane fixture mislabels — type 'spell' (dispatch key is
//     'free_spell') and name 'Divine Smite' (a damage ability, never a
//     multi-spell chooser). Corrected here.
//
// ── Lane closure / handoff ──
// • Delegation guard (own-composition): this function RETURNS popup payloads
//     only — it never rolls, never looks a spell up, never logs, never touches
//     concentration/buffs/storage. fetch/addEntry/addConcentration/storage.set
//     absence guards below are MINE (the multi gate short-circuits L413-417);
//     the rollExpression non-fire on the multi route is .damage's final-test
//     pin (map: do not duplicate) — re-run there, absent here by design.
// • #1969 owns grantFreeCastPopup html/labels (single-spell lane); my
//     "Channel Divinity expended." / "Available free casts:" html strings are
//     this function's own composition — result identity discriminates: bare
//     payload.html = my chooser/non-tracking popups, payload.type
//     'automation_info' + automation echo = my exhausted/blocked popup.
// • #1970 owns charge math (channelDivinityCharges decrements, freeCastCount
//     counters, rechargeTextFor). My CD-multi test filters setRuntimeValue
//     calls to the free-cast key only — never asserts charges.
// • #1971 owns activateWarGodsBlessing and the perSpellTracking reset inside
//     handleChannelDivinity (the '_used' stamps nulled there are consumed by
//     my used-key reads — pinned as INPUT table here, not as writes).
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
function makeAction(automation = {}) {
  return {
    name: 'Mystic Selection',
    automation: {
      type: 'free_spell',
      ...automation,
    },
  };
}

// Star Map verbatim from public/data/2024/classes.json — the live prod fixture
// for the non-tracking multi route (uses_expression WITHOUT usesMax).
function starMapAction() {
  return {
    name: 'Star Map',
    automation: {
      type: 'free_spell',
      spell: ['Guidance', 'Guiding Bolt'],
      uses_expression: 'WIS modifier_min_1',
      casting_time: '1 action',
    },
  };
}

// Order-independent per-spell state: exact-key table instead of Once-chains.
function storedTable(map = {}) {
  runtimeState.getRuntimeValue.mockImplementation((who, key) =>
    (key in map ? map[key] : null));
}

describe('spellCastHandler.multiSpell - perSpellTracking branch (handleMultiSpellFreeCast canonical)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('multi gate never looks spells up'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('first use stamps every spell exact freeKey once and lists all spells available (full own-html pin)', async () => {
    const action = {
      ...makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true }),
      description: 'Pick your spells.',
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Mystic Selection</b><br/>Pick your spells.<br/><br/><b>Available free casts:</b> Fire Bolt, Light<br/><br/><em>Open your spell sheet and cast one — no spell slot will be consumed.</em>',
      },
    });
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Mystic_Selection_Fire_Bolt_freeCast', true, campaignName],
      ['TestWizard', '_Mystic_Selection_Light_freeCast', true, campaignName],
    ]);
    // Own-composition delegation guard: this is a chooser popup — it never
    // rolls, fetches, logs, concentrates, or persists storage.
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('used spell drops from the list; only the unused spell freeKey is stamped (exact-call table)', async () => {
    // '_used' keys are nulled by handleChannelDivinity (#1971) and set by the
    // spellPreparation consumption path; here they arrive as input state.
    storedTable({ '_Mystic_Selection_Fire_Bolt_used': true });
    const action = makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.html).toContain('<b>Available free casts:</b> Light<');
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Mystic_Selection_Light_freeCast', true, campaignName],
    ]);
  });

  it('already-stamped freeKey is never re-stamped but the spell stays available (!stored guard)', async () => {
    storedTable({ '_Mystic_Selection_Fire_Bolt_freeCast': true });
    const action = makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.html).toContain('<b>Available free casts:</b> Fire Bolt, Light<');
    // Light's freeKey re-stamped; Fire Bolt's untouched (already true).
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Mystic_Selection_Light_freeCast', true, campaignName],
    ]);
  });

  it('all spells used — strict automation_info payload, default Long Rest text (result identity: echo, no html)', async () => {
    storedTable({
      '_Mystic_Selection_Fire_Bolt_used': true,
      '_Mystic_Selection_Light_used': true,
    });
    const auto = { type: 'free_spell', spell: ['Fire Bolt', 'Light'], perSpellTracking: true };
    const action = makeAction(auto);

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Mystic Selection',
        description: 'All spells from this feature have been used. Finish a Long Rest to regain them.',
        automation: auto,
      },
    });
    expect(result.payload.html).toBeUndefined();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('recharge text ternary: short_or_long_rest swaps in; short_rest falls back to Long Rest (D2 drift, locked as-is)', async () => {
    const usedAll = {
      '_Mystic_Selection_Fire_Bolt_used': true,
      '_Mystic_Selection_Light_used': true,
    };

    storedTable(usedAll);
    let result = await handle(
      makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true, recharge: 'short_or_long_rest' }),
      makePlayerStats(), campaignName, null,
    );
    expect(result.payload.description).toBe('All spells from this feature have been used. Finish a Short or Long Rest to regain them.');

    // D2: inline ternary (L270-272) has no short_rest arm, unlike
    // rechargeTextFor (L217-221, #1970) — short_rest silently says Long Rest.
    storedTable(usedAll);
    result = await handle(
      makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true, recharge: 'short_rest' }),
      makePlayerStats(), campaignName, null,
    );
    expect(result.payload.description).toBe('All spells from this feature have been used. Finish a Long Rest to regain them.');
  });
});

describe('spellCastHandler.multiSpell - non-tracking branch (Star Map prod fixture)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('multi gate never looks spells up'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('Star Map: uses_expression WITHOUT usesMax misses FREE_CAST_ROUTES, stamps _Star_Map_freeCast with the spell array (full own-html pin)', async () => {
    const result = await handle(starMapAction(), makePlayerStats(), campaignName, null);

    // My lane, not #1970's counter lane: no 'remaining' counter text, no
    // '_Star_Map_freeCastCount' write — this route writes only the spell array.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Star Map</b><br/><br/><br/><b>Channel Divinity expended.</b><br/>You can now cast <b>Guidance or Guiding Bolt</b> without expending a spell slot.<br/><br/><em>Open your spell sheet and cast Guidance or Guiding Bolt normally — no spell slot will be consumed.</em>',
      },
    });
    expect(result.payload.html).not.toContain('remaining');
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Star_Map_freeCast', ['Guidance', 'Guiding Bolt'], campaignName],
    ]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('channel divinity multi popup: free-cast key stamped once with the array; charge math not pinned here (#1970)', async () => {
    const action = {
      name: 'Righteous Fervor',
      automation: {
        type: 'free_spell',
        spell: ['Sacred Flame', 'Bless'],
        resourceCost: 'channel_divinity',
      },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.html).toContain('Channel Divinity expended.');
    const freeCastWrites = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === '_Righteous_Fervor_freeCast');
    expect(freeCastWrites).toEqual([
      ['TestWizard', '_Righteous_Fervor_freeCast', ['Sacred Flame', 'Bless'], campaignName],
    ]);
  });

  it('stored freeCast array (even []) is truthy — never re-stamped; spellLabel joins 3 spells with " or "', async () => {
    storedTable({ '_Star_Map_freeCast': [] });
    let result = await handle(starMapAction(), makePlayerStats(), campaignName, null);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(result.payload.html).toContain('Guidance or Guiding Bolt');

    storedTable({ '_Star_Map_freeCast': ['Guidance'] });
    const three = {
      ...starMapAction(),
      automation: { ...starMapAction().automation, spell: ['Guidance', 'Guiding Bolt', 'Light'] },
    };
    result = await handle(three, makePlayerStats(), campaignName, null);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(result.payload.html).toContain('You can now cast <b>Guidance or Guiding Bolt or Light</b>');
  });

  it('noConcentration + duration labels append to the multi-spell popup (castLabels, own html)', async () => {
    const action = {
      name: 'Faith Channel',
      automation: {
        type: 'free_spell',
        spell: ['Shield of Faith', 'Bless'],
        noConcentration: true,
        duration: '1_minute',
      },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.html).toBe(
      '<b>Faith Channel</b><br/><br/><br/><b>Channel Divinity expended.</b><br/>You can now cast <b>Shield of Faith or Bless</b> without expending a spell slot. Does not require Concentration. Duration: 1 minute.<br/><br/><em>Open your spell sheet and cast Shield of Faith or Bless normally — no spell slot will be consumed.</em>',
    );
  });
});
