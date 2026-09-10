// @improved-by-ai
// CLA-383 regression locks: Warding Flare must write te disadvantage_next_attack
// (te-producer model, mirrors verified Vicious Mockery/Sap/Tumble) instead of the
// old post-roll second-d20 simulation, refuse without spending once reacted this
// round (per-trigger/round latch), and never re-fire unlimited times on one
// resolved lastAttack.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn().mockReturnValue(30),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn().mockReturnValue(4),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn().mockImplementation((name, description, automation, extraProps) => {
    const result = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name,
        description,
        automation,
      },
    };
    if (extraProps) {
      Object.assign(result, extraProps);
    }
    return result;
  }),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn().mockReturnValue(4),
}));

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as expirations from '../../../rules/effects/expirations.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makeWardingFlareAction() {
  return {
    name: 'Warding Flare',
    automation: {
      type: 'reaction_debuff',
      trigger: 'attack_roll_within_30ft',
      effect: 'disadvantage_on_attack_roll',
      uses_expression: 'WIS modifier_min_1',
      recharge: 'long_rest',
      casting_time: '1 reaction',
    },
  };
}

function makeCleric(overrides = {}) {
  return {
    name: 'War_Cleric',
    level: 8,
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    characterAdvancement: [],
    specialActions: [],
    ...overrides,
  };
}

function resolvedAttackEvent(options = {}) {
  return {
    d20: 12,
    bonus: 4,
    targetName: 'War_Cleric',
    targetAc: 12,
    effectiveAc: null,
    hit: true,
    forcedMode: 'normal',
    rolls: [12],
    rollType: 'attack',
    timestamp: Date.now(),
    ...options,
  };
}

function setupThugAttack(options = {}) {
  const { attackEvent = resolvedAttackEvent(), attackerName = 'Thug 1' } = options;
  damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent,
    attackerName,
    targetName: attackEvent.targetName,
    primaryDamage: attackEvent.hit ? 5 : 0,
    secondaryDamage: 0,
    totalDamage: attackEvent.hit ? 5 : 0,
    damageTypes: attackEvent.hit ? ['Bludgeoning'] : [],
  });
  targetResolver.resolveMapPositions.mockResolvedValue(undefined);
}

// Runtime store stand-in: keys resolve exactly like production getRuntimeValue
function store(initial = {}) {
  const data = { ...initial };
  useRuntimeState.getRuntimeValue.mockImplementation((charKey, key) => data[`${charKey}.${key}`]);
  useRuntimeState.setRuntimeValue.mockImplementation(async (charKey, key, value) => {
    data[`${charKey}.${key}`] = value;
  });
  return data;
}

describe('reactionDebuffHandler — Warding Flare te-producer fix (CLA-383)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expirations.addExpiration.mockReset();
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    targetResolver.resolveMapPositions.mockResolvedValue(undefined);
  });

  it('spends one use and writes te disadvantage_next_attack on the attacker — no fake second d20', async () => {
    const data = store({
      'War_Cleric.wardingflareUses': 4,
      'campaign.targetEffects': [],
    });
    setupThugAttack();

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).not.toContain('second d20');
    expect(result.payload.description).toContain('Disadvantage on its next attack roll');

    const te = data['campaign.targetEffects'];
    expect(te).toEqual([
      expect.objectContaining({
        effect: 'disadvantage_next_attack',
        target: 'Thug 1',
        source: 'War_Cleric',
        duration: 'until_used',
      }),
    ]);
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'War_Cleric',
      'Thug 1',
      [{ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: 'War_Cleric' }],
      campaignName,
      undefined,
      'War_Cleric'
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('War_Cleric', '_Warding_Flare_usedRound', 1, campaignName);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('War_Cleric', 'wardingflareUses', 3, campaignName);

    const logged = logService.addEntry.mock.calls.map(c => c[1]);
    expect(logged).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'ability_use', characterName: 'War_Cleric', abilityName: 'Warding Flare', targetName: 'Thug 1' }),
      expect.objectContaining({ type: 'condition', condition: 'Disadvantage on next attack', targetName: 'Thug 1' }),
    ]));
  });

  it('refuses without spending once it has reacted this round (per-trigger latch)', async () => {
    const data = store({
      'War_Cleric.wardingflareUses': 3,
      'War_Cleric._Warding_Flare_usedRound': 1,
      'campaign.targetEffects': [],
    });
    setupThugAttack();

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('already been used this round');
    expect(data['War_Cleric.wardingflareUses']).toBe(3);
    expect(data['campaign.targetEffects']).toEqual([]);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith('War_Cleric', 'wardingflareUses', expect.anything(), campaignName);
    expect(expirations.addExpiration).not.toHaveBeenCalled();

    const refusal = logService.addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'warding_flare_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.type).toBe('automation');
    expect(refusal.characterName).toBe('War_Cleric');
  });

  it('refuses and logs with no spend when no recent attack roll exists', async () => {
    store({ 'War_Cleric.wardingflareUses': 4 });
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    damageRollback.findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, totalDamage: 0 });

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No recent attack roll');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith('War_Cleric', 'wardingflareUses', expect.anything(), campaignName);
    const refusal = logService.addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'warding_flare_refused');
    expect(refusal).toBeTruthy();
  });

  it('refuses without spending when the triggering attack is your own', async () => {
    const data = store({ 'War_Cleric.wardingflareUses': 4 });
    setupThugAttack({ attackerName: 'War_Cleric' });

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('your own attack');
    expect(data['War_Cleric.wardingflareUses']).toBe(4);
    const refusal = logService.addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'warding_flare_refused');
    expect(refusal).toBeTruthy();
  });

  it('refuses out-of-range attackers without spending and logs the refusal', async () => {
    const data = store({ 'War_Cleric.wardingflareUses': 4 });
    setupThugAttack();
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 20, gridY: 0 },
    });
    const rangeCheck = await import('../../../rules/combat/rangeCheck.js');
    rangeCheck.isWithinRange.mockResolvedValueOnce(false);

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('out of range');
    expect(data['War_Cleric.wardingflareUses']).toBe(4);
    const refusal = logService.addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'warding_flare_refused');
    expect(refusal).toBeTruthy();
  });

  it('re-arms next round: fresh round after spent latch reacts again (one te, one spend)', async () => {
    const data = store({
      'War_Cleric.wardingflareUses': 2,
      'War_Cleric._Warding_Flare_usedRound': 1,
      'campaign.targetEffects': [],
    });
    setupThugAttack();
    damageUtils.getCombatContext.mockResolvedValue({ round: 2, creatures: [] });

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(data['War_Cleric.wardingflareUses']).toBe(1);
    expect(data['War_Cleric._Warding_Flare_usedRound']).toBe(2);
    expect(data['campaign.targetEffects']).toHaveLength(1);
  });
});
