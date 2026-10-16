// spellCastHandler .wildCompanion lane — #1972, LAST of the spellCast septet.
// Owns per SEPTET SEAM MAP (spellCastHandler.damage.test.js header, the law):
// the CLA-388 branch (handle L387-389) + handleWildCompanion +
// hasAnySpellSlotAvailable + resolveWildShapeMax (L22-73) + the
// wild_companion_refused log. Verified at source: Wild Companion (Druid lv2,
// 2024) chooser-modal routing / refuse popup — NOT Wild Magic.
//
// CLA-388 bug-class (manifest + bug-CLA-388-wild-companion-unpaid-unlimited-
// free-cast.md): "row grants Find Familiar free cast UNPAID, chooser modal is
// dead code, resource never consumed". Fix shape: ROUTE to the modal and pay
// there — this handler must stamp NOTHING and spend NOTHING on any route.
// Bug-class pins below are mutation-strong: no *_freeCast*/_freeCastCount
// stamp ever (test 12), stored-zero never falls back to maxima (test 9),
// route-precedence before every other free_spell lane (test 2).
//
// Production liveness (verified): dispatch table free_spell: handleSpellCast
// (src/services/automation/index.js:313); prod automation is public/data/
// 2024/classes.json Druid class_levels[1].features "Wild Companion" — the
// fixture below deep-equals it (parity pinned in test 13). Modal
// 'wildCompanion' registered useCharActionsAutomation.js:286 →
// WildCompanionModal consumes payload {playerStats, campaignName} (payment
// lane — chooser pays slot 4→3 OR WS 4→3 there, per manifest).
//
// Handoff compliance: no rollExpression pins (#1966 owns those; no
// rollExpression assertion appears here). #1971 owns fetch-URL-selection /
// fetch-reject→popup pins — my fetch pins assert route-precedence
// never-called only. specialCases header ceded the '[spellCastHandler:log-error]'
// catch tag to this lane — pinned in test 11.
// No game timers — turn-based handler, none in tests either.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockAddEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../ui/logService.js', () => ({
  addEntry: (...args) => mockAddEntry(...args),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { handle } from './spellCastHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import classes2024 from '../../../../../public/data/2024/classes.json';

const campaignName = 'test-campaign';

// Deep-equals prod: public/data/2024/classes.json Druid class_levels[1].features (pinned, test 13).
const wildCompanionAction = {
  name: 'Wild Companion',
  automation: {
    type: 'free_spell',
    spell: 'Find Familiar',
    action: 'action',
    casting_time: '1 action',
    resourceCost: 'wild_companion',
  },
};

// Refusal composition is canonical HERE (CLA-359 shape, L48).
const REFUSE_REASON = 'Wild Companion requires expending a spell slot or a use of Wild Shape — none remaining.';

function makeDruid() {
  return {
    name: 'Wild_Sage_Druid',
    level: 20,
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 3,
      spell_slots_level_4: 3,
      spell_slots_level_5: 3,
      spell_slots_level_6: 1,
      spell_slots_level_7: 1,
      spell_slots_level_8: 1,
      spell_slots_level_9: 1,
    },
    _trackedResources: { wildShapeUses: { max: 2 } },
    // lv20 vs lv2 entry: level-matched class fallback MISSES → tracked max rules (test 8 pins the miss).
    class: { name: 'Druid', class_levels: [{ level: 2, wild_shape: 2 }] },
  };
}

// Druid with every slot max 0; per-key stored values from `slots`
// (default stored 0); wildShapeUses stored = wsStored; `trackMax` === null drops _trackedResources.
function druidWithStoredSlots(slots, wsStored = null, trackMax = 0) {
  const ps = makeDruid();
  for (let lvl = 1; lvl <= 9; lvl++) ps.spellAbilities[`spell_slots_level_${lvl}`] = 0;
  if (trackMax === null) ps._trackedResources = undefined;
  else ps._trackedResources = { wildShapeUses: { max: trackMax } };
  runtimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'wildShapeUses') return wsStored;
    return slots?.[key] ?? 0;
  });
  return ps;
}

function slotKeysQueried() {
  return runtimeState.getRuntimeValue.mock.calls
    .map(c => c[1])
    .filter(k => String(k).startsWith('spell_slots_level_'));
}

describe('spellCastHandler - Wild Companion (CLA-388) — #1972 .wildCompanion lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('routes a row click to the chooser modal: strict result table, identity payload refs, stamps/logs/spends NOTHING', async () => {
    const ps = makeDruid();
    const result = await handle(wildCompanionAction, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
    expect(Object.keys(result).sort()).toEqual(['modalName', 'payload', 'type']);
    expect(Object.keys(result.payload).sort()).toEqual(['action', 'campaignName', 'playerStats']);
    expect(result.payload.action).toBe(wildCompanionAction);
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('CLA-388 route precedence: resourceCost wild_companion short-circuits BEFORE uses/recharge routes, multi-spell lane and spell lookup', async () => {
    // Same auto carrying a uses+recharge counter would take FREE_CAST_ROUTES[1]
    // (stamping _Wild_Companion_freeCastCount) if the CLA-388 branch were reordered.
    const action = {
      name: 'Wild Companion',
      automation: { ...wildCompanionAction.automation, uses: 1, recharge: 'long_rest' },
    };
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn().mockRejectedValue(new Error('lookup must never run on the wild_companion route'));
    globalThis.fetch = fetchSpy;
    try {
      const result = await handle(action, makeDruid(), campaignName, null);
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('wildCompanion');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockAddEntry).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('a level-1 slot is enough to route (scan starts at spell_slots_level_1)', async () => {
    const ps = druidWithStoredSlots({ spell_slots_level_1: 1 });
    const result = await handle(wildCompanionAction, ps, campaignName, null);
    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
    // short-circuits immediately — lv2..9 never queried once lv1 answers true
    expect(slotKeysQueried()).toEqual(['spell_slots_level_1']);
  });

  it('a level-9 slot routes, scanning the exact slot-key ladder spell_slots_level_1..9 in order', async () => {
    const ps = druidWithStoredSlots({ spell_slots_level_9: 1 });
    const result = await handle(wildCompanionAction, ps, campaignName, null);
    expect(result.type).toBe('modal');
    expect(slotKeysQueried()).toEqual([
      'spell_slots_level_1', 'spell_slots_level_2', 'spell_slots_level_3',
      'spell_slots_level_4', 'spell_slots_level_5', 'spell_slots_level_6',
      'spell_slots_level_7', 'spell_slots_level_8', 'spell_slots_level_9',
    ]);
  });

  it('still routes to the chooser when only Wild Shape uses remain (all slots stored 0)', async () => {
    const ps = druidWithStoredSlots({}, 1);
    const result = await handle(wildCompanionAction, ps, campaignName, null);
    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('null-stored wildShapeUses defaults to tracked max (chooser still offered, nothing spent)', async () => {
    const ps = druidWithStoredSlots({}, null, 2);
    const result = await handle(wildCompanionAction, ps, campaignName, null);
    expect(result.type).toBe('modal');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('resolveWildShapeMax falls back to level-matched class_levels.wild_shape when _trackedResources is absent', async () => {
    const ps = druidWithStoredSlots({}, null, null);
    ps.level = 2; // class_levels entry {level:2, wild_shape:2} now matches
    const result = await handle(wildCompanionAction, ps, campaignName, null);
    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
  });

  it('resolveWildShapeMax: no tracked resources AND no level-matched class entry → 0 → refuse', async () => {
    // lv20 druid, class_levels only carries the lv2 entry → find misses → max 0.
    const ps = druidWithStoredSlots({}, null, null);
    const result = await handle(wildCompanionAction, ps, campaignName, null);
    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe(REFUSE_REASON);
  });

  it('refuses at both-zero with strict popup table + full-string description + exactly one exact wild_companion_refused log, spending nothing — stored zeros beat non-zero maxima', async () => {
    // makeDruid maxima are all non-zero; stored 0 must NOT fall back to them.
    runtimeState.getRuntimeValue.mockImplementation((name, key) =>
      key === 'wildShapeUses' ? 0 : 0);
    const ps = makeDruid();
    const result = await handle(wildCompanionAction, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload).toEqual({
      type: 'automation_info',
      name: 'Wild Companion',
      automationType: 'free_spell',
      description: REFUSE_REASON,
      automation: wildCompanionAction.automation,
    });
    expect(result.payload.automation).toBe(wildCompanionAction.automation);
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
      type: 'automation',
      characterName: 'Wild_Sage_Druid',
      automationType: 'wild_companion_refused',
      name: 'Wild Companion',
      description: `Wild Companion refused — ${REFUSE_REASON}`,
    });
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('coerces stored string counts via Number: stored "0" refuses, stored "1" routes', async () => {
    const refused = await handle(wildCompanionAction, druidWithStoredSlots({}, '0'), campaignName, null);
    expect(refused.type).toBe('popup');
    expect(refused.payload.description).toBe(REFUSE_REASON);

    vi.clearAllMocks();
    const routed = await handle(wildCompanionAction, druidWithStoredSlots({}, '1'), campaignName, null);
    expect(routed.type).toBe('modal');
    expect(routed.modalName).toBe('wildCompanion');
  });

  it('refusal log rejection is caught and tagged [spellCastHandler:log-error] — popup still returned, nothing spent', async () => {
    runtimeState.getRuntimeValue.mockImplementation(() => 0);
    mockAddEntry.mockRejectedValueOnce(new Error('log down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await handle(wildCompanionAction, makeDruid(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.automationType).toBe('free_spell');
      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith('[spellCastHandler:log-error]', expect.any(Error));
      });
    } finally {
      errorSpy.mockRestore();
    }
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('CLA-388 bug-class: NEVER stamps any *_freeCast*_key on ANY route — unpaid grant is the bug', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    await handle(wildCompanionAction, makeDruid(), campaignName, null);
    runtimeState.getRuntimeValue.mockReturnValue(0);
    await handle(wildCompanionAction, makeDruid(), campaignName, null);

    const stampedKeys = runtimeState.setRuntimeValue.mock.calls.map(c => c[1]);
    expect(stampedKeys).toEqual([]);
    expect(stampedKeys).not.toContain('_Wild_Companion_freeCast'); // the original unpaid-grant key
  });

  it('prod-data parity: classes.json 2024 Druid lv2 Wild Companion deep-equals the fixture and routes through the CLA-388 branch', async () => {
    const druid = classes2024.find(c => c.name === 'Druid');
    expect(druid).toBeTruthy();
    const lv2 = druid.class_levels.find(cl => cl.level === 2);
    const feature = lv2.features.find(f => f.name === 'Wild Companion');
    expect(feature.automation).toEqual(wildCompanionAction.automation);

    const ps = {
      name: 'Wild_Sage_Druid',
      level: 2,
      rules: '2024',
      spellAbilities: lv2.spellcasting, // real block: lv1 slots 3, lv2..9 zero
      class: { name: 'Druid', class_levels: druid.class_levels },
      _trackedResources: { wildShapeUses: { max: lv2.wild_shape } },
    };
    const result = await handle(feature, ps, campaignName, null);
    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});
