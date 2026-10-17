// @maintained-by-ai
// spellCastHandler .resourceCost lane (#1970) — owns the resource-cost accounting
// of spellCastHandler.js: handleChannelDivinity charge math + resolveChannelDivinity
// MaxCharges (L139-163), FREE_CAST_ROUTES + both counter handlers
// (handleUsesExpressionFreeCast L189-215, handleUsesRechargeFreeCast L223-249),
// and rechargeTextFor (L217-221). SEPTET SEAM MAP lives in spellCastHandler.damage
// .test.js header (SEPTET HEAD — the law). This lane's canonical holds: exact
// decrement tables, persistence write values, block-at-zero payloads, and the
// rechargeTextFor prose canon.
//
// Production liveness (verified): sole prod caller is the automation dispatch table
// `free_spell: handleSpellCast` (src/services/automation/index.js:313); execute
// passes action.automation verbatim except array-entry selection (index.js:707-733).
// Live prod rows landing ON my routes (scan of public/data/**.json + campaign JSON):
//   • Route[1] (uses != null && recharge && !uses_expression, L379) — LIVE raw:
//     'Level 1 Spell [Instance 1]' Burning Hands {uses:1, recharge:'long_rest'} and
//     Shadow Magic {spell:['False Life','Invisibility'], uses:1, recharge:'long_rest',
//     perSpellTracking} (public/campaigns/test-campaign/HexWarlock.json); 2024/
//     classes.json Divine Smite / Find Steed {uses:1, recharge:'long_rest'}.
//     Shadow Magic is a 2-spell array caught by route[1] BEFORE the #1968 multi
//     gate (L404 runs before L409) — the multiSpell header confirms the handoff.
//   • Route[0] (uses_expression && usesMax, L377) — NO raw public/data row carries
//     usesMax (full scan: none). It is live on builder-ENRICHED dispatch rows:
//     automationInfoBuilder/spell.js:6-17 synthesizes usesMax =
//     evaluateAutoExpression(uses_expression) || 1 (plus uses + recharge default
//     'long_rest'); rules.cla229-usesMax.test.js pins a live pool row usesMax=3.
//     My route[0] fixture is that enrich shape, honestly labeled.
//   • Channel Divinity — LIVE prod row is War God's Blessing (2024/classes.json):
//     the charge decrement (mine) fires before activateWarGodsBlessing (#1971)
//     intercepts the popup. Pinned as charge-first-write, content delegated.
//
// Drift findings (locked AS-IS, flagged for consolidation):
//   D1: handleUsesExpressionFreeCast's block text (L200) hardcodes 'Long Rest' and
//     never consults auto.recharge nor rechargeTextFor — a third duplicated arm
//     (inline ternary #1968 L270-272 lacks the short_rest arm; rechargeTextFor
//     L217-221 is the canonical prose, called ONLY at L234 — grep verified).
//     A short_rest expression feature that hits zero still says 'Long Rest'.
//   D2 (inherited, multiSpell header): the multi exhausted ternary duplicates
//     rechargeTextFor minus its short_rest arm — prose canon remains HERE.
//   D3 (correction of #1969's scan note, verified at source): the prod
//     'Detect Thoughts' feat row {uses:1, uses_expression:'1', recharge:'long_rest'}
//     is NOT intercepted by route[1] — uses_expression present fails L379's
//     !auto.uses_expression, and missing usesMax fails L377. It falls through to
//     the #1969 bare grant. My lane pins the match semantics honestly (test below).
//   Q1: the channelDivinityCharges READ at L146 omits campaignName (2-arg call)
//     while the WRITE at L163 carries it — arity table pinned as-is.
//   Q2: resolveChannelDivinityMaxCharges indexes class_levels[(level||1)-1] — it
//     does NOT find() by entry.level, and the || chain lets a real 0 fall through
//     to the hardcoded 2. Both locked.
//   Q3: on route[1] a multi-spell auto interpolates spellName as an ARRAY into
//     the html — JS join gives 'False Life,Invisibility' (comma, NO space). Pinned.
//   Exhaustion costs: verified at source — grep over spellCastHandler.js finds NO
//     exhaustion machinery. Nothing to pin; nothing fabricated here.
//
// ── Lane closure / handoff ──
// • #1969 owns grantFreeCastPopup html/stamp and castLabels semantics: on my
//   continue legs I pin the charge VALUE + write ORDER and the counter-key
//   ABSENCE only — never the freeCast stamp value or label legs. My counter
//   popups' html is this lane's own composition (canonical HERE).
// • #1968 owns the multi chooser/exhausted popups — Shadow Magic here proves the
//   route[1] intercept happens instead, and that NO chooser/freeCast stamp fires.
// • #1971 owns activateWarGodsBlessing content, the perSpellTracking reset block
//   (L170-184) writes + its log text, and fetch URL selection — my War God test
//   pins only that the charge write precedes their popup; fetch never runs on my
//   routes (counters short-circuit before the L413 lookup).
// • Rest re-arm is a REST-EVENT seam (restRules-null → `?? uses` re-default,
//   simulated by stored-null input in the cycle test) — turn-based, no clocks,
//   no timers here or in production.
// • Fixes vs old file: dispatch type 'spell' → 'free_spell' (index.js:313 — same
//   D3-family mislabel as #1968/#1969); counter fixtures renamed off 'Divine
//   Smite' (a damage ability) to prod-grounded names; mockReturnValue Once-chains
//   replaced by exact-key stored tables + exact-call tables; block tests upgraded
//   from type-only to full strict automation_info payloads with echo identity.
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
function makeAction(name, automation = {}) {
  return {
    name,
    automation: {
      type: 'free_spell',
      ...automation,
    },
  };
}

// Known no-damage spells so any fall-through lands on the #1969 popup lane
// (known-spell short-circuit — fetch never runs on this lane).
const knownSpells = [
  { name: 'Fire Bolt', school: 'Evocation', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } },
  { name: 'Misty Step', school: 'Conjuration' },
  { name: 'Light', school: 'Evocation' },
  { name: 'Invisibility', school: 'Illusion' },
  { name: 'Detect Thoughts', school: 'Divination' },
  { name: 'Burning Hands', school: 'Evocation' },
  { name: 'False Life', school: 'Necromancy' },
  { name: 'Shield of Faith', school: 'Abjuration' },
  { name: 'Sanctuary', school: 'Abjuration' },
];

const ps = () => makePlayerStats({ spellAbilities: { spells: knownSpells } });

function storedTable(map = {}) {
  runtimeState.getRuntimeValue.mockImplementation((who, key) =>
    (key in map ? map[key] : null));
}

const counterKeys = () =>
  runtimeState.setRuntimeValue.mock.calls.map(c => c[1]).filter(k => k.includes('freeCastCount'));

// Charge-write lane filter: the continue leg's second write is #1969's grant
// stamp — this lane pins the channelDivinityCharges VALUES, never the stamp.
const chargeWrites = () =>
  runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'channelDivinityCharges');

describe('spellCastHandler.resourceCost - Channel Divinity charge math (handleChannelDivinity L145-163, #1970 canonical)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('counter/CD routes never look spells up'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('blocks at 0 and negative charges with the full strict automation_info payload — no decrement, no stamp, no roll, no fetch', async () => {
    const action = makeAction('Radiant Authority', { spell: 'Fire Bolt', resourceCost: 'channel_divinity' });

    for (const stored of [0, -1]) {
      runtimeState.setRuntimeValue.mockClear();
      storedTable({ 'channelDivinityCharges': stored });
      const result = await handle(action, ps(), campaignName, null);

      expect(result, `stored ${stored}`).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Radiant Authority',
          description: 'No Channel Divinity charges remaining.',
          automation: action.automation,
        },
      });
      expect(result.payload.automation).toBe(action.automation);
      // The charge is never spent on the block lane — not even into negative.
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      // The block stops the cast BEFORE the damage lookup (#1966 lane).
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    }
  });

  it('stored charge Number() coercion and null/undefined maxCharges default — exact charge-write table per press (stamp values: #1969)', async () => {
    const action = makeAction('Radiant Authority', { spell: 'Shield of Faith', resourceCost: 'channel_divinity' });

    // Numeric strings coerce: '0' blocks, '2' decrements to numeric 1.
    storedTable({ 'channelDivinityCharges': '0' });
    let result = await handle(action, ps(), campaignName, null);
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

    // Charge-write lane only — the second write on the continue leg is the
    // #1969 grant stamp (its VALUE stays theirs; key order pinned by them).
    runtimeState.setRuntimeValue.mockClear();
    storedTable({ 'channelDivinityCharges': '2' });
    await handle(action, ps(), campaignName, null);
    expect(chargeWrites()).toEqual([
      ['TestWizard', 'channelDivinityCharges', 1, campaignName],
    ]);

    // null and undefined both re-default to maxCharges (2 here) and spend to 1.
    runtimeState.setRuntimeValue.mockClear();
    storedTable({});
    await handle(action, ps(), campaignName, null);
    expect(chargeWrites()).toEqual([
      ['TestWizard', 'channelDivinityCharges', 1, campaignName],
    ]);

    runtimeState.setRuntimeValue.mockClear();
    runtimeState.getRuntimeValue.mockImplementation(() => undefined);
    await handle(action, ps(), campaignName, null);
    expect(chargeWrites()).toEqual([
      ['TestWizard', 'channelDivinityCharges', 1, campaignName],
    ]);
  });

  it('continue leg value canon: exact charge decrement write is the first call; Q1 read arity pinned (2-arg at L146, 3-arg downstream)', async () => {
    // popup #1969 pinned this leg's KEY ORDER only — the VALUES are canonical here.
    storedTable({ 'channelDivinityCharges': 3 });
    const action = makeAction('Radiant Authority', { spell: 'Shield of Faith', resourceCost: 'channel_divinity' });

    const result = await handle(action, ps(), campaignName, null);

    expect(result.type).toBe('popup');
    // First write: the spent charge, exact value (3 → 2). The second write is
    // #1969's grant stamp — existence proves the continue ran, its VALUE is theirs.
    expect(runtimeState.setRuntimeValue.mock.calls[0]).toEqual(
      ['TestWizard', 'channelDivinityCharges', 2, campaignName],
    );
    expect(runtimeState.setRuntimeValue.mock.calls.map(c => c[1])).toEqual([
      'channelDivinityCharges', '_Radiant_Authority_freeCast',
    ]);
    // Q1: the charge read is a 2-arg call (L146 omits campaignName); the grant
    // latch read downstream carries campaignName. Arity locked as-is.
    expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
      ['TestWizard', 'channelDivinityCharges'],
      ['TestWizard', '_Radiant_Authority_freeCast', campaignName],
    ]);
    // No perSpellTracking reset (#1971) → that block never logs here.
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('resolveChannelDivinityMaxCharges (L139-142): index class_levels[level-1] NOT find(), class_specific fallback, falsy 0 and missing legs default to 2 (Q2)', async () => {
    const action = makeAction('Radiant Authority', { spell: 'Shield of Faith', resourceCost: 'channel_divinity' });
    // stored null everywhere → the default IS the max, and the write is max - 1.
    runtimeState.getRuntimeValue.mockReturnValue(null);

    const cases = [
      { label: 'missing class entirely → hardcoded 2', ps: makePlayerStats(), del: 'class', expectWrite: 1 },
      { label: 'class without class_levels → 2', ps: makePlayerStats({ class: {} }), expectWrite: 1 },
      { label: 'level 10 index past the class_levels array → 2', ps: makePlayerStats({ class: { class_levels: [{ level: 1, channel_divinity: 5 }] } }), expectWrite: 1 },
      { label: 'level-3 INDEX entry wins over level-matching position (indexing, not find())', ps: makePlayerStats({ level: 3, class: { class_levels: [{ level: 3, channel_divinity: 5 }, { level: 9, channel_divinity: 7 }, { level: 1, channel_divinity: 3 }] } }), expectWrite: 2 },
      { label: 'class_specific.channel_divinity_charges fallback', ps: makePlayerStats({ level: 2, class: { class_levels: [{}, { class_specific: { channel_divinity_charges: 3 } }] } }), expectWrite: 2 },
      { label: 'channel_divinity: 0 is falsy → || chain falls to 2 (locked)', ps: makePlayerStats({ level: 1, class: { class_levels: [{ channel_divinity: 0 }] } }), expectWrite: 1 },
      { label: 'missing level → (level||1)-1 → index 0', ps: makePlayerStats({ level: undefined, class: { class_levels: [{ channel_divinity: 4 }] } }), expectWrite: 3 },
    ];

    for (const c of cases) {
      runtimeState.setRuntimeValue.mockClear();
      if (c.del) delete c.ps[c.del];
      await handle(action, c.ps, campaignName, null);
      expect(chargeWrites(), c.label).toEqual([
        ['TestWizard', 'channelDivinityCharges', c.expectWrite, campaignName],
      ]);
    }
  });

  it('War God\'s Blessing (prod live, 2024/classes.json): the charge decrement is the first write before the #1971 intercept — popup content stays theirs', async () => {
    // Verbatim prod automation row; stored charges null → max 2 → spend to 1.
    const action = {
      name: "War God's Blessing",
      automation: {
        type: 'free_spell',
        spell: ['Shield of Faith', 'Spiritual Weapon'],
        resourceCost: 'channel_divinity',
        noConcentration: true,
        duration: '1_minute',
        action: 'action',
        casting_time: '1 action',
        recharge: 'short_or_long_rest',
      },
    };

    const result = await handle(action, ps(), campaignName, null);

    expect(runtimeState.setRuntimeValue.mock.calls[0]).toEqual(
      ['TestWizard', 'channelDivinityCharges', 1, campaignName],
    );
    // Identity of the returned popup: bare html = #1971's activation shape (NOT
    // the automation_info echo, NOT this lane's counters) — content unpinned.
    expect(result.payload.type).toBeUndefined();
    expect(result.payload.html).toBeDefined();
    // Neither the grant latch nor any counter is stamped — their interceptor
    // returns before the multi gate (#1968) and before the counter routes (#mine).
    const keys = runtimeState.setRuntimeValue.mock.calls.map(c => c[1]);
    expect(keys.filter(k => k.includes('freeCast'))).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('spellCastHandler.resourceCost - FREE_CAST_ROUTES match + order (L374-380)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('counter routes never look spells up'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('route[0] beats route[1] when every counter field is present — count defaults from usesMax, not uses', async () => {
    // Both matches would pass route[1] (uses + recharge); FREE_CAST_ROUTES order
    // (L375-380, evaluated L404) picks route[0]. Discriminator is the VALUE:
    // usesMax 3 → 2 remaining; a route[1] mistake would default from uses 1 → 0.
    const action = makeAction('Fey Step', {
      spell: 'Misty Step',
      uses_expression: 'WIS modifier_min_1',
      usesMax: 3,
      uses: 1,
      recharge: 'short_rest',
    });

    const result = await handle(action, ps(), campaignName, null);

    expect(result.payload.html).toContain('(2 remaining)');
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Step_freeCastCount', 2, campaignName],
    ]);
  });

  it('route-miss table (prod rows included): the counter key is NEVER touched — popup lane receives the cast (#1969)', async () => {
    const misses = [
      // prod Shadow Magic feat row verbatim: recharge but no uses/usesMax.
      { label: 'recharge, no counters (prod Shadow Magic feat row)',
        action: makeAction('Shadow Magic', { spell: ['Invisibility'], perSpellTracking: true, recharge: 'long_rest' }) },
      // prod feats.json row verbatim — D3: uses_expression blocks route[1] (L379)
      // and missing usesMax blocks route[0] (L377), despite #1969's scan note.
      { label: 'uses + uses_expression, no usesMax (prod Detect Thoughts feat row, D3)',
        action: makeAction('Detect Thoughts', { spell: 'Detect Thoughts', uses: 1, uses_expression: '1', recharge: 'long_rest', action: 'action' }) },
      // uses WITHOUT recharge → route[1] match fails (L379).
      { label: 'uses without recharge', action: makeAction('Fleet Footing', { spell: 'Light', uses: 3 }) },
      // usesMax: 0 is falsy → route[0] match fails even with an expression.
      { label: 'usesMax 0 is falsy', action: makeAction('Gale Stride', { spell: 'Light', uses_expression: 'WIS modifier_min_1', usesMax: 0 }) },
    ];

    for (const c of misses) {
      runtimeState.setRuntimeValue.mockClear();
      const result = await handle(c.action, ps(), campaignName, null);
      expect(result.type, c.label).toBe('popup');
      expect(result.payload.html, c.label).not.toContain('remaining');
      expect(counterKeys(), c.label).toEqual([]);
    }
    // Shadow Magic's ARRAY spell misses the known-spell find (strict === vs
    // string) and reaches the fetch lookup — URL selection and the fetch-reject
    // fall-through are #1971's canonical; no fetch-absence claim here.
  });
});

describe('spellCastHandler.resourceCost - route[0] uses_expression counter (handleUsesExpressionFreeCast L189-215)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('route[0] never looks spells up'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('grant press: full own-composition html with (n remaining), exact single decrement write, zero side effects', async () => {
    // Builder-enrich shape (spell.js:6-17 synthesizes usesMax + uses from the
    // WIS-expression row; CLA-229 pins live pools carry usesMax 3).
    const action = makeAction('Fey Step', {
      spell: 'Misty Step',
      uses_expression: 'WIS modifier_min_1',
      usesMax: 3,
      uses: 3,
      recharge: 'long_rest',
      casting_time: 'passive',
    });

    const result = await handle(action, ps(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Fey Step</b><br/><br/><br/><b>Free cast of:</b> Misty Step (2 remaining).<br/><br/><em>Open your spell sheet and cast Misty Step normally — no spell slot will be consumed.</em>',
      },
    });
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Fey_Step_freeCastCount', campaignName);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Step_freeCastCount', 2, campaignName],
    ]);
    // No campaign-log on the counter lane at source (the only log in this handler
    // family sits inside #1971's perSpellTracking block) — locked source reality.
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('stored count Number() coercion: string counts decrement to numeric writes; stored negative blocks with no write', async () => {
    const action = makeAction('Fey Step', {
      spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', usesMax: 3, recharge: 'long_rest',
    });

    storedTable({ '_Fey_Step_freeCastCount': '1' });
    let result = await handle(action, ps(), campaignName, null);
    expect(result.payload.html).toContain('(0 remaining)');
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Fey_Step_freeCastCount', 0, campaignName],
    ]);
    expect(typeof runtimeState.setRuntimeValue.mock.calls[0][2]).toBe('number');

    runtimeState.setRuntimeValue.mockClear();
    storedTable({ '_Fey_Step_freeCastCount': -2 });
    result = await handle(action, ps(), campaignName, null);
    expect(result.payload.type).toBe('automation_info');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('D1 as-is: the route[0] block hardcodes Long Rest regardless of recharge — rechargeTextFor is never consulted', async () => {
    const action = makeAction('Fey Step', {
      spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', usesMax: 3, recharge: 'short_rest',
    });
    storedTable({ '_Fey_Step_freeCastCount': 0 });

    let result = await handle(action, ps(), campaignName, null);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fey Step',
        description: 'No free casts remaining. Finish a Long Rest to regain them.',
        automation: action.automation,
      },
    });

    // short_or_long_rest: same Long-Rest prose on this route (L200 ignores
    // recharge entirely) — the short arms belong to rechargeTextFor (route[1]).
    action.automation.recharge = 'short_or_long_rest';
    result = await handle(action, ps(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('castLabels land AFTER the (n remaining) counter text — placement is the counter route\'s composition', async () => {
    const action = makeAction('Fey Step', {
      spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', usesMax: 3,
      noConcentration: true, duration: '1_minute',
    });

    const result = await handle(action, ps(), campaignName, null);

    expect(result.payload.html).toBe(
      '<b>Fey Step</b><br/><br/><br/><b>Free cast of:</b> Misty Step (2 remaining). Does not require Concentration. Duration: 1 minute.<br/><br/><em>Open your spell sheet and cast Misty Step normally — no spell slot will be consumed.</em>',
    );
  });
});

describe('spellCastHandler.resourceCost - route[1] uses+recharge counter + rechargeTextFor canon (L217-249)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('route[1] never looks spells up'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('prod live row (HexWarlock): full html + exact bracketed counter-key persistence; string uses coerces to numeric write', async () => {
    const action = makeAction('Level 1 Spell [Instance 1]', { spell: 'Burning Hands', uses: 1, recharge: 'long_rest' });

    const result = await handle(action, ps(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Level 1 Spell [Instance 1]</b><br/><br/><br/><b>Free cast of:</b> Burning Hands (0 remaining).<br/><br/><em>Open your spell sheet and cast Burning Hands normally — no spell slot will be consumed.</em>',
      },
    });
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Level_1_Spell_[Instance_1]_freeCastCount', 0, campaignName],
    ]);

    // Numeric-string uses (2024/classes.json ships "uses":"1" rows): counted as
    // numbers, persisted as numbers.
    runtimeState.setRuntimeValue.mockClear();
    const strUses = makeAction('Level 1 Spell [Instance 2]', { spell: 'Burning Hands', uses: '1', recharge: 'long_rest' });
    await handle(strUses, ps(), campaignName, null);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Level_1_Spell_[Instance_2]_freeCastCount', 0, campaignName],
    ]);
    expect(typeof runtimeState.setRuntimeValue.mock.calls[0][2]).toBe('number');
  });

  it('prod live Shadow Magic: route[1] intercepts the multi array BEFORE the #1968 gate — Q3 comma-no-space join, counter stamp ONLY', async () => {
    // Verbatim campaign row (public/campaigns/test-campaign/HexWarlock.json).
    const action = makeAction('Shadow Magic', {
      spell: ['False Life', 'Invisibility'],
      uses: 1,
      recharge: 'long_rest',
      perSpellTracking: true,
    });

    const result = await handle(action, ps(), campaignName, null);

    // spellName = auto.spell (the ARRAY, L385) → template-literal join is
    // comma-without-space. Pinned as-is (Q3).
    expect(result).toEqual({
      type: 'popup',
      payload: {
        html: '<b>Shadow Magic</b><br/><br/><br/><b>Free cast of:</b> False Life,Invisibility (0 remaining).<br/><br/><em>Open your spell sheet and cast False Life,Invisibility normally — no spell slot will be consumed.</em>',
      },
    });
    // The multi chooser and its stamps NEVER run (route returns at L406, the
    // multi gate at L409 is unreachable): only the counter is spent.
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Shadow_Magic_freeCastCount', 0, campaignName],
    ]);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('rechargeTextFor prose canon (L217-221): strict block-text table — short arms swap prose, long_rest and unknown take the caller fallback', async () => {
    const arms = [
      { recharge: 'short_rest', text: 'No free casts remaining. Finish a Short Rest to regain them.' },
      { recharge: 'short_or_long_rest', text: 'No free casts remaining. Finish a Short or Long Rest to regain them.' },
      // long_rest matches no short arm — it lands on the caller's fallback too.
      { recharge: 'long_rest', text: 'No free casts remaining. Finish a Long Rest to regain them.' },
      // truthy unknown recharge still matches route[1] (L379) — fallback prose.
      { recharge: 'once_per_moon', text: 'No free casts remaining. Finish a Long Rest to regain them.' },
    ];

    for (const arm of arms) {
      runtimeState.setRuntimeValue.mockClear();
      storedTable({ '_Sacred_Charge_freeCastCount': 0 });
      const action = makeAction('Sacred Charge', { spell: 'Sanctuary', uses: 1, recharge: arm.recharge });

      const result = await handle(action, ps(), campaignName, null);

      expect(result, arm.recharge).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sacred Charge',
          description: arm.text,
          automation: action.automation,
        },
      });
      expect(runtimeState.setRuntimeValue, arm.recharge).not.toHaveBeenCalled();
    }
  });

  it('deplete → block → REST-rearm cycle across four presses: exact accumulated write table, rest-event seam not a clock', async () => {
    const action = makeAction('Sacred Charge', { spell: 'Sanctuary', uses: 2, recharge: 'short_rest' });

    // Press 1: nothing stored → default uses 2 → spend to 1 (persisted).
    let result = await handle(action, ps(), campaignName, null);
    expect(result.payload.html).toContain('(1 remaining)');

    // Press 2: the persisted 1 is the new default → spend to 0 (persisted).
    storedTable({ '_Sacred_Charge_freeCastCount': 1 });
    result = await handle(action, ps(), campaignName, null);
    expect(result.payload.html).toContain('(0 remaining)');

    // Press 3: exhausted — blocked with the short_rest prose, NOTHING written.
    storedTable({ '_Sacred_Charge_freeCastCount': 0 });
    result = await handle(action, ps(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Short Rest to regain them.');

    // Press 4: SHORT REST seam nulls the counter (restRules re-arm resets keys to
    // null; handler re-defaults via ?? uses) → back to 1. No timer involved.
    storedTable({});
    result = await handle(action, ps(), campaignName, null);
    expect(result.payload.html).toContain('(1 remaining)');

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestWizard', '_Sacred_Charge_freeCastCount', 1, campaignName],
      ['TestWizard', '_Sacred_Charge_freeCastCount', 0, campaignName],
      ['TestWizard', '_Sacred_Charge_freeCastCount', 1, campaignName],
    ]);
  });
});

describe('spellCastHandler.resourceCost - result identity across route shapes (block echo vs bare counter html)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedTable({});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('resource lanes never look spells up'));
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('every block payload is automation_info + name + description + automation echo — every grant payload is bare html, never an echo', async () => {
    const blockKeys = ['type', 'name', 'description', 'automation'];

    const cdBlock = await handle(
      (() => { storedTable({ 'channelDivinityCharges': 0 }); return makeAction('Radiant Authority', { spell: 'Shield of Faith', resourceCost: 'channel_divinity' }); })(),
      ps(), campaignName, null,
    );
    expect(Object.keys(cdBlock.payload)).toEqual(blockKeys);

    const exprBlock = await handle(
      (() => { storedTable({ '_Fey_Step_freeCastCount': 0 }); return makeAction('Fey Step', { spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', usesMax: 3 }); })(),
      ps(), campaignName, null,
    );
    expect(Object.keys(exprBlock.payload)).toEqual(blockKeys);

    const rechargeBlock = await handle(
      (() => { storedTable({ '_Sacred_Charge_freeCastCount': 0 }); return makeAction('Sacred Charge', { spell: 'Sanctuary', uses: 1, recharge: 'short_rest' }); })(),
      ps(), campaignName, null,
    );
    expect(Object.keys(rechargeBlock.payload)).toEqual(blockKeys);

    // Clear the exhausted tables before the grant fixtures — a lingering 0
    // counter would block them and fake the identity pin.
    storedTable({});
    const exprGrant = await handle(
      makeAction('Fey Step', { spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', usesMax: 3 }),
      ps(), campaignName, null,
    );
    expect(Object.keys(exprGrant.payload)).toEqual(['html']);
    expect(exprGrant.payload.automation).toBeUndefined();

    const rechargeGrant = await handle(
      makeAction('Sacred Charge', { spell: 'Sanctuary', uses: 2, recharge: 'long_rest' }),
      ps(), campaignName, null,
    );
    expect(Object.keys(rechargeGrant.payload)).toEqual(['html']);

    // Identity guard: no resource route ever emits a roll or modal.
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
