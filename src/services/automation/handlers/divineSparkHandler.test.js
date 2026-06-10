import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './divineSparkHandler.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as targetResolver from '../common/targetResolver.js';
import * as logService from '../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    class: {
      class_levels: [
        undefined,
        undefined,
        { channel_divinity: 2 },
        undefined,
        undefined,
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Spark',
    automation: {
      type: 'divine_spark',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('divineSparkHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no-charges popup when currentCharges is 0', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.automationType).toBe('divine_spark');
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('decrements channelDivinityCharges and returns modal when charges > 0', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('divineSpark');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'channelDivinityCharges',
      1,
      campaignName,
      true,
    );
  });

  it('calls setRuntimeValue with channelDivinityCharges (4th param = newCharges, 5th param = true)', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    await handle(action, ps, campaignName, null);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'channelDivinityCharges',
      2,
      campaignName,
      true,
    );
  });

  it('uses default maxCharges of 2 when class_levels data is missing', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats({
      class: { class_levels: undefined },
    });
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'channelDivinityCharges',
      1,
      campaignName,
      true,
    );
  });

  it('uses class_level.channel_divinity for maxCharges when available', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats({
      level: 3,
      class: {
        class_levels: [undefined, undefined, { channel_divinity: 3 }],
      },
    });
    const action = makeAction();

    await handle(action, ps, campaignName, null);

    // maxCharges = 3 (from channel_divinity at index 2), newCharges = 2
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'channelDivinityCharges',
      2,
      campaignName,
      true,
    );
  });

  it('uses class_specific.channel_divinity_charges as fallback for maxCharges', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats({
      level: 3,
      class: {
        class_levels: [
          undefined,
          undefined,
          {
            channel_divinity: 0,
            class_specific: { channel_divinity_charges: 4 },
          },
        ],
      },
    });
    const action = makeAction();

    await handle(action, ps, campaignName, null);

    // channel_divinity is 0 (falsy), falls back to class_specific.channel_divinity_charges = 4
    // newCharges = 3
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'channelDivinityCharges',
      3,
      campaignName,
      true,
    );
  });

  it('resolves target via resolveTarget and uses target name when available', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe('Ally');
    expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, ps.name);
  });

  it('falls back to playerStats.name as targetName when resolveTarget returns null', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe(ps.name);
  });

  it('calculates wisModifier from Wisdom ability bonus', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.wisModifier).toBe(2);
    expect(result.payload.healExpression).toBe('1d8 + 2');
    expect(result.payload.damageExpression).toBe('1d8 + 2');
  });

  it('uses 0 as wisModifier when Wisdom ability is missing', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats({ abilities: [] });
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.wisModifier).toBe(0);
    expect(result.payload.healExpression).toBe('1d8 + 0');
    expect(result.payload.damageExpression).toBe('1d8 + 0');
  });

  it('calls addEntry with correct ability_use data and target name in description', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: ps.name,
      abilityName: action.name,
      description: 'Divine Spark activated — targeting Ally.',
    });
  });

  it('returns modal with modalName divineSpark', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('divineSpark');
  });

  it('includes correct payload fields (featureName, attackerName, targetName, campaignName)', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.featureName).toBe(action.name);
    expect(result.payload.attackerName).toBe(ps.name);
    expect(result.payload.targetName).toBe(ps.name);
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('sets healExpression and damageExpression with wisModifier', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.healExpression).toBe('1d8 + 3');
    expect(result.payload.damageExpression).toBe('1d8 + 3');
  });

  it('uses auto.damageTypes when provided', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction({ damageTypes: ['Fire', 'Cold'] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.damageTypes).toEqual(['Fire', 'Cold']);
  });

  it('falls back to ["Necrotic", "Radiant"] when auto.damageTypes is missing', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction({ damageTypes: undefined });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.damageTypes).toEqual(['Necrotic', 'Radiant']);
  });

  it('uses auto.saveType when provided', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'WIS' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.saveType).toBe('WIS');
  });

  it('falls back to CON when auto.saveType is missing', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue(null);
    logService.addEntry.mockReturnValue(Promise.resolve());

    const ps = makePlayerStats();
    const action = makeAction({ saveType: undefined });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.saveType).toBe('CON');
  });
});
