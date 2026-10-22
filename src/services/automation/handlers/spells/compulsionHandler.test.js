// @maintained-by-ai
// compulsionHandler lane — canonical home for Compulsion (SP-027): WIS save-or-suck charm,
// concentration, direction-pull prose. Single-target handler; no clock — the charm latch and
// addExpiration ride the turn seams (new initiative / rests clear them), the spell's
// "repeat the save" text is GM-adjudicated downstream (useInitiativeEffects.js 'Compulsion'→
// 'compulsion' concentration clearing, own lane, concentrationClearing2.test.js).
//
// Caller liveness (grep-verified 2026-10-16): automation/index.js:219 imports this handle and
// :548 registers `compulsion: handleCompulsion` in HANDLER_MAP — executeHandler(:702) dynamic
// dispatch on automation.type is the live production lane. Producer census #1348 (2026-10-22):
// the previously-cited in-repo producer compulsionService.triggerCompulsion was a DEAD export
// (its 'live producer' claim here was STALE) and has been DELETED along with its compulsion
// Trigger.test.js twin — it double-fetched getCombatContext and stamped app-fabricated
// automation.advantage (disk prose grants none; straight WIS save, auto-succeed-only if the
// target can't be charmed). No in-repo producer of a type-'compulsion' envelope remains; this
// handle stays registry-live and dispatch-reachable if an envelope ever arrives, so the
// automation.advantage transport pins below stand as handler-contract pins.
// Honest seam note: the REAL spell rows (public/data/spells.json, 2024/spells.json) carry NO
// automation.type (mirrored in triggerSpells.test.js:124), so the live sheet cast runs
// spellGates.gateCompulsion (:726/:840) → pendingCompulsion → handleCompulsionConfirm →
// applyCompulsionEffect — that multi-target confirm lane NEVER enters this file
// (pinned in compulsionEffect.test.js / confirm-payloads.test.js). docs/automations-manifest.json
// SP-027 lists stale spellHandler/spellRouter paths; the registry line above is current truth.
//
// Distinctness vs siblings (split recorded with compelledDuel #24): compelledDuel owns the
// compelled_duel targetEffect lane; charm pair #1884/#1885 canon covers charmSpellUtils internals
// only. UNIQUE here: per-creature activeConditions 'charmed' write (dedup + case-fold + preserve),
// rollType 'save-compulsion' logs, rollNpcCompulsionSave (creature positional passthrough +
// no-creature fallback: bare d20, bonus 0, advantage keeps HIGH, >= dc boundary) and
// dispatchSaveResult (sendSaveResult payload + window 'save-result' CustomEvent detail).
// Heightened (metaCtx.metamagicHeighten) transports prompt disadvantage ONLY — the NPC auto-roll
// leg consumes saveAdvantage alone (disadvantage=false positional); asymmetry pinned as-is.
// DC: buildSaveDc stubbed to 16 (≠ automation.saveDc 15) so every downstream pin proves the DC
// source. All four log-service .catch arms share the '[compulsion] Error:' prefix — each arm
// covered once below (ability_use, save_result success leg, condition, save_result failure leg).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

import { handle } from './compulsionHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

const campaignName = 'test-campaign';
// 16 ≠ automation.saveDc 15 → pins that DC flows from buildSaveDc, not the action row.
const DC = 16;

function makePlayerStats(overrides = {}) {
  // handle() consumes only playerStats.name (buildSaveDc is stubbed).
  return { name: 'TestCaster', ...overrides };
}

// MERGE-style helper: automation overrides splice into the base automation; top-level
// overrides (metaCtx, name) land on the shell without replacing it.
function makeAction(overrides = {}) {
  const { automation: automationOverrides, ...rest } = overrides;
  return {
    name: 'Compulsion',
    automation: { type: 'compulsion', saveType: 'WIS', saveDc: 15, ...automationOverrides },
    ...rest,
  };
}

function setupBaseMocks(saveResult = { success: true }, isNpc = false) {
  resolveTarget.mockResolvedValue({
    target: { name: 'Goblin', type: isNpc ? 'npc' : 'player' },
    cs: {
      creatures: [
        { name: 'Goblin', type: isNpc ? 'npc' : 'player', saveBonuses: { WIS: 2 } },
      ],
    },
  });
  buildSaveDc.mockReturnValue(DC);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('compulsionHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('cast seam (exact keys)', () => {
    it('registers spell-last-attack rollback before target resolution, DC from buildSaveDc', async () => {
      resolveTarget.mockResolvedValue(null);
      buildSaveDc.mockReturnValue(DC);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Compulsion',
        saveType: 'WIS',
        saveDc: DC,
        attackScope: 'single',
      });
    });

    it.each([{ resolved: null }, { resolved: { target: null } }, { resolved: { target: {} } }])(
      'nameless target ($resolved): no-effect popup, no prompt, no logs — rollback still stored',
      async ({ resolved }) => {
        resolveTarget.mockResolvedValue(resolved);
        buildSaveDc.mockReturnValue(DC);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result).toEqual({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Compulsion',
            description: 'No target selected. Compulsion has no effect.',
          },
        });
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
      },
    );

    it('resolves target by campaign+caster only — mapName param is inert', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, 'some-map');

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });

    it.each([
      { label: 'automation present', action: makeAction() },
      { label: 'automation missing', action: { name: 'Compulsion' } },
    ])('buildSaveDc receives the automation object ($label)', async ({ action }) => {
      setupBaseMocks();

      await handle(action, makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation || {}, expect.objectContaining({ name: 'TestCaster' }));
    });

    it('opens WIS save prompt with exact args (attackerName, dcSuccess none, condition charmed)', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        attackerName: 'TestCaster',
        saveType: 'WIS',
        saveDc: DC,
        dcSuccess: 'none',
        advantage: false,
        disadvantage: false,
        condition: 'charmed',
      });
    });

    it('transports automation.advantage and metaCtx.metamagicHeighten to the prompt', async () => {
      setupBaseMocks();

      await handle(makeAction({ automation: { advantage: true } }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({
        advantage: true,
        disadvantage: false,
      }));

      await handle(makeAction({ metaCtx: { metamagicHeighten: true } }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({
        advantage: false,
        disadvantage: true,
      }));
    });

    it.each([
      { advantage: false, desc: 'TestCaster casts Compulsion on Goblin! Goblin must make a WIS save (DC 16) or become Charmed.' },
      { advantage: true, desc: 'TestCaster casts Compulsion on Goblin! Goblin must make a WIS save (DC 16) with Advantage or become Charmed.' },
    ])('casts log full string (advantage: $advantage)', async ({ advantage, desc }) => {
      setupBaseMocks();

      await handle(makeAction({ automation: { advantage } }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Compulsion',
        description: desc,
        promptId: 'test-prompt-id',
      });
    });

    it('custom caster/spell names transport (popup description hardcodes "Compulsion")', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction({ name: 'My Compulsion' }), makePlayerStats({ name: 'WizardX' }), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        casterName: 'WizardX',
        spellName: 'My Compulsion',
      }));
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'My Compulsion',
          description: 'Goblin succeeded on WIS save against Compulsion.',
        },
      });
    });
  });

  describe('NPC auto-save (own dispatchSaveResult/rollNpcCompulsionSave lane)', () => {
    it('creature in combat summary: positional rollSaveForCreature passthrough, exact sendSaveResult payload and CustomEvent detail', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } },
        'WIS', DC, false, false,
      );
      expect(rollSaveForCreature).toHaveBeenCalledTimes(1);
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', {
        promptId: 'test-prompt-id',
        success: false,
        roll: 8,
        total: 10,
        saveBonus: 2,
        rawRolls: [8, 12],
      });
      const [event] = dispatchEventSpy.mock.calls[0];
      expect(event.type).toBe('save-result');
      expect(event.detail).toEqual({
        promptId: 'test-prompt-id',
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: DC,
        success: false,
        roll: 8,
        total: 10,
        saveBonus: 2,
        rawRolls: [8, 12],
      });
      dispatchEventSpy.mockRestore();
    });

    it('automation.advantage reaches the NPC roll as the 5th positional (disadvantage stays false)', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12, 5] });

      await handle(makeAction({ automation: { advantage: true } }), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'WIS', DC, false, true,
      );
    });

    // No-creature fallback: bare d20, bonus 0, advantage keeps HIGH, >= dc boundary.
    // Dice [8,16] make the two legs distinguishable (8 < 16 fail vs 16 = DC success).
    it.each([
      { label: 'plain keeps r1', advantage: false, roll: 8, success: false },
      { label: 'advantage keeps high (>= dc)', advantage: true, roll: 16, success: true },
    ])('fallback roll when creature missing from summary ($label)', async ({ advantage, roll, success }) => {
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc' }, cs: { creatures: [] } });
      buildSaveDc.mockReturnValue(DC);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success }),
      });
      rollD20.mockReturnValueOnce(8).mockReturnValueOnce(16);

      await handle(makeAction({ automation: { advantage } }), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).not.toHaveBeenCalled();
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', {
        promptId: 'test-prompt-id',
        success,
        roll,
        total: roll,
        saveBonus: 0,
        rawRolls: [8, 16],
      });
    });
  });

  describe('successful save', () => {
    it('reports success via addTargetResult, transports roll/total, defaults missing to 0', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 17 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 12,
        total: 17,
        conditions: [],
        appliedDamage: 0,
      });

      // Second cast with no roll metadata: ?? 0 defaults pin the rollback ledger shape.
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('logs save_result success and returns popup with exact strings; zero runtime writes', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-compulsion',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Compulsion.',
      });
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Compulsion',
          description: 'Goblin succeeded on WIS save against Compulsion.',
        },
      });
      // Success ledger: exactly cast + save logs, no condition entry, no charm writes.
      expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['ability_use', 'save_result']);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('failed save — charm latch (own composition)', () => {
    it('writes charmed + expiration + full logs + popup strings', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7 });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 7,
        conditions: ['charmed'],
        appliedDamage: 0,
      });
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [{ type: 'charmed', condition: 'charmed' }],
        campaignName,
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Compulsion spell',
        note: 'Goblin is Charmed by TestCaster. As a bonus action on each of its turns, Goblin must use its movement to travel to the nearest space that is furthest away from TestCaster.',
        timestamp: expect.any(Number),
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-compulsion',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'WIS',
        success: false,
        description: 'Goblin failed WIS save against Compulsion and is Charmed.',
      });
      // Popup head diverges from the condition note head — full strings keep both honest.
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Compulsion',
          description: 'Goblin failed WIS save and is Charmed by Compulsion. As a bonus action on each of its turns, Goblin must use its movement to travel to the nearest space that is furthest away from TestCaster.',
        },
      });
      expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['ability_use', 'condition', 'save_result']);

      // Failure-leg ?? 0 defaults (distinct code line from the success leg).
      setupBaseMocks({ success: false });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['charmed'],
      }));
    });

    it.each([
      { label: 'dedupes lowercase', stored: ['charmed'], expected: ['charmed'] },
      { label: 'case-folds CHARMED, preserves others', stored: ['CHARMED', 'frightened'], expected: ['frightened', 'charmed'] },
      { label: 'appends, preserving others', stored: ['frightened'], expected: ['frightened', 'charmed'] },
      { label: 'null store → lone charmed', stored: null, expected: ['charmed'] },
      { label: 'non-array store → lone charmed', stored: 'not-an-array', expected: ['charmed'] },
    ])('activeConditions write ($label)', async ({ stored, expected }) => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(stored);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expected, campaignName);
    });
  });

  describe('error handling (all four .catch arms, shared prefix)', () => {
    it('ability_use cast-log rejection is caught and logged once; cast proceeds to save', async () => {
      setupBaseMocks({ success: true });
      addEntry.mockRejectedValueOnce(new Error('log error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('[compulsion] Error:', expect.any(Error));
      });
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toBe('Goblin succeeded on WIS save against Compulsion.');
      consoleSpy.mockRestore();
    });

    it.each([
      { leg: 'save_result', success: true, latch: false },
      { leg: 'condition', success: false, latch: true },
      { leg: 'save_result', success: false, latch: true },
    ])('$leg rejection on $success leg is caught; latch and popup intact', async ({ leg, success, latch }) => {
      setupBaseMocks({ success });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation((campaign, entry) => (
        entry.type === leg ? Promise.reject(new Error('log error')) : Promise.resolve()
      ));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledTimes(1);
      });
      expect(consoleSpy).toHaveBeenCalledWith('[compulsion] Error:', expect.any(Error));
      expect(setRuntimeValue).toHaveBeenCalledTimes(latch ? 1 : 0);
      expect(result.type).toBe('popup');
      consoleSpy.mockRestore();
    });
  });
});
