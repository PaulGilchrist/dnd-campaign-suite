// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(),
}));

import { handle } from './foresightHandler.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { triggerForesight } from '../../../rules/features/foresightService.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';
const casterName = 'Wizard';
const targetName = 'Fighter';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 9,
    proficiencyBonus: 4,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Foresight',
    spell: { name: 'Foresight', level: 9 },
    automation: { type: 'foresight', duration: '8 hours' },
    ...overrides,
  };
}

describe('foresightHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves target and calls triggerForesight with correct parameters', async () => {
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    triggerForesight.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Foresight' } });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(resolveTarget).toHaveBeenCalledWith(campaignName, casterName);
    expect(triggerForesight).toHaveBeenCalledWith(
      { name: 'Foresight' },
      { targetName },
      expect.objectContaining({ name: casterName }),
      campaignName,
      mapName,
    );
    expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info', name: 'Foresight' } });
  });

  it('falls back to caster name when no target resolved', async () => {
    resolveTarget.mockResolvedValue(null);
    triggerForesight.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Foresight' } });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(triggerForesight).toHaveBeenCalledWith(
      { name: 'Foresight' },
      { targetName: casterName },
      expect.objectContaining({ name: casterName }),
      campaignName,
      mapName,
    );
    expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info', name: 'Foresight' } });
  });

  it('prefers action.name over spell.name and passes service null through uncoerced', async () => {
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    triggerForesight.mockResolvedValue(null);

    // spell.name stays 'Foresight' — first-arg { name: 'My Foresight' } pins action.name precedence
    const action = makeAction({ name: 'My Foresight' });
    const result = await handle(action, makePlayerStats(), campaignName, mapName);

    expect(triggerForesight).toHaveBeenCalledWith(
      { name: 'My Foresight' },
      { targetName },
      expect.anything(),
      campaignName,
      mapName,
    );
    expect(result).toBeNull();
  });
});
