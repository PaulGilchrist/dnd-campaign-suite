import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../shared/popupResponse.js', () => ({
  automationInfoPopup: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './bonusActionAttackHandler.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as popupResponse from '../../shared/popupResponse.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Strike',
    description: 'A powerful strike.',
    automation: {
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('bonusActionAttackHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return automationInfoPopup result when usesMax is 0', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 0 });
    const popupResult = { type: 'popup', payload: { type: 'automation_info' } };
    popupResponse.automationInfoPopup.mockReturnValue(popupResult);

    const result = await handle(action, ps, campaignName);

    expect(result).toBe(popupResult);
    expect(popupResponse.automationInfoPopup).toHaveBeenCalledWith(action);
  });

  it('should return automationInfoPopup result when usesMax is falsy/undefined (defaults to 0)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({}); // no usesMax
    const popupResult = { type: 'popup', payload: { type: 'automation_info' } };
    popupResponse.automationInfoPopup.mockReturnValue(popupResult);

    const result = await handle(action, ps, campaignName);

    expect(result).toBe(popupResult);
    expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('should return "no uses remaining" popup when usesUsed >= usesMax', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3 });
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.description).toContain('has no uses remaining');
    expect(result.payload.automation).toBe(action.automation);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('should include recharge value in description when auto.recharge is set', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3, recharge: 'Short Rest' });
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('Recharges on a Short Rest');
  });

  it('should use "Long Rest" as default recharge text when auto.recharge is missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3 });
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('Recharges on a Long Rest');
  });

  it('should increment usesUsed by 1 via setRuntimeValue when usesUsed < usesMax', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3 });
    useRuntimeState.getRuntimeValue.mockReturnValue(1);
    popupResponse.automationInfoPopup.mockReturnValue({ type: 'popup', payload: {} });

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'warPriestUses',
      2,
      campaignName,
    );
  });

  it('should use custom resourceKey from auto.resourceKey', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3, resourceKey: 'channelDivinityUses' });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    popupResponse.automationInfoPopup.mockReturnValue({ type: 'popup', payload: {} });

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'channelDivinityUses',
      1,
      campaignName,
    );
  });

  it('should use default "warPriestUses" when auto.resourceKey is missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3 });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    popupResponse.automationInfoPopup.mockReturnValue({ type: 'popup', payload: {} });

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'warPriestUses',
      1,
      campaignName,
    );
  });
});
