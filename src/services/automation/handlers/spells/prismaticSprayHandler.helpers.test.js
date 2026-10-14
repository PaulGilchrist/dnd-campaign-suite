import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isPrismaticSprayBlocked } from './prismaticSprayHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

describe('prismaticSprayHandler.isPrismaticSprayBlocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when neither has effects', async () => {
    getRuntimeValue.mockReturnValue([]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(false);
  });

  it('returns true when only attacker has an effect', async () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'TestWizard' },
    ]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(true);
  });

  it('returns true when only target has an effect', async () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Orc', effect: 'prismatic_spray_violet', source: 'TestWizard' },
    ]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(true);
  });

  it('returns false when both have effects from the same caster', async () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'TestWizard' },
      { target: 'Orc', effect: 'prismatic_spray_violet', source: 'TestWizard' },
    ]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(false);
  });

  it('returns true when both have effects from different casters', async () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' },
      { target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterB' },
    ]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(true);
  });

  it('only considers prismatic_spray_indigo and prismatic_spray_violet effects', async () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'fear_end_on_los', source: 'TestWizard' },
      { target: 'Orc', effect: 'hypno_charm', source: 'TestWizard' },
    ]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(false);
  });

  it('handles missing attackerName or targetName', async () => {
    expect(isPrismaticSprayBlocked(null, 'Orc', campaignName)).toBe(false);
    expect(isPrismaticSprayBlocked('Goblin', null, campaignName)).toBe(false);
    expect(isPrismaticSprayBlocked('', 'Orc', campaignName)).toBe(false);
    expect(isPrismaticSprayBlocked('Goblin', '', campaignName)).toBe(false);
  });

  it('handles empty targetEffects array', async () => {
    getRuntimeValue.mockReturnValue([]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(false);
  });

  it('handles null targetEffects', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    expect(result).toBe(false);
  });

  it('checks both attacker and target for effects', async () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'TestWizard' },
      { target: 'Goblin', effect: 'prismatic_spray_violet', source: 'OtherWizard' },
    ]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    // Goblin has effects, Orc doesn't -> blocked
    expect(result).toBe(true);
  });

  it('checks shared caster when both have multiple effects', async () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' },
      { target: 'Goblin', effect: 'prismatic_spray_violet', source: 'CasterB' },
      { target: 'Orc', effect: 'prismatic_spray_indigo', source: 'CasterB' },
    ]);

    const result = isPrismaticSprayBlocked('Goblin', 'Orc', campaignName);

    // Both have effects from CasterB -> not blocked
    expect(result).toBe(false);
  });
});
