// @improved-by-ai
// Regression tests for CLA-022: Aura of Warding resistances must be applied
// during damage calculation (not just displayed in the UI).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../combat/auras/auraComboEffects.js', () => ({
  computeAuraComboEffects: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { applyDamageToTarget } from './applyDamage.js';
import { computeAuraComboEffects } from '../../combat/auras/auraComboEffects.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

function emptyAuraEffects() {
  return {
    speedBonus: 0,
    speedSource: null,
    immunities: [],
    immunitySources: {},
    resistances: [],
    resistanceSource: null,
  };
}

function wardingAuraEffects() {
  return {
    speedBonus: 0,
    speedSource: null,
    immunities: [],
    immunitySources: {},
    resistances: ['Necrotic', 'Psychic', 'Radiant'],
    resistanceSource: 'Paladin',
  };
}

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createMinimalCharacter(name, computedExtra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      ...computedExtra,
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — Aura of Warding resistances (CLA-022)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((_key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      if (subKey === 'currentHitPoints') return 30;
      return undefined;
    });
    computeAuraComboEffects.mockResolvedValue(emptyAuraEffects());
  });

  it('halves Radiant damage for a player inside a paladin\u2019s Aura of Warding', async () => {
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);
    const result = await applyDamageToTarget(cs, 'Cleric', 20, ['Radiant'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Cleric')] });
    expect(result.finalDamage).toBe(10);
    expect(result.damageReduced).toBe(true);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Radiant', status: 'resistant' }]);
  });

  it('halves Necrotic damage while Aura of Warding is active', async () => {
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);
    const result = await applyDamageToTarget(cs, 'Cleric', 20, ['Necrotic'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Cleric')] });
    expect(result.finalDamage).toBe(10);
  });

  it('halves Psychic damage while Aura of Warding is active', async () => {
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);
    const result = await applyDamageToTarget(cs, 'Cleric', 20, ['Psychic'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Cleric')] });
    expect(result.finalDamage).toBe(10);
  });

  it('applies full damage for unresisted types even when the aura grants other resistances', async () => {
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);
    const result = await applyDamageToTarget(cs, 'Cleric', 20, ['Fire'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Cleric')] });
    expect(result.finalDamage).toBe(20);
    expect(result.damageReduced).toBe(false);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('applies full damage when the target is outside every paladin aura', async () => {
    computeAuraComboEffects.mockResolvedValue(emptyAuraEffects());
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);
    const result = await applyDamageToTarget(cs, 'Cleric', 20, ['Radiant'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Cleric')] });
    expect(result.finalDamage).toBe(20);
    expect(result.damageReduced).toBe(false);
  });

  it('merges aura resistances with base character resistances without duplicates', async () => {
    computeAuraComboEffects.mockResolvedValue({
      ...wardingAuraEffects(),
      resistances: ['Necrotic', 'Psychic', 'Radiant', 'Fire'],
    });
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);
    const character = createMinimalCharacter('Cleric', { resistances: ['Fire'] });
    const radiantResult = await applyDamageToTarget(cs, 'Cleric', 20, ['Radiant'], { campaignName: 'TestCampaign', characters: [character] });
    expect(radiantResult.finalDamage).toBe(10);

    computeAuraComboEffects.mockResolvedValue(emptyAuraEffects());
    const fireResult = await applyDamageToTarget(cs, 'Cleric', 20, ['Fire'], { campaignName: 'TestCampaign', characters: [character] });
    expect(fireResult.finalDamage).toBe(10);
  });

  it('halves damage for an NPC ally inside the aura', async () => {
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
    const npcAlly = {
      name: 'Orc Ally',
      type: 'npc',
      maxHp: 20,
      currentHp: 20,
      resistances: [],
      immunities: [],
      concentration: null,
    };
    const cs = makeCombatSummary([npcAlly]);
    const result = await applyDamageToTarget(cs, 'Orc Ally', 20, ['Radiant'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Paladin')] });
    expect(result.finalDamage).toBe(10);
    expect(npcAlly.currentHp).toBe(10);
  });
});
