// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * polymorphHandler.test.js — lane #1936, FIRST of the polymorph PAIR
 * (sibling #1937 polymorphService.test.js runs immediately after).
 *
 * Split verified at source (cf. animalShapes trio precedent):
 * - THIS lane (polymorphHandler.js handle()): pure gating + payload builder —
 *   combat-context guard, target-found guard, precondition refusals (already
 *   polymorphed / 0 hp / shapechanger), enemy WIS save prompt flow,
 *   resolvePolymorphMaxCR (CR ≤ target level/CR), and the polymorph_select
 *   popup payload. ZERO writes: setRuntimeValue is pinned never-called here.
 * - SERVICE lane (#1937 polymorphService.js): applyPolymorph invocation-shape,
 *   confirmPolymorphTransform (form-stat swap, polymorphOriginal snapshot,
 *   tempHp/polymorphTempHp, targetEffects rewrite, concentration,
 *   pendingExpirations) and revertPolymorph. Not re-run here.
 *
 * Production-caller liveness (verified 2026-10-16):
 * - src/services/automation/index.js:537 — registry dispatch `polymorph: handlePolymorph`.
 * - polymorphService.applyPolymorph ← useSimpleSpellHandlers.js:153 and
 *   useComplexSpellHandlers.js:81 (two-stage spell flow).
 * - popup `polymorph_select` ← CharSheet.modals.jsx:63 → PolymorphSelectionModal
 *   → onPolymorphConfirm → service confirm lane (#1937).
 *
 * Mock fidelity notes:
 * - buildSaveDc mock mirrors the real savePrompt.js contract: numeric
 *   saveDc passthrough; missing → console.error + default 10 (the old mock
 *   returned 15 — mock-only semantics, retired).
 * - abilities-ARRAY prod-bug class (holdMonster #1924): this handler never
 *   reads playerStats.abilities (only .name; DC arrives numeric from
 *   applyPolymorph), so the array-shaped mock stats are inert here — the
 *   `.abilities?.CON?.bonus` object access on array stats lives in
 *   polymorphService.js:60 and is the service lane's concern.
 * - makeAction returns a fresh object each call; metaCtx replaces wholesale
 *   (no stale-merge trap).
 * - Turn-based only: no timers; the save adjudication is an awaited
 *   indefinite-prompt promise.
 */

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => (typeof auto.saveDc === 'number' ? auto.saveDc : 10)),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => fullName || 'Unknown' },
}));

import { handle, resolvePolymorphMaxCR } from './polymorphHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }], // array form, inert on this lane (see header)
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(metaCtx = {}) {
  return {
    name: 'Polymorph',
    automation: { type: 'polymorph', saveType: 'WIS', saveDc: 15 },
    spell: { name: 'Polymorph', level: 4 },
    spellSlotLevel: 4,
    metaCtx,
  };
}

const casterCreature = { name: casterName, type: 'player' };
const baseCreature = { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] };
const baseCombatContext = { creatures: [baseCreature, casterCreature] };

function setupBaseMocks({ allies = [casterName], saveResult = { success: false }, existingEffects = [] } = {}) {
  getCombatContext.mockResolvedValue(baseCombatContext);
  getAllyList.mockReturnValue(allies);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return existingEffects;
    return undefined;
  });
  createSaveListener.mockReturnValue({
    promptId: 'poly-prompt',
    promise: Promise.resolve(saveResult),
  });
}

function refusalPopup(description) {
  return { type: 'automation_info', name: 'Polymorph', description };
}

describe('polymorphHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMonsterData.mockResolvedValue(undefined); // default: no bestiary hit → CR default 1
  });

  describe('combat context validation', () => {
    it.each([
      ['null context', null],
      ['context without creatures', {}],
      ['empty creatures list', { creatures: [] }],
    ])('returns refusal popup when combat context has %s', async (_label, context) => {
      getCombatContext.mockResolvedValue(context);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: refusalPopup('No creatures in combat. Polymorph has no effect.'),
      });
    });

    it('routes absent automation through the real buildSaveDc default (10)', async () => {
      setupBaseMocks({ allies: [], saveResult: { success: false, roll: 5, total: 6 } });

      const actionWithoutAutomation = {
        name: 'Polymorph',
        spell: { name: 'Polymorph', level: 4 },
        spellSlotLevel: 4,
        metaCtx: { polymorphTarget: targetName },
      };

      const result = await handle(actionWithoutAutomation, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'polymorph_select',
          targetName,
          maxCR: 1,
          casterName,
          campaignName,
          spell: actionWithoutAutomation.spell,
          spellLevel: 4,
        },
      });
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 10,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });
  });

  describe('target validation', () => {
    it('returns popup when no polymorphTarget provided', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: refusalPopup('No target selected. Polymorph has no effect.'),
      });
    });

    it('returns popup when target not found in combat', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(makeAction({ polymorphTarget: 'NonExistent' }), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: refusalPopup('Target NonExistent not found in combat. Polymorph has no effect.'),
      });
    });

    it('reads player HP from runtime store via getTargetCurrentHp', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: targetName, type: 'player', currentHp: 5, maxHp: 7, traits: [] }, casterCreature],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === targetName && subKey === 'currentHitPoints') return 0;
        return undefined;
      });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: refusalPopup('Polymorph has no effect on a creature with 0 hit points.'),
      });
      expect(getRuntimeValue).toHaveBeenCalledWith(targetName, 'currentHitPoints', campaignName);
    });

    it.each([
      [
        'already polymorphed (string target)',
        () => setupBaseMocks({ existingEffects: [{ target: targetName, effect: 'polymorph', source: casterName }] }),
        'Goblin is already polymorphed.',
        'TestCaster casts Polymorph on Goblin, but Goblin is already transformed.',
      ],
      [
        'already polymorphed (array target)',
        () => setupBaseMocks({ existingEffects: [{ target: [targetName, 'alt'], effect: 'polymorph', source: casterName }] }),
        'Goblin is already polymorphed.',
        'TestCaster casts Polymorph on Goblin, but Goblin is already transformed.',
      ],
      [
        'monster at 0 currentHp',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ ...baseCreature, currentHp: 0 }, casterCreature] });
        },
        'Polymorph has no effect on a creature with 0 hit points.',
        'TestCaster casts Polymorph on Goblin, but a creature with 0 hit points can\'t be polymorphed.',
      ],
      [
        'monster at 0 via hit_points.current',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'monster', hit_points: { current: 0 } }, casterCreature] });
        },
        'Polymorph has no effect on a creature with 0 hit points.',
        'TestCaster casts Polymorph on Goblin, but a creature with 0 hit points can\'t be polymorphed.',
      ],
      [
        'shapechanger via trait',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ ...baseCreature, traits: [{ name: 'Shapechanger' }] }, casterCreature] });
        },
        'Polymorph has no effect on a shapechanger.',
        'TestCaster casts Polymorph on Goblin, but shapechangers are unaffected.',
      ],
      [
        'shapechanger via monsterType exact',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'npc', monsterType: 'Shapechanger', currentHp: 5 }, casterCreature] });
        },
        'Polymorph has no effect on a shapechanger.',
        'TestCaster casts Polymorph on Goblin, but shapechangers are unaffected.',
      ],
      [
        'shapechanger via monsterType substring',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'npc', monsterType: 'greater shapechanger', currentHp: 5 }, casterCreature] });
        },
        'Polymorph has no effect on a shapechanger.',
        'TestCaster casts Polymorph on Goblin, but shapechangers are unaffected.',
      ],
      [
        'shapechanger via type_tags',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ ...baseCreature, type_tags: ['shapechanger'] }, casterCreature] });
        },
        'Polymorph has no effect on a shapechanger.',
        'TestCaster casts Polymorph on Goblin, but shapechangers are unaffected.',
      ],
    ])('refusal gate: %s', async (_label, setup, description, logDescription) => {
      setup();

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result).toEqual({ type: 'popup', payload: refusalPopup(description) });
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Polymorph',
        description: logDescription,
      }));
    });
  });

  describe('non-ally target save flow', () => {
    it('prompts the WIS save, logs cast + failure, returns polymorph_select', async () => {
      setupBaseMocks({ allies: [], saveResult: { success: false, roll: 5, total: 6 } });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Polymorph',
        description: 'TestCaster casts Polymorph on Goblin! Goblin must make a WIS save (DC 15) or be transformed into a beast.',
        promptId: 'poly-prompt',
      });
      const saveLog = addEntry.mock.calls.find(call => call[1]?.rollType === 'save-polymorph')[1];
      expect(saveLog).toEqual({
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-polymorph',
        targetName,
        saveDc: 15,
        saveType: 'WIS',
        success: false,
        description: 'Goblin failed WIS save against Polymorph and is transformed into a beast.',
      });
      expect(result.payload.type).toBe('polymorph_select');
    });

    it('returns automation_info and records a clean save when target resists', async () => {
      setupBaseMocks({ allies: [], saveResult: { success: true, roll: 15, total: 20 } });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: refusalPopup('Goblin resisted the transformation.'),
      });
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 15,
        total: 20,
        conditions: [],
        appliedDamage: 0,
      });
      const saveLog = addEntry.mock.calls.find(call => call[1]?.rollType === 'save-polymorph')[1];
      expect(saveLog.success).toBe(true);
      expect(saveLog.description).toBe('Goblin succeeded on WIS save against Polymorph.');
    });

    it('defaults roll/total to 0 in addTargetResult when the save result omits them', async () => {
      setupBaseMocks({ allies: [], saveResult: { success: true } });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('automation_info');
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('passes metamagicHeighten through as disadvantage', async () => {
      setupBaseMocks({ allies: [] });

      await handle(makeAction({ polymorphTarget: targetName, metamagicHeighten: true }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: true,
      });
    });
  });

  describe('ally target', () => {
    it('skips the save and returns polymorph_select popup for allies', async () => {
      setupBaseMocks({ allies: [casterName, targetName] });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('polymorph_select');
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('polymorph_select payload (CR cap + passthrough, zero writes)', () => {
    it('returns the exact popup payload with default maxCR 1 and writes no state', async () => {
      setupBaseMocks({ allies: [], saveResult: { success: false, roll: 5, total: 6 } });
      const action = makeAction({ polymorphTarget: targetName });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'polymorph_select',
          targetName,
          maxCR: 1,
          casterName,
          campaignName,
          spell: action.spell,
          spellLevel: 4,
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled(); // application is service lane #1937
    });

    it('caps beast selection at a PC target level from metaCtx.characters', async () => {
      setupBaseMocks({ allies: [], saveResult: { success: false, roll: 5, total: 6 } });

      const result = await handle(
        makeAction({ polymorphTarget: targetName, characters: [{ name: targetName, computedStats: { level: 7 } }] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.maxCR).toBe(7);
    });

    it('caps beast selection at a monster target CR (fractional)', async () => {
      setupBaseMocks({ allies: [], saveResult: { success: false, roll: 5, total: 6 } });
      getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '1/2' });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.maxCR).toBe(0.5);
      expect(getMonsterData).toHaveBeenCalledWith(targetName, null);
    });
  });

  describe('log-write resilience (every addEntry site has .catch)', () => {
    it.each([
      [
        'already-polymorphed gate',
        () => setupBaseMocks({ existingEffects: [{ target: targetName, effect: 'polymorph', source: casterName }] }),
        'automation_info',
      ],
      [
        '0 hp gate',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ ...baseCreature, currentHp: 0 }, casterCreature] });
        },
        'automation_info',
      ],
      [
        'shapechanger gate',
        () => {
          setupBaseMocks();
          getCombatContext.mockResolvedValue({ creatures: [{ ...baseCreature, traits: [{ name: 'Shapechanger' }] }, casterCreature] });
        },
        'automation_info',
      ],
      [
        'enemy save-fail flow',
        () => setupBaseMocks({ allies: [], saveResult: { success: false, roll: 5, total: 6 } }),
        'polymorph_select',
      ],
      [
        'enemy save-success flow',
        () => setupBaseMocks({ allies: [], saveResult: { success: true, roll: 15, total: 20 } }),
        'automation_info',
      ],
    ])('still returns the %s popup when every addEntry rejects', async (_label, setup, expectedType) => {
      setup();
      addEntry.mockRejectedValue(new Error('log write failed'));

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe(expectedType);
    });
  });
});

describe('polymorphHandler.resolvePolymorphMaxCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['PC via computedStats.level', targetName, [{ name: targetName, computedStats: { level: 7 } }], null, 7],
    ['PC via top-level level fallback', targetName, [{ name: targetName, level: 5 }], null, 5],
    ['PC via exact multiword name', 'Goblin the Brave', [{ name: 'Goblin the Brave', computedStats: { level: 9 } }], null, 9],
    ['non-number PC level skipped, falls through to monster CR', targetName, [{ name: targetName, computedStats: { level: 'invalid' } }], { challenge_rating: 2 }, 2],
    ['PC level 0 treated as missing, no monster → default', targetName, [{ name: targetName, computedStats: { level: 0 } }], null, 1],
    ['monster integer CR', targetName, [], { challenge_rating: 3 }, 3],
    ['monster fractional CR string', targetName, [], { challenge_rating: '1/2' }, 0.5],
    ['monster empty-string CR → default', targetName, [], { challenge_rating: '' }, 1],
    ['custom NPC without bestiary data → default CR 1', targetName, [], null, 1],
  ])('%s', async (_label, target, characters, monsterData, expected) => {
    getMonsterData.mockResolvedValue(monsterData);

    expect(await resolvePolymorphMaxCR(target, campaignName, characters)).toBe(expected);
  });
});
