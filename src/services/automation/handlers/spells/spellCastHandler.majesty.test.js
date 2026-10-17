// @maintained-by-ai
// spellCastHandler .majesty lane (#1967) — owns the Mantle of Majesty seam of
// spellCastHandler.js: isMantleOfMajestyCast (L370-372) + handleMantleOfMajesty
// (L75-120). SEPTET SEAM MAP lives in spellCastHandler.damage.test.js header
// (SEPTET HEAD — the law); seam-closure updates for the map go here.
//
// What majesty IS in this handler (verified at source + data): the cast-time
// ACTIVATION of the 2024 Bard College of Glamour *Mantle of Majesty*
// (public/data/2024/classes.json L1960, free_spell/Command/concentration:true —
// the test action mirrors it). It is NOT a damage bonus and NOT the reaction:
//   - unbreakableMajesty is a DIFFERENT module (src/services/combat/auras/
//     unbreakableMajesty.js, dispatched via reaction_bonus → reactionBonusHandler,
//     lane closed earlier) — distinct name, distinct runtime keys
//     (unbreakableMajestyActive/SaveDc/Blocked_*); never written here.
//   - The runtime key 'mantleOfMajestyActive' is NEVER written by this handler —
//     its appearances in clearAllExpirationEffects.js and the dice-roll event
//     hooks are defensive cross-module clears; not this lane's seam.
//
// Delegation discipline (no majestyService exists — grep verified; the handler
// owns the inline branch, downstream legs belong to their own modules and are
// pinned only as EMITTED contract here):
//   - free-cast AUTHORIZATION is delegated by buff NAME: spellPreparationService
//     .isFreeCastAuthorized (L314) reads activeBuffs for name match + 'Command';
//     own tests in spellPreparationService.isFreeCastAuthorized.test.js.
//   - expiry rides the shared remove_active_buff clock → clearExpirationEffects
//     .handleRemoveActiveBuff (canonical in the effects lanes); addExpiration
//     with no rounds → expiryRounds Infinity per expirationQueue.js (combat-
//     scoped, cleared at rest/initiative seams — turn-based, no wall-clock).
//   - buff field effect:'mantle_of_majesty' is WRITE-ONLY (no consumer anywhere;
//     identified by name downstream). Pinned in the exact stamp — locked as-is.
//   - concentration display belongs to concentrationService.addConcentration +
//     storage/persistence of combatSummary; pins here are call-contract only.
//
// Production liveness (verified): sole prod caller is the automation dispatch
// table `free_spell: handleSpellCast` (src/services/automation/index.js:313);
// the only free_spell+concentration action in prod data matching the name gate
// is Mantle of Majesty itself (2024 classes.json).
//
// ── Lane closure / handoff ──
// • Trimmed vs old: popup-html pin on the gate legs ('Charm Person' html)
//   REMOVED — grantFreeCastPopup html is #1969 .popup canonical; gate legs now
//   discriminate via result identity (automation_info, no html) + exact
//   activeBuffs-absence pins. rollExpression/EE short-circuit pin on the majesty
//   route stays in .damage (map: do not duplicate). 'mantle_of_majesty'
//   write-only + 'mantleOfMajestyActive' non-write are the drift findings added
//   to the map from this lane.
// • specialCases #1971 owns the addEntry .catch path ("logs console.error when
//   addEntry rejects in Mantle of Majesty") — happy-path log pin only here.
// • .popup #1969 owns the '_Mantle_of_Majesty_freeCast' stamp CONTENT if it ever
//   covers this action; here the stamp-absence pin only marks gate closure.
// • #1968/#1970/#1972: untouched by this seam — the majesty gate runs before
//   channel-divinity/free-cast routes (L391-398) and never touches them.
// No game timers — turn-based handler; tests use captured listeners, not
// setTimeout, and vi.waitFor is unnecessary (everything awaits directly).
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
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

// Mirrors the prod free_spell automation for Mantle of Majesty
// (public/data/2024/classes.json) — merge pattern per lane convention.
function makeAction(automation = {}, name = 'Mantle of Majesty') {
  return {
    name,
    description: 'You always have the Command spell prepared...',
    automation: {
      type: 'free_spell',
      spell: 'Command',
      freeCasts: 'at_will_while_active',
      action: 'bonus_action',
      duration: '1_minute',
      concentration: true,
      casting_time: '1 bonus action',
      ...automation,
    },
  };
}

const BUFF_NAME = 'Mantle of Majesty';

describe('spellCastHandler.majesty - Mantle of Majesty activation (isMantleOfMajestyCast + handleMantleOfMajesty canonical)', () => {
  let dispatchCount;
  let summaryListener;

  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    dispatchCount = 0;
    summaryListener = () => { dispatchCount += 1; };
    window.addEventListener('combat-summary-updated', summaryListener);
  });

  afterEach(() => {
    window.removeEventListener('combat-summary-updated', summaryListener);
    delete globalThis.fetch;
  });

  it('activation stamps the exact Mantle buff, registers remove_active_buff expiry, opens concentration at saveDc, and dispatches summary update', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard', spellAbilities: { saveDc: 15 }, proficiency: 5 });
    const summary = { creatures: [{ name: 'GlamourBard' }] };
    combatData.getCombatSummary.mockReturnValue(summary);

    const action = makeAction();
    const result = await handle(action, ps, campaignName, null);

    // Own-composition popup, exact strings (not the grantFreeCastPopup html lane).
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: BUFF_NAME,
        description: `${BUFF_NAME} activated! Command is now available as a free bonus action for 1 minute or until concentration ends.`,
        automation: action.automation,
      },
    });

    // Exact-key runtime pins: activeBuffs is the only key read or written.
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledTimes(1);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', campaignName);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
    // Exact buff stamp — effect:'mantle_of_majesty' is write-only by design
    // (authorization matches on NAME downstream); locked as-is.
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', [
      { name: BUFF_NAME, effect: 'mantle_of_majesty', duration: '1_minute' },
    ], campaignName);

    // Expiry contract: self-targeted remove_active_buff, no rounds arg in prod
    // shape → expirationQueue stamps expiryRounds Infinity (combat-scoped).
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'GlamourBard',
      targetName: 'GlamourBard',
      effects: [{ type: 'remove_active_buff', buffName: BUFF_NAME }],
      campaignName,
    });

    // Concentration display contract on the exact summary object.
    expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
    expect(concentrationService.addConcentration).toHaveBeenCalledWith(summary, 'GlamourBard', BUFF_NAME, 15);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', summary, campaignName);
    expect(dispatchCount).toBe(1);

    // Campaign log entry (happy path; rejection leg is #1971 canonical).
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'GlamourBard',
      abilityName: BUFF_NAME,
      description: 'GlamourBard activated Mantle of Majesty. Command is now available as a free bonus action for 1 minute or until concentration ends.',
    });
  });

  it('already-active activation short-circuits: already-active popup with no writes, expiry, concentration, dispatch, or log', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard' });
    runtimeState.getRuntimeValue.mockReturnValue([{ name: BUFF_NAME }]);

    const action = makeAction();
    const result = await handle(action, ps, campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: BUFF_NAME,
        description: `${BUFF_NAME} is already active.`,
        automation: action.automation,
      },
    });
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', campaignName);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(combatData.getCombatSummary).not.toHaveBeenCalled();
    expect(dispatchCount).toBe(0);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('name-gate fires for the exact name even when concentration, spell extras, or duration fall away', async () => {
    // isMantleOfMajestyCast = name match && free_spell && truthy concentration.
    // The prod automation always ships concentration:true; the true-side of the
    // gate is locked by test 1. Here: extras stripped, gate still matches.
    const ps = makePlayerStats({ name: 'GlamourBard', spellAbilities: { saveDc: 15 } });
    combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'GlamourBard' }] });

    const action = makeAction({ freeCasts: undefined, duration: undefined, casting_time: undefined });
    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toBe(`${BUFF_NAME} activated! Command is now available as a free bonus action for 1 minute or until concentration ends.`);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', [
      { name: BUFF_NAME, effect: 'mantle_of_majesty', duration: '1_minute' },
    ], campaignName);
    expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
  });

  it('gate discriminates by name, type, and concentration: any failed clause falls through to the shared popup lane', async () => {
    // Result-type-pin discipline (SEPTET map): the fall-through popup html is
    // .popup #1969 canonical; this lane pins only majesty-side ABSENCE —
    // no activeBuffs touch, no expiry, no concentration, no dispatch.
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => [] });

    const gateCases = [
      { label: 'wrong name', name: 'Other Feature', automation: { type: 'free_spell', spell: 'Command', concentration: true } },
      { label: 'no concentration', name: BUFF_NAME, automation: { type: 'free_spell', spell: 'Command' } },
      { label: 'not free_spell', name: BUFF_NAME, automation: { type: 'bonus_action', spell: 'Command', concentration: true } },
    ];

    for (const c of gateCases) {
      const ps = makePlayerStats({ name: 'Fallthrough Bard' });
      const result = await handle({ name: c.name, automation: c.automation }, ps, campaignName, null);

      // Majesty branch never ran: its popup carries an automation echo +
      // automation_info type; the shared grantFreeCastPopup emits bare html.
      expect(result.type, c.label).toBe('popup');
      expect(result.payload.automation, c.label).toBeUndefined();
      expect(runtimeState.getRuntimeValue, c.label).not.toHaveBeenCalledWith('Fallthrough Bard', 'activeBuffs', campaignName);
    }

    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Fallthrough Bard', 'activeBuffs', expect.anything(), campaignName);
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(dispatchCount).toBe(0);
  });

  it('concentration DC falls back to 8 + proficiency, then to 8 + 2 default, when spellAbilities.saveDc is absent', async () => {
    // saveDc || 8 + (proficiency || 2): the saveDc:0 branch runs the same
    // fallback (||, not ??) — pinned as locked source semantics.
    const summary = { creatures: [] };
    combatData.getCombatSummary.mockReturnValue(summary);

    const dcCases = [
      { label: 'proficiency fallback', name: 'BardProf', ps: makePlayerStats({ name: 'BardProf', proficiency: 3 }), dc: 11 },
      { label: 'no proficiency defaults 2', name: 'BareBard', ps: makePlayerStats({ name: 'BareBard' }), dc: 10 },
      { label: 'saveDc 0 is falsy, same fallback', name: 'ZeroDcBard', ps: makePlayerStats({ name: 'ZeroDcBard', spellAbilities: { saveDc: 0 }, proficiency: 4 }), dc: 12 },
    ];

    for (const c of dcCases) {
      const result = await handle(makeAction(), c.ps, campaignName, null);
      expect(result.type, c.label).toBe('popup');
    }

    expect(concentrationService.addConcentration).toHaveBeenNthCalledWith(1, summary, 'BardProf', BUFF_NAME, 11);
    expect(concentrationService.addConcentration).toHaveBeenNthCalledWith(2, summary, 'BareBard', BUFF_NAME, 10);
    expect(concentrationService.addConcentration).toHaveBeenNthCalledWith(3, summary, 'ZeroDcBard', BUFF_NAME, 12);
  });

  it('null combatSummary: activation completes (buff, expiry, log) but concentration, storage, and dispatch are skipped', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard' });
    combatData.getCombatSummary.mockReturnValue(null);

    const result = await handle(makeAction(), ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated!');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', [
      { name: BUFF_NAME, effect: 'mantle_of_majesty', duration: '1_minute' },
    ], campaignName);
    expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(dispatchCount).toBe(0);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
  });

  it('non-array activeBuffs normalizes to a fresh one-buff stamp instead of throwing', async () => {
    // Array.isArray guard (L78): truthy junk values must not crash the spread
    // and must not be preserved into the new buff list.
    const ps = makePlayerStats({ name: 'JunkyBard' });
    runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
    combatData.getCombatSummary.mockReturnValue({ creatures: [] });

    const result = await handle(makeAction(), ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('JunkyBard', 'activeBuffs', [
      { name: BUFF_NAME, effect: 'mantle_of_majesty', duration: '1_minute' },
    ], campaignName);
  });
});
