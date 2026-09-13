// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
  isBuffActive: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../class-druid/wildShapeCreatureBuilder.js', () => ({
  cleanupWildShape: vi.fn(),
}));

import { handle, confirmTelepathicSpeech } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as abilityLookup from '../../../../services/shared/abilityLookup.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Test Buff',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

describe('buffHandler.handle - modal delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('advantage_on_stealth (Blessing of the Trickster)', () => {
    it('returns modal when feature is not active and combatSummary has creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 10, size: 'Medium' },
          { name: 'Ally2', type: 'npc', currentHp: 5, maxHp: 8, size: 'Small' },
          { name: 'Enemy1', type: 'monster', currentHp: 20, maxHp: 25, size: 'Large' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('tricksterBlessing');
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Ally1', currentHp: 10, maxHp: 10, size: 'Medium', type: 'player' },
        { name: 'Ally2', currentHp: 5, maxHp: 8, size: 'Small', type: 'npc' },
        { name: 'Enemy1', currentHp: 20, maxHp: 25, size: 'Large', type: 'monster' },
      ]);
    });

    it('returns popup when feature is already active', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Blessing of the Trickster', automation: { type: 'buff', effect: 'advantage_on_stealth' } };
      runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Blessing of the Trickster' }]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('already active');
    });

    it('handles empty creatures list', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('uses default feature name when action.name is missing', async () => {
      const ps = makePlayerStats();
      const action = { automation: { effect: 'advantage_on_stealth' } };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('tricksterBlessing');
    });
  });

  describe('sunlight_aura (Corona of Light)', () => {
    it('returns modal when feature is not active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 10 },
          { name: 'Enemy1', type: 'monster', currentHp: 20, maxHp: 25 },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('coronaEnemySelection');
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 10 },
        { name: 'Enemy1', type: 'monster', currentHp: 20, maxHp: 25 },
      ]);
    });

    it('excludes self from creature targets', async () => {
      const ps = makePlayerStats({ name: 'TestHero' });
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'TestHero', type: 'player', currentHp: 10, maxHp: 10 },
          { name: 'Enemy1', type: 'monster', currentHp: 20, maxHp: 25 },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([
        { name: 'Enemy1', type: 'monster', currentHp: 20, maxHp: 25 },
      ]);
    });

    it('handles null combatSummary gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns popup when feature is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([{ effect: 'sunlight_aura' }]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('already active');
    });
  });

  describe('telepathic_speech', () => {
    it('returns modal when feature is not active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'telepathic_speech' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 10, size: 'Medium' },
          { name: 'TestHero', type: 'player', currentHp: 15, maxHp: 15, size: 'Medium' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('telepathicSpeech');
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Ally1', currentHp: 10, maxHp: 10, size: 'Medium', type: 'player' },
      ]);
    });

    it('excludes self from creature targets', async () => {
      const ps = makePlayerStats({ name: 'TestHero' });
      const action = makeAction({ effect: 'telepathic_speech' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'TestHero', type: 'player', currentHp: 15, maxHp: 15, size: 'Medium' },
          { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 10, size: 'Medium' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([
        { name: 'Ally1', currentHp: 10, maxHp: 10, size: 'Medium', type: 'player' },
      ]);
    });

    it('returns popup when feature is already active', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Telepathic Speech', automation: { type: 'buff', effect: 'telepathic_speech' } };
      runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Telepathic Speech' }]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('already active');
    });
  });
});

describe('buffHandler.confirmTelepathicSpeech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue([]);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
  });

  it('activates with correct CHA-based miles and level-based duration', async () => {
    const ps = makePlayerStats({
      name: 'Channeler',
      level: 7,
      abilities: [{ name: 'Charisma', bonus: 3, save: 6 }],
    });
    const action = { automation: { effect: 'telepathic_speech' }, name: 'Awakened Mind' };
    abilityLookup.getAbilityModifier.mockReturnValue(3);
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    const result = await confirmTelepathicSpeech(action, ps, campaignName, 'Listener');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('3 miles');
    expect(result.payload.description).toContain('7 minutes');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Channeler',
      'awakenedMindTarget',
      'Listener',
      campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Channeler', targetName: 'Channeler', effects: expect.arrayContaining([expect.objectContaining({ type: 'remove_active_buff' })]), campaignName });
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Channeler',
        abilityName: 'Awakened Mind',
        description: expect.stringContaining('activated Awakened Mind with Listener'),
      })
    );
  });

  it('deactivates when already active', async () => {
    const ps = makePlayerStats({
      name: 'Channeler',
      level: 5,
      abilities: [{ name: 'Charisma', bonus: 2, save: 5 }],
    });
    const action = { name: 'Awakened Mind', automation: { effect: 'telepathic_speech' } };
    abilityLookup.getAbilityModifier.mockReturnValue(2);
    buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

    const result = await confirmTelepathicSpeech(action, ps, campaignName, 'Listener');

    expect(result.payload.description).toContain('deactivated');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Channeler',
      'awakenedMindTarget',
      null,
      campaignName
    );
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });

  it('uses feature name default when action.name is missing', async () => {
    const ps = makePlayerStats({
      name: 'Channeler',
      level: 3,
      abilities: [{ name: 'Charisma', bonus: 1, save: 3 }],
    });
    const action = { automation: { effect: 'telepathic_speech' } };
    abilityLookup.getAbilityModifier.mockReturnValue(1);
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    const result = await confirmTelepathicSpeech(action, ps, campaignName, 'Listener');

    expect(result.payload.name).toBe('Telepathic Speech');
    expect(result.payload.description).toContain('Telepathic Speech');
  });

  it('handles CHA modifier of 0 (minimum 1 mile)', async () => {
    const ps = makePlayerStats({
      name: 'Channeler',
      level: 1,
      abilities: [{ name: 'Charisma', bonus: 0, save: 0 }],
    });
    const action = makeAction({ effect: 'telepathic_speech' });
    abilityLookup.getAbilityModifier.mockReturnValue(0);
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    const result = await confirmTelepathicSpeech(action, ps, campaignName, 'Listener');

    expect(result.payload.description).toContain('1 mile');
    expect(result.payload.description).toContain('1 minute');
  });

  it('uses non-Awakened Mind feature name for logging', async () => {
    const ps = makePlayerStats({
      name: 'Channeler',
      level: 10,
      abilities: [{ name: 'Charisma', bonus: 4, save: 7 }],
    });
    const action = makeAction({ effect: 'telepathic_speech', name: 'Telepathic Speech' });
    abilityLookup.getAbilityModifier.mockReturnValue(4);
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    await confirmTelepathicSpeech(action, ps, campaignName, 'Listener');

    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Channeler',
      'awakenedMindTarget',
      expect.anything(),
      campaignName
    );
  });
});
