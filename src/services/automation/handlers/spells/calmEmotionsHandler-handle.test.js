// @maintained-by-ai
/**
 * calmEmotions TRIO lane #1881 — handle() (trio seam map lives in the header of
 * calmEmotionsHandler-effects.test.js). Owns handle L266-380 and, via the handle route,
 * registerCalmEmotionsExpiration L147-156: the 10-round calm_emotions_end CLOCK is THIS
 * lane's (the eligibility lane pins the CALM_EMOTIONS_DURATION_ROUNDS constant only).
 * Owns the private helpers handle alone calls — recordCalmTargetResult L382-391 and
 * logCalmEmotionsSave L393-404 — plus the logCalmEmotionsEligibility L117-139 envelopes:
 * that logger is OUTSIDE the eligibility lane's L31-111 zero-write range and outside the
 * effects lane's applier range, and handle is its only production caller in the trio, so
 * its composed ineligible/advisory envelopes are pinned here (full-string, own-composition).
 *
 * NOT this lane (closed 2026-10-16): te SHAPE and latch CONTENT, buff shapes, and the
 * write-signature asymmetry of the two appliers — owned by calmEmotionsHandler-effects.test.js.
 * Per that lane's removal rec, the old 'should apply immunity effects on failed save' loose
 * te-rewalk (arrayContaining + objectContaining {target, effect, mode, dc}) is TRIMMED to a
 * reaches-applier smoke here: handle reaching applyCalmEmotionsImmunity is proven by the
 * target-store write landing (setRuntimeObject is called ONLY by that applier in handle's path)
 * and the default-immunity-leg L351 dispatch by registerTargetEffect (the indifferent applier's
 * sink) NEVER firing — never by re-pinning te content.
 * Eligibility TRUTH TABLES (humanoid gate, sphere math, advisory splits) belong to
 * calmEmotionsHandler-eligibility.test.js — this lane only consumes the resolver's outcome:
 * eligible targets get prompts, ineligible get none + their log envelope.
 *
 * Caller liveness (verified at source 2026-10-16): dispatched via automation/index.js
 * L244/L578 `calm_emotions: handleCalmEmotions` (non-interactive generic automation route;
 * the interactive route goes through CalmEmotionsModal.jsx, which owns its own tests).
 *
 * Lane patterns: exact-key pins; full-string own-composition log pins (ability_use L331,
 * save_result L346/L361, popup summary L368-370); no-double-write guards (one expiration
 * clock per cast even with N targets; exactly one target-store write + one campaign te write
 * per affected target); mockRejectedValueOnce for the addEntry-resilience leg; real sphere
 * math only where a measurable map is staged (resilience test), lenient no-map default
 * everywhere else. No setTimeout / vi.waitFor needed — handle awaits its own chain.
 *
 * Turn-based: the expiration registration is a round-latch enqueue (addExpiration, rounds: 10)
 * cleared at initiative/concentration/rest seams — never a wall-clock; no timers in this file
 * (Date.now() inside the eligibility logger is a benign timestamp on a mocked sink).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

const { default: storage } = await import('../../../ui/storage.js');

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

// Registry spy: handle's default leg must route to the immunity applier (direct
// setRuntimeValue sink, effects-lane owned) and NEVER to registerTargetEffect —
// the indifferent applier belongs to the modal's choice routing, not this route.
vi.mock('../../../combat/conditions/targetEffectDefinitions.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, registerTargetEffect: vi.fn(actual.registerTargetEffect) };
});

import { handle } from './calmEmotionsHandler.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import {
  getRuntimeValue,
  setRuntimeValue,
  setRuntimeObject,
} from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const campaignName = 'TestCampaign';
const CASTER = 'TestWizard';
const SPELL = 'Calm Emotions';

function makePlayerStats(overrides = {}) {
  return {
    name: CASTER,
    level: 10,
    proficiency: 4,
    ...overrides,
  };
}

function makeAction(automation = {}, metaCtx = {}) {
  return {
    name: SPELL,
    automation: {
      type: 'calm_emotions',
      ...automation,
    },
    metaCtx,
  };
}

function resolvedListener(success, extra = {}) {
  return {
    promptId: success ? 'goblin-prompt' : 'fail-prompt',
    promise: Promise.resolve({ success, ...extra }),
  };
}

const singleTargetCombat = {
  creatures: [{ name: 'EnemyGoblin' }],
};

const multiTargetCombat = {
  creatures: [
    { name: 'EnemyGoblin' },
    { name: 'EnemyOrc' },
  ],
};

// Humanoid default; Pseudodragon is the canonical ineligible (truth tables — eligibility lane).
function monsterRouter(name) {
  if (String(name).startsWith('Pseudodragon')) return { name: 'Pseudodragon', type: 'Dragon' };
  return { name: 'Bandit', type: 'Humanoid' };
}

// Lenient no-map geometry by default: every cast consumes a no_map_lenient advisory.
function activeMapRouter(mapName = 'map1') {
  getRuntimeValue.mockImplementation((entity, key) => {
    if (entity === '__map__' && key === 'activeMapName') return mapName;
    return undefined;
  });
}

describe('calmEmotionsHandler - handle (L266-380)', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // keeps implementations; only call books are wiped
    buildSaveDc.mockReturnValue(13);
    getCombatSummary.mockReturnValue(null);
    getRuntimeValue.mockReturnValue(undefined);
    getMonsterData.mockImplementation(async (name) => monsterRouter(name));
  });

  describe('combat-context gate', () => {
    it('returns the no-creatures popup and touches nothing when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: SPELL,
          description: 'No creatures in combat. Calm Emotions has no effect.',
        },
      });
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('returns the same popup for an empty creatures array', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('No creatures in combat. Calm Emotions has no effect.');
    });
  });

  describe('concentration registration + storage/event', () => {
    it('registers concentration, persists summary, and dispatches combat-summary-updated once', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));
      const mockCombatSummary = { creatures: [{ name: CASTER }] };
      getCombatSummary.mockReturnValue(mockCombatSummary);

      let dispatched = 0;
      const onUpdated = () => { dispatched++; };
      window.addEventListener('combat-summary-updated', onUpdated);

      const stats = makePlayerStats({ spellAbilities: { saveDc: 15 } });
      await handle(makeAction(), stats, campaignName, null);

      expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
      expect(addConcentration).toHaveBeenCalledWith(mockCombatSummary, CASTER, SPELL, 15);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, campaignName);
      expect(dispatched).toBe(1);
      window.removeEventListener('combat-summary-updated', onUpdated);
    });

    it('computes concentration DC as 8 + proficiency when spellAbilities.saveDc is missing', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));
      const mockCombatSummary = { creatures: [{ name: CASTER }] };
      getCombatSummary.mockReturnValue(mockCombatSummary);

      // 8 + (proficiency 4) = 12; buildSaveDc stays the mocked 13 for the save prompts —
      // the two DC derivations are independent by design.
      const statsNoSaveDc = makePlayerStats({ spellAbilities: { modifier: 3 }, proficiency: 4 });
      await handle(makeAction(), statsNoSaveDc, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(mockCombatSummary, CASTER, SPELL, 12);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ saveDc: 13 }));
    });

    it('skips concentration and storage entirely when the combat summary is null, but still prompts', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));
      getCombatSummary.mockReturnValue(null);

      let dispatched = 0;
      const onUpdated = () => { dispatched++; };
      window.addEventListener('combat-summary-updated', onUpdated);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(dispatched).toBe(0);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      window.removeEventListener('combat-summary-updated', onUpdated);
    });
  });

  describe('storeSpellLastAttack', () => {
    it('stores the aoe CHA save context verbatim', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: CASTER,
        spellName: SPELL,
        saveType: 'CHA',
        saveDc: 13,
        attackScope: 'aoe',
      });
    });
  });

  describe('save prompt / DC wiring', () => {
    it('creates one save listener with the exact CHA config', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CHA',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('excludes the caster from prompted targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: CASTER }, { name: 'EnemyGoblin' }],
      });
      createSaveListener.mockReturnValue(resolvedListener(true));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Caster is eligible per the resolver but handle filters it out of targets (L310).
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CHA',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('applies disadvantage when metamagicHeighten matches the target', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));

      await handle(
        makeAction({}, { metamagicHeighten: 'EnemyGoblin' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CHA',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: true,
      });
    });
  });

  describe('eligibility outcome consumption (routing + gates, not truth tables)', () => {
    it('never prompts an ineligible non-Humanoid and logs its exact ineligible envelope', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }, { name: 'Pseudodragon' }],
      });
      createSaveListener.mockReturnValue(resolvedListener(true));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'EnemyGoblin' }));
      // Envelope composed by logCalmEmotionsEligibility, executed only via handle — owned here.
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'automation',
        automationType: 'calm_emotions_ineligible',
        automationDetail: 'not_humanoid',
        characterName: 'Pseudodragon',
        sourceName: CASTER,
        description: 'Pseudodragon is not affected by Calm Emotions (not a Humanoid).',
        timestamp: expect.any(Number),
      });
    });

    it('consumes the lenient no-map advisory with its exact envelope and still processes targets', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));
      // getRuntimeValue default-undefined => no activeMapName => advisory 'no_map_lenient'.

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'automation',
        automationType: 'calm_emotions_sphere_advisory',
        automationDetail: 'no_map_lenient',
        characterName: CASTER,
        description: 'Calm Emotions sphere could not be measured for this casting (no_map_lenient) — selection is advisory; GM enforces the 20-foot-radius sphere.',
        timestamp: expect.any(Number),
      });
      expect(loadMapData).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('No creatures affected by Calm Emotions. 1 creature(s) saved.');
    });
  });

  describe('save success path', () => {
    it('logs ability_use and save_result with full own-composition descriptions', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: CASTER,
        abilityName: SPELL,
        description: 'TestWizard casts Calm Emotions! EnemyGoblin must make a CHA save (DC 13) or be affected.',
        promptId: 'goblin-prompt',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: CASTER,
        rollType: 'save-calm-emotions',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CHA',
        success: true,
        description: 'EnemyGoblin succeeded on CHA save against Calm Emotions.',
      });
    });

    it('records target results: saves roll/total verbatim and defaults absent values to 0', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: `prompt-${callCount}`,
          promise: Promise.resolve(
            callCount === 1 ? { success: true, roll: 12, total: 15 } : { success: true },
          ),
        };
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveResult: 'success',
        roll: 12,
        total: 15,
        conditions: [],
        appliedDamage: 0,
      });
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyOrc',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('summarizes an all-save cast verbatim in the popup', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('No creatures affected by Calm Emotions. 1 creature(s) saved.');
    });
  });

  describe('save failure path (default immunity leg L351)', () => {
    it('reaches the immunity applier once per target and never delegates to the indifferent applier', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(false));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Reaches-applier smoke (te/buff CONTENT is effects-lane owned): setRuntimeObject is
      // written ONLY inside applyCalmEmotionsImmunity on this route, and the campaign te
      // write is its single direct 4-arg sink. registerTargetEffect NEVER firing proves the
      // default leg chose immunity, not indifferent.
      expect(setRuntimeObject).toHaveBeenCalledTimes(1);
      expect(setRuntimeObject).toHaveBeenCalledWith('EnemyGoblin', expect.anything(), campaignName);
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), campaignName);
      expect(registerTargetEffect).not.toHaveBeenCalled();
    });

    it('logs the failed-save envelope with full own-composition descriptions', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(false));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: CASTER,
        abilityName: SPELL,
        description: 'TestWizard casts Calm Emotions! EnemyGoblin must make a CHA save (DC 13) or be affected.',
        promptId: 'fail-prompt',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: CASTER,
        rollType: 'save-calm-emotions',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CHA',
        success: false,
        description: 'EnemyGoblin failed CHA save against Calm Emotions. Granted immunity to Charmed/Frightened.',
      });
    });

    it('records the failed target result with verbatim roll/total', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(false, { roll: 3, total: 6 }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveResult: 'failure',
        roll: 3,
        total: 6,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('summarizes a failed cast verbatim in the popup', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(false));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Calm Emotions affects 1 creature(s). EnemyGoblin is immune to Charmed and Frightened. 0 creature(s) saved.',
      );
    });
  });

  describe('multiple targets', () => {
    it('fans out one prompt + one applier write per target while registering ONE expiration clock per cast', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(false));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener.mock.calls.map(c => c[1].targetName)).toEqual(['EnemyGoblin', 'EnemyOrc']);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Calm Emotions affects 2 creature(s). EnemyGoblin is immune to Charmed and Frightened. EnemyOrc is immune to Charmed and Frightened. 0 creature(s) saved.',
      );
      // No-double-write guard: the cast-scoped clock is per-casting, not per-target;
      // the per-target sinks fan exactly once each.
      expect(addExpiration).toHaveBeenCalledTimes(1);
      expect(setRuntimeObject).toHaveBeenCalledTimes(2);
      expect(setRuntimeObject).toHaveBeenCalledWith('EnemyGoblin', expect.anything(), campaignName);
      expect(setRuntimeObject).toHaveBeenCalledWith('EnemyOrc', expect.anything(), campaignName);
      expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    });

    it('summarizes mixed save outcomes verbatim in prompt and popup order', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: `prompt-${callCount}`,
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener.mock.calls.map(c => c[1].targetName)).toEqual(['EnemyGoblin', 'EnemyOrc']);
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'EnemyGoblin',
        saveResult: 'success',
      }));
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'EnemyOrc',
        saveResult: 'failure',
      }));
      expect(result.payload.description).toBe(
        'Calm Emotions affects 1 creature(s). EnemyOrc is immune to Charmed and Frightened. 1 creature(s) saved.',
      );
    });
  });

  describe('expiration clock (SP-020 B5 — handle-route mechanism, per trio map)', () => {
    it('enqueues one 10-round calm_emotions_end round-latch on the caster per cast', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Round latch consumed by expirationQueue at initiative seams; expiry handler is
      // clearExpirationEffects.calm-emotions-end.test.js's lane. Clock shape + count here.
      expect(addExpiration).toHaveBeenCalledTimes(1);
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: CASTER,
        targetName: CASTER,
        effects: [{ type: 'calm_emotions_end', source: CASTER }],
        campaignName,
        rounds: 10,
        expireOnCreatureName: null,
      });
    });
  });

  describe('popup payload', () => {
    it('carries action.name into both the popup and the ability_use log', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));

      const customAction = {
        name: 'Custom Calm Emotions',
        automation: { type: 'calm_emotions' },
        metaCtx: {},
      };
      const result = await handle(customAction, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Custom Calm Emotions',
        description: 'No creatures affected by Calm Emotions. 1 creature(s) saved.',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Custom Calm Emotions',
      }));
    });
  });

  describe('log rejection resilience', () => {
    it('survives an ability_use log rejection and completes the cast (measurable-map geometry)', async () => {
      // Map staged so advisory/ineligible logs are EMPTY: the first addEntry is handle's
      // own ability_use (L327), whose .catch (L333) this leg pins. Real 5-ft sphere math:
      // target two cells (10ft) from caster is inside the 20-ft sphere.
      activeMapRouter();
      loadMapData.mockResolvedValue({
        players: [{ name: CASTER, gridX: 0, gridY: 0 }],
        placedItems: [{ name: 'EnemyGoblin', gridX: 2, gridY: 0 }],
      });
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue(resolvedListener(true));
      addEntry.mockRejectedValueOnce(new Error('log io'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(spy).toHaveBeenCalledWith('[calmEmotions] Error:', expect.any(Error));
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toBe('No creatures affected by Calm Emotions. 1 creature(s) saved.');
      spy.mockRestore();
    });
  });
});
