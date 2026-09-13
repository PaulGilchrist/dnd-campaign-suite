import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget, findDomination } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import storage from '../../ui/storage.js';
import { rollD20 } from '../../dice/diceRoller.js';

// ── Mocks (mirrors applyDamage.npcConcentrationAdvanced.test.js shape) ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001'), getName: vi.fn((n) => String(n).toLowerCase()) } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'npc',
    maxHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createCasterCharacter(name, saveDc) {
  return {
    name,
    level: 20,
    spellAbilities: { saveDc },
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
      spellAbilities: { saveDc },
    },
  };
}

const DOMINATED_EXPIRATIONS = [
  { target: 'Thug 1', effects: [{ type: 'dominated', condition: 'charmed' }], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: null },
];

function stubRuntime(conditions, expirations) {
  getRuntimeValue.mockReset();
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'activeConditions') return conditions;
    if (key === 'pendingExpirations') return expirations;
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return 32;
    if (key === 'hitPoints') return 32;
    if (key === 'targetEffects') return [];
    if (key === 'tempHp') return 0;
    return undefined;
  });
}

function dominatedSetup() {
  const caster = createNpcCreature('DivinationWizard', 70, 70, {
    type: 'player',
    concentration: { id: 'c1', spell: 'Dominate Person', dc: 10, target: null },
  });
  const thug = createNpcCreature('Thug 1', 32, 32);
  const cs = makeCombatSummary([caster, thug]);
  stubRuntime(['charmed'], DOMINATED_EXPIRATIONS);
  return { caster, thug, cs };
}

// ── Tests ───────────────────────────────────────────────────────

describe('SP-037: Dominate Person repeat WIS save on damage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
    global.fetch.mockImplementation(() => new Promise(() => {}));
  });

  describe('findDomination gate', () => {
    it('identifies a charmed target dominated by a caster concentrating on Dominate Person', () => {
      const { cs } = dominatedSetup();
      expect(findDomination('Thug 1', cs, 'TestCampaign')).toEqual({ casterName: 'DivinationWizard', spellName: 'Dominate Person' });
    });

    it('does NOT match a charmed target with no dominate concentration', () => {
      const caster = createNpcCreature('HexWarlock', 50, 50, { type: 'player' });
      const thug = createNpcCreature('Thug 1', 32, 32);
      const cs = makeCombatSummary([caster, thug]);
      stubRuntime(['charmed'], [{ target: 'Thug 1', effects: [{ type: 'charmed', condition: 'charmed' }] }]);
      expect(findDomination('Thug 1', cs, 'TestCampaign')).toBeNull();
    });

    it('does NOT match when the caster is concentrating on a non-dominate spell', () => {
      const caster = createNpcCreature('DivinationWizard', 70, 70, { type: 'player', concentration: { spell: 'Haste', dc: 10 } });
      const thug = createNpcCreature('Thug 1', 32, 32);
      const cs = makeCombatSummary([caster, thug]);
      stubRuntime(['charmed'], DOMINATED_EXPIRATIONS);
      expect(findDomination('Thug 1', cs, 'TestCampaign')).toBeNull();
    });
  });

  describe('NPC dominated target (auto-roll)', () => {
    it('on failed save: charmed is retained, a WIS roll is logged vs caster DC, generic charm-strip does not fire', async () => {
      const { caster, cs } = dominatedSetup();
      rollD20.mockReturnValue(1);

      const result = await applyDamageToTarget(cs, 'Thug 1', 19, ['Fire'], { campaignName: 'TestCampaign', characters: [createCasterCharacter('DivinationWizard', 17)] });

      expect(result.newHp).toBe(13);
      expect(getRuntimeValue('Thug 1', 'activeConditions')).toEqual(['charmed']);
      // No unconditional charmed strip: no setRuntimeValue writing a charmed-filtered list
      const charmedStrips = setRuntimeValue.mock.calls.filter(call =>
        call[0] === 'Thug 1' && call[1] === 'activeConditions' && Array.isArray(call[2]) && !call[2].includes('charmed')
      );
      expect(charmedStrips.length).toBe(0);
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'roll',
        rollType: 'save',
        characterName: 'Thug 1',
        name: 'Dominate Person Repeat Save',
        saveType: 'WIS',
        saveDc: 17,
        saveResult: 'failure',
      }));
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'Thug 1',
        abilityName: 'Dominate Person',
      }));
      // No generic 'took damage' Charmed removal log
      const genericRemovals = addEntry.mock.calls
        .map(c => c[1])
        .filter(e => e && e.type === 'condition' && e.action === 'removed' && e.condition === 'Charmed');
      expect(genericRemovals.length).toBe(0);
      expect(caster.concentration).not.toBeNull();
    });

    it('on successful save: charmed + dominated removed, caster concentration cleared, spell ends with logs', async () => {
      const { caster, cs } = dominatedSetup();
      rollD20.mockReturnValue(17);

      const result = await applyDamageToTarget(cs, 'Thug 1', 19, ['Fire'], { campaignName: 'TestCampaign', characters: [createCasterCharacter('DivinationWizard', 17)] });

      expect(result.newHp).toBe(13);
      expect(caster.concentration).toBeNull();
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'TestCampaign');
      const charredKept = setRuntimeValue.mock.calls.find(call => call[0] === 'Thug 1' && call[1] === 'activeConditions');
      expect(charredKept).toBeTruthy();
      expect(charredKept[2]).not.toContain('charmed');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'roll',
        rollType: 'save',
        characterName: 'Thug 1',
        name: 'Dominate Person Repeat Save',
        saveType: 'WIS',
        saveDc: 17,
        saveResult: 'success',
      }));
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'condition',
        action: 'removed',
        characterName: 'Thug 1',
        condition: 'Charmed',
        reason: 'Dominate Person — spell ends on successful save against damage',
      }));
    });

    it('does not roll the repeat save when the caster save DC cannot be resolved', async () => {
      const caster = createNpcCreature('DivinationWizard', 70, 70, { type: 'player', concentration: { spell: 'Dominate Person', dc: null } });
      const thug = createNpcCreature('Thug 1', 32, 32);
      const cs = makeCombatSummary([caster, thug]);
      stubRuntime(['charmed'], DOMINATED_EXPIRATIONS);

      await applyDamageToTarget(cs, 'Thug 1', 19, ['Fire'], { campaignName: 'TestCampaign', characters: [] });

      expect(addEntry).not.toHaveBeenCalledWith('TestCampaign', expect.objectContaining({ name: 'Dominate Person Repeat Save' }));
    });
  });

  describe('PC dominated target (queued save prompt)', () => {
    it('queues a WIS save prompt on damage instead of stripping charmed, and keeps charmed on a failed prompt result', async () => {
      const caster = createNpcCreature('DivinationWizard', 70, 70, { type: 'player', concentration: { spell: 'Dominate Person', dc: 10 } });
      const pc = createNpcCreature('EvasiveFighter', 40, 40, { type: 'player', saveBonuses: { wis: 5 } });
      const cs = makeCombatSummary([caster, pc]);
      stubRuntime(['charmed'], [{ target: 'EvasiveFighter', effects: [{ type: 'dominated', condition: 'charmed' }], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: null }]);

      await applyDamageToTarget(cs, 'EvasiveFighter', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [createCasterCharacter('DivinationWizard', 17)] });

      // Repeat save queued through the existing generic save-prompt subsystem
      expect(sendSavePrompt).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        targetName: 'EvasiveFighter',
        saveType: 'WIS',
        saveDc: 17,
      }));
      // Charmed retained pre-resolution (no unconditional strip)
      const charredStrips = setRuntimeValue.mock.calls.filter(call =>
        call[0] === 'EvasiveFighter' && call[1] === 'activeConditions' && Array.isArray(call[2]) && !call[2].includes('charmed')
      );
      expect(charredStrips.length).toBe(0);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-001', success: false, roll: 2, total: 7, saveBonus: 5, saveType: 'WIS', saveDc: 17 },
      }));
      await new Promise(r => setTimeout(r, 10));

      expect(caster.concentration).not.toBeNull();
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'roll',
        rollType: 'save',
        characterName: 'EvasiveFighter',
        name: 'Dominate Person Repeat Save',
        saveResult: 'failure',
        saveDc: 17,
      }));
    });

    it('ends the domination when the PC save prompt resolves as a success', async () => {
      const caster = createNpcCreature('DivinationWizard', 70, 70, { type: 'player', concentration: { spell: 'Dominate Person', dc: 10 } });
      const pc = createNpcCreature('EvasiveFighter', 40, 40, { type: 'player', saveBonuses: { wis: 5 } });
      const cs = makeCombatSummary([caster, pc]);
      stubRuntime(['charmed'], [{ target: 'EvasiveFighter', effects: [{ type: 'dominated', condition: 'charmed' }], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: null }]);

      await applyDamageToTarget(cs, 'EvasiveFighter', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [createCasterCharacter('DivinationWizard', 17)] });

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-001', success: true, roll: 15, total: 20, saveBonus: 5, saveType: 'WIS', saveDc: 17 },
      }));
      await new Promise(r => setTimeout(r, 10));

      expect(caster.concentration).toBeNull();
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'TestCampaign');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'condition',
        action: 'removed',
        characterName: 'EvasiveFighter',
        condition: 'Charmed',
        reason: 'Dominate Person — spell ends on successful save against damage',
      }));
    });
  });

  describe('non-dominate charm regression guard', () => {
    it('still strips charmed unconditionally on damage for a NON-dominated charmed NPC', async () => {
      const caster = createNpcCreature('HexWarlock', 50, 50, { type: 'player' });
      const thug = createNpcCreature('Thug 1', 32, 32);
      const cs = makeCombatSummary([caster, thug]);
      stubRuntime(['charmed'], [{ target: 'Thug 1', effects: [{ type: 'charmed', condition: 'charmed' }] }]);

      await applyDamageToTarget(cs, 'Thug 1', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [createCasterCharacter('HexWarlock', 15)] });

      const strip = setRuntimeValue.mock.calls.find(call =>
        call[0] === 'Thug 1' && call[1] === 'activeConditions'
      );
      expect(strip).toBeTruthy();
      expect(strip[2]).not.toContain('charmed');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'condition',
        action: 'removed',
        characterName: 'Thug 1',
        condition: 'Charmed',
        reason: 'took damage (Charm)',
      }));
      expect(addEntry).not.toHaveBeenCalledWith('TestCampaign', expect.objectContaining({ name: 'Dominate Person Repeat Save' }));
    });

    it('still strips charmed unconditionally on damage for a NON-dominated charmed PC', async () => {
      const pc = createNpcCreature('EvasiveFighter', 40, 40, { type: 'player' });
      const cs = makeCombatSummary([pc]);
      stubRuntime(['charmed'], []);

      await applyDamageToTarget(cs, 'EvasiveFighter', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [createCasterCharacter('HexWarlock', 15)] });

      const strip = setRuntimeValue.mock.calls.find(call =>
        call[0] === 'EvasiveFighter' && call[1] === 'activeConditions'
      );
      expect(strip).toBeTruthy();
      expect(strip[2]).not.toContain('charmed');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'condition',
        action: 'removed',
        condition: 'Charmed',
      }));
    });
  });
});
