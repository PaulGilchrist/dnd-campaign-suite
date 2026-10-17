// @maintained-by-ai
/**
 * hypnoticPatternShake.test.js — shake-it-free lane (SECOND of the hypnoticPattern PAIR,
 * per the #1925 seam map in hypnoticPatternHandler.test.js).
 *
 * Subject: the SEPARATE module hypnoticPatternShake.js — handle() + handleConfirm(),
 * registered in services/automation/index.js:573-574 as hypnotic_pattern_shake /
 * hypnotic_pattern_shake_confirm.
 *
 * YOU (this file) own:
 * - shake action press: handle() target selection (hypno-preference, range filter,
 *   modalName 'hypnoticPatternShake'), range/featureName parsing, payload tables.
 * - confirm flow + trio REMOVAL writes: we are the remover (main lane #1925 is the
 *   trio producer and stays closed here — cast resolution, concentration, rollback
 *   ledger are NOT re-absorbed). Retained arrays pinned exactly, in the producer's
 *   append order ([...filtered, 'charmed','incapacitated','speed_zero'] from
 *   hypnoticPatternHandler.js:27 — string array, so shake's String(c) filter matches).
 * - refusal paths: target not hypnotized → no setRuntimeValue write.
 * - log composition: condition-removal entries + ability_use, full-string pins.
 *
 * Production liveness (grepped 2026-10-16, incl. dynamic dispatch):
 * - handle(): LIVE — char-sheet row → executeHandler → HANDLER_MAP (index.js:573) →
 *   useCharActionsAutomation.js:352 routes the modal → HypnoticPatternShakeModal
 *   (CharActionModals.SecondaryModals.jsx:480).
 * - handleConfirm(): REGISTERED (index.js:574) but no UI code dispatches
 *   'hypnotic_pattern_shake_confirm' — no construction site exists app-wide, and
 *   HypnoticPatternShakeModal.handleShake re-runs handle() and logs the ability_use
 *   itself without removing the trio (the known §70 "shake awake" advisory residual,
 *   corroborated by the GM-enforced note in hooks/combat/saveProcessing.js:865).
 *   Registered-contract coverage retained below; UI gap reported, not deleted.
 * - Wake-on-damage break lives in service/applyDamage lanes
 *   (breakHypnoticPatternOnDamage) — note only, not tested here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handle, handleConfirm } from './hypnoticPatternShake.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', ...overrides };
}

// makeAction MERGES overrides onto the defaults (intentional — lane convention).
const DEFAULT_AUTOMATION = { type: 'hypnotic_pattern_shake', range: '5 ft' };

function makeAction(automation = {}, name = 'Shake Out Stupor') {
  return {
    name,
    automation: { ...DEFAULT_AUTOMATION, ...automation },
  };
}

// handle()/handleConfirm() consume ONLY combatSummary.creatures — players/placedItems
// on the summary are inert for this module, so fixtures stay creatures-only.
function ctxOf(creatures) {
  return { creatures };
}

const CASTER = { name: 'TestCaster', gridX: 5, gridY: 10 };

function baseCtx() {
  return ctxOf([
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    CASTER,
  ]);
}

function playerCtx(allyName = 'AllyPlayer') {
  return ctxOf([
    { name: allyName, type: 'player' },
    CASTER,
  ]);
}

function monsterCtx(mName = 'Goblin') {
  return ctxOf([{ name: mName, type: 'monster' }, CASTER]);
}

function mockNoMap() {
  getCombatContext.mockResolvedValue(baseCtx());
  resolveMapPositions.mockResolvedValue(null);
}

// Strict payload tables: exact-key pins over the own-composed modal/popup shapes.
// extra MERGES onto the defaults (same convention as makeAction).
function expectShakeModal(result, extra = {}) {
  expect(result.type).toBe('modal');
  expect(result.modalName).toBe('hypnoticPatternShake');
  expect(result.payload).toEqual({
    attackerName: 'TestCaster',
    campaignName,
    targets: ['Goblin', 'Orc'],
    rangeFeet: 5,
    featureName: 'Shake Out Stupor',
    automation: DEFAULT_AUTOMATION,
    ...extra,
  });
}

function expectShakePopup(result, description, extra = {}) {
  expect(result.type).toBe('popup');
  expect(result.payload).toEqual({
    type: 'automation_info',
    name: 'Shake Out Stupor',
    description,
    ...extra,
  });
}

// Confirm popups carry NO automation key (distinct from handle() popups) — honest pin.
function expectConfirmPopup(result, targetName) {
  expect(result.type).toBe('popup');
  expect(result.payload).toEqual({
    type: 'automation_info',
    name: 'Shake Out Stupor',
    description: `${targetName} is no longer affected by Hypnotic Pattern.`,
  });
}

const conditionRemovedEntry = (characterName, condition) => ({
  type: 'condition',
  action: 'removed',
  characterName,
  condition,
  reason: 'Shake Out Stupor (Hypnotic Pattern)',
  timestamp: expect.any(Number),
});

const abilityUseEntry = (targetName) => ({
  type: 'ability_use',
  characterName: 'TestCaster',
  abilityName: 'Shake Out Stupor',
  description: `TestCaster used an action to shake ${targetName} out of its hypnotic stupor.`,
  targetName,
  timestamp: expect.any(Number),
});

const loggedEntries = () => addEntry.mock.calls.map(call => call[1]);

describe('hypnoticPatternShake', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('handle — shake action press', () => {
    describe('combat context validation', () => {
      it('returns exact automation_info popup when no combat context exists', async () => {
        getCombatContext.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectShakePopup(result, 'No combat context found.', { automation: DEFAULT_AUTOMATION });
      });

      it('returns no-eligible-targets popup when combat context has no creatures', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectShakePopup(result, 'No eligible targets within range.', { automation: DEFAULT_AUTOMATION });
      });

      it('does not resolve map positions when no map is supplied', async () => {
        getCombatContext.mockResolvedValue(baseCtx());
        await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(resolveMapPositions).not.toHaveBeenCalled();
      });
    });

    describe('target selection — no map', () => {
      it('skips caster and returns all other creatures with exact modal payload', async () => {
        mockNoMap();
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectShakeModal(result, { targets: ['Goblin', 'Orc'] });
      });

      it('returns no-eligible-targets popup when only caster exists', async () => {
        getCombatContext.mockResolvedValue(ctxOf([CASTER]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectShakePopup(result, 'No eligible targets within range.', { automation: DEFAULT_AUTOMATION });
      });

      it('prefers hypno-targets (charmed) over eligible targets', async () => {
        getCombatContext.mockResolvedValue(ctxOf([
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'charmed' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          CASTER,
        ]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectShakeModal(result, { targets: ['Goblin'] });
        // Monster hypno-detection reads c.conditions, never the runtime store.
        expect(getRuntimeValue).not.toHaveBeenCalled();
      });

      it('falls back to eligible targets when no hypno-targets exist', async () => {
        getCombatContext.mockResolvedValue(ctxOf([
          { name: 'Goblin', type: 'monster', conditions: [] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          CASTER,
        ]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectShakeModal(result, { targets: ['Goblin', 'Orc'] });
      });
    });

    describe('target selection — with map', () => {
      it('resolves positions for the caster with exact args', async () => {
        getCombatContext.mockResolvedValue(baseCtx());
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });
        await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expect(resolveMapPositions).toHaveBeenCalledTimes(1);
        expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestCaster');
      });

      it('range-filters every non-caster creature through isWithinRange at parsed feet', async () => {
        getCombatContext.mockResolvedValue(baseCtx());
        isWithinRange.mockImplementation(async (_, target) => target === 'Goblin');
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expect(isWithinRange.mock.calls.map(c => [c[0], c[1], c[2]])).toEqual([
          ['TestCaster', 'Goblin', 5],
          ['TestCaster', 'Orc', 5],
        ]);
        expectShakeModal(result, { targets: ['Goblin'] });
      });

      it('keeps every creature when all are in range', async () => {
        getCombatContext.mockResolvedValue(baseCtx());
        isWithinRange.mockResolvedValue(true);
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expectShakeModal(result, { targets: ['Goblin', 'Orc'] });
      });

      it('hypno-targets bypass the range filter (production quirk)', async () => {
        getCombatContext.mockResolvedValue(ctxOf([
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'charmed' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'incapacitated' }] },
          CASTER,
        ]));
        // Nothing is in range — yet both hypnotized creatures still surface: the hypno
        // filter runs over ALL creatures without a range check (even though the modal
        // copy tells the player the target "must be within 5 feet"). Honest pin.
        isWithinRange.mockResolvedValue(false);
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expectShakeModal(result, { targets: ['Goblin', 'Orc'] });
      });

      it('returns no-eligible-targets popup when nothing is in range and none are hypnotized', async () => {
        getCombatContext.mockResolvedValue(baseCtx());
        isWithinRange.mockResolvedValue(false);
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expectShakePopup(result, 'No eligible targets within range.', { automation: DEFAULT_AUTOMATION });
      });
    });

    describe('range and featureName parsing', () => {
      it('parses rangeFeet from the automation string and feeds it to isWithinRange', async () => {
        getCombatContext.mockResolvedValue(baseCtx());
        isWithinRange.mockResolvedValue(true);
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });
        const result = await handle(makeAction({ range: '10 ft' }), makePlayerStats(), campaignName, mapName);
        expectShakeModal(result, {
          targets: ['Goblin', 'Orc'],
          rangeFeet: 10,
          automation: { type: 'hypnotic_pattern_shake', range: '10 ft' },
        });
        expect(isWithinRange).toHaveBeenCalledWith('TestCaster', 'Goblin', 10);
      });

      it('defaults rangeFeet to 5 when automation has no range', async () => {
        getCombatContext.mockResolvedValue(baseCtx());
        const action = { name: 'Shake Out Stupor', automation: { type: 'hypnotic_pattern_shake' } };
        const result = await handle(action, makePlayerStats(), campaignName, null);
        expect(result.payload.rangeFeet).toBe(5);
      });

      it('uses action.name as featureName', async () => {
        mockNoMap();
        const result = await handle(makeAction({}, 'Custom Shake'), makePlayerStats(), campaignName, null);
        expect(result.payload.featureName).toBe('Custom Shake');
      });

      it('defaults featureName to Shake Out Stupor when action has no name', async () => {
        mockNoMap();
        const result = await handle({ automation: DEFAULT_AUTOMATION }, makePlayerStats(), campaignName, null);
        expect(result.payload.featureName).toBe('Shake Out Stupor');
      });
    });

    describe('hypno-target detection — player creatures (runtime store)', () => {
      const playerAllyCtx = () => ctxOf([
        { name: 'AllyPlayer', type: 'player' },
        { name: 'Orc', type: 'monster' },
        CASTER,
      ]);

      it('selects a charmed player and pins the exact store key', async () => {
        getCombatContext.mockResolvedValue(playerAllyCtx());
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['charmed']);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(getRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', campaignName);
        expect(result.payload.targets).toEqual(['AllyPlayer']);
      });

      it('selects a player with incapacitated', async () => {
        getCombatContext.mockResolvedValue(playerAllyCtx());
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['incapacitated', 'poisoned']);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['AllyPlayer']);
      });

      it('does not hypno-select a player without charmed/incapacitated (falls back to eligible)', async () => {
        getCombatContext.mockResolvedValue(playerAllyCtx());
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['AllyPlayer', 'Orc']);
      });
    });

    describe('hypno-target detection — monster creatures (conditions array)', () => {
      const monsterBase = (conditions) => ctxOf([
        { name: 'Goblin', type: 'monster', conditions },
        { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
        CASTER,
      ]);

      it('identifies monsters with charmed condition from conditions array', async () => {
        getCombatContext.mockResolvedValue(monsterBase([{ key: 'charmed' }]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('identifies monsters with incapacitated condition from conditions array', async () => {
        getCombatContext.mockResolvedValue(monsterBase([{ key: 'incapacitated' }]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('handles case-insensitive condition matching', async () => {
        getCombatContext.mockResolvedValue(ctxOf([
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'CHARMED' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'Incapacitated' }] },
          CASTER,
        ]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });

      it('string conditions do not match because the monster branch reads cond.key', async () => {
        getCombatContext.mockResolvedValue(monsterBase(['charmed']));
        resolveMapPositions.mockResolvedValue(null);
        // String(undefined).toLowerCase() === 'undefined' → no hypno match →
        // fallback to eligible lists both creatures. Honest quirk pin.
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });
    });
  });

  describe('handleConfirm — trio removal (WE are the remover)', () => {
    const confirm = (target) =>
      handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, target);

    describe('trio removal writes — exact retained-array pins', () => {
      it('player: drops the full producer-written trio, retains others in order', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        // Producer append order from hypnoticPatternHandler.js:27
        // ([...filtered, 'charmed', 'incapacitated', 'speed_zero']).
        getRuntimeValue.mockReturnValue(['poisoned', 'charmed', 'incapacitated', 'speed_zero']);
        const result = await confirm('AllyPlayer');
        expect(getRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', campaignName);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', ['poisoned'], campaignName);
        expectConfirmPopup(result, 'AllyPlayer');
      });

      it('monster: drops the full producer-written trio, retains others in order', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['poisoned', 'charmed', 'incapacitated', 'speed_zero']);
        const result = await confirm('Goblin');
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['poisoned'], campaignName);
        expectConfirmPopup(result, 'Goblin');
      });

      it('player: partial trio removal retains others exactly', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['poisoned', 'charmed']);
        const result = await confirm('AllyPlayer');
        expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', ['poisoned'], campaignName);
        expectConfirmPopup(result, 'AllyPlayer');
      });

      it('monster: partial trio removal retains others exactly', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['poisoned', 'charmed']);
        const result = await confirm('Goblin');
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['poisoned'], campaignName);
        expectConfirmPopup(result, 'Goblin');
      });

      it('write goes only to the confirmed target, never the caster', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed']);
        await confirm('AllyPlayer');
        const writeTargets = setRuntimeValue.mock.calls.map(c => c[0]);
        expect(writeTargets).toEqual(['AllyPlayer']);
      });
    });

    describe('refusal paths — target not hypnotized (no-side-effect guards)', () => {
      it('player: no write and no condition log when no trio condition present', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);
        const result = await confirm('AllyPlayer');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.filter(c => c[1]?.type === 'condition')).toEqual([]);
        // The ability_use still logs and the popup still reports success.
        expect(loggedEntries()).toEqual([abilityUseEntry('AllyPlayer')]);
        expectConfirmPopup(result, 'AllyPlayer');
      });

      it('monster: no write and no condition log when no trio condition present', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);
        const result = await confirm('Goblin');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.filter(c => c[1]?.type === 'condition')).toEqual([]);
        expectConfirmPopup(result, 'Goblin');
      });

      it('handles empty conditions array without writing', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue([]);
        const result = await confirm('AllyPlayer');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expectConfirmPopup(result, 'AllyPlayer');
      });

      it('handles null conditions store value without writing', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(null);
        const result = await confirm('AllyPlayer');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expectConfirmPopup(result, 'AllyPlayer');
      });

      it('target absent from combat context: popup only — no store read, no write', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        const result = await confirm('NonExistent');
        expect(getRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expectConfirmPopup(result, 'NonExistent');
      });

      it('missing combat context (null): popup only', async () => {
        getCombatContext.mockResolvedValue(null);
        const result = await confirm('Goblin');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expectConfirmPopup(result, 'Goblin');
      });

      it('combat context without creatures: popup only', async () => {
        getCombatContext.mockResolvedValue({});
        const result = await confirm('Goblin');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expectConfirmPopup(result, 'Goblin');
      });

      it('null targetName returns null before touching any collaborator', async () => {
        expect(await confirm(null)).toBeNull();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });

      it('empty-string targetName returns null before touching any collaborator', async () => {
        expect(await confirm('')).toBeNull();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });
    });

    describe('log composition — strict entry tables', () => {
      it('player full removal: exactly three condition logs (charmed, incapacitated, speed_zero) then ability_use', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero', 'poisoned']);
        await confirm('AllyPlayer');
        // Player-path quirk, pinned honestly: shakeOutPlayer logs ALL three trio
        // conditions absent from the retained array, regardless of which were present.
        expect(loggedEntries()).toEqual([
          conditionRemovedEntry('AllyPlayer', 'Charmed'),
          conditionRemovedEntry('AllyPlayer', 'Incapacitated'),
          conditionRemovedEntry('AllyPlayer', 'Speed_zero'),
          abilityUseEntry('AllyPlayer'),
        ]);
      });

      it('player partial trio logs all three removals even though only charmed was present', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'poisoned']);
        await confirm('AllyPlayer');
        expect(loggedEntries().filter(e => e.type === 'condition').map(e => e.condition))
          .toEqual(['Charmed', 'Incapacitated', 'Speed_zero']);
      });

      it('monster full removal logs only Charmed and Incapacitated — speed_zero is never logged', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);
        await confirm('Goblin');
        // Monster-path divergence from the player path: shakeOutCreature logs only
        // conditions actually present, and speed_zero has no monster log branch.
        expect(loggedEntries()).toEqual([
          conditionRemovedEntry('Goblin', 'Charmed'),
          conditionRemovedEntry('Goblin', 'Incapacitated'),
          abilityUseEntry('Goblin'),
        ]);
      });

      it('monster with only charmed present logs exactly one condition removal', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['poisoned', 'charmed']);
        await confirm('Goblin');
        expect(loggedEntries().filter(e => e.type === 'condition'))
          .toEqual([conditionRemovedEntry('Goblin', 'Charmed')]);
      });

      it('ability_use entry is full-string own-composition for the player lane', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed']);
        await confirm('AllyPlayer');
        const ability = loggedEntries().find(e => e.type === 'ability_use');
        expect(ability).toEqual({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Shake Out Stupor',
          description: 'TestCaster used an action to shake AllyPlayer out of its hypnotic stupor.',
          targetName: 'AllyPlayer',
          timestamp: expect.any(Number),
        });
      });

      it('ability name and popup name are hardcoded regardless of action.name (quirk pin)', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['charmed']);
        const result = await handleConfirm(
          makeAction({}, 'Custom Shake'), makePlayerStats(), campaignName, mapName, 'Goblin',
        );
        // handle() honours action.name, but handleConfirm() hardcodes both literals —
        // honest pin of the divergence.
        const ability = loggedEntries().find(e => e.type === 'ability_use');
        expect(ability.abilityName).toBe('Shake Out Stupor');
        expect(result.payload.name).toBe('Shake Out Stupor');
      });

      it('absent-target lane still logs exactly the ability_use entry', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        await confirm('NonExistent');
        expect(loggedEntries()).toEqual([abilityUseEntry('NonExistent')]);
      });
    });

    describe('addEntry rejections — caught, logged, flow intact', () => {
      it('player path: rejected condition log is caught; write and popup unaffected', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);
        addEntry.mockRejectedValueOnce(new Error('log failure'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await confirm('AllyPlayer');
        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', [], campaignName);
        expect(errSpy).toHaveBeenCalledWith('[hypnoticPatternShake] Error:', expect.any(Error));
        errSpy.mockRestore();
      });

      it('monster path: rejected first log is caught; write and popup unaffected', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);
        addEntry.mockRejectedValueOnce(new Error('log failure'));
        const result = await confirm('Goblin');
        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], campaignName);
      });

      it('ability_use rejection (only entry when nothing was hypnotized) is caught', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['frightened']);
        addEntry.mockRejectedValueOnce(new Error('log failure'));
        const result = await confirm('Goblin');
        expect(result.type).toBe('popup');
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
    });
  });
});
