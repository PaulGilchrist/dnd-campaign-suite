import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyWarCasterReaction } from './reactionSpellHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 10,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Reactive Spell',
    automation: { type: 'reaction_spell', ...overrides },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionSpellHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns popup with trigger info', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Reactive Spell');
    expect(result.payload.trigger).toBe('opportunity_attack_reaction');
    expect(result.payload.automation).toBe(action.automation);
    expect(result.payload.description).toContain('Select a creature');
    expect(result.payload.description).toContain('within your reach');
    expect(result.payload.description).toContain('casting time of 1 action');
    expect(result.payload.description).toContain('target only that creature');
  });

  it('does not use playerStats or campaignName in handle', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    await handle(action, ps, campaignName, null);

    expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
  });

  it('uses action.name in popup', async () => {
    const action = { name: 'My Reactive Spell', automation: { type: 'reaction_spell' } };
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.name).toBe('My Reactive Spell');
    expect(result.payload.description).toContain('My Reactive Spell');
  });
});

describe('reactionSpellHandler.applyWarCasterReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores reaction in warCasterReactions', async () => {
    const ps = makePlayerStats();
    const spellData = { name: 'Burning Hands', level: 3 };

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

    expect(result).toEqual({ ok: true });
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      campaignName,
      'warCasterReactions',
      expect.arrayContaining([
        expect.objectContaining({
          targetName: 'Goblin',
          spellName: 'Burning Hands',
          spellData,
          characterName: 'TestCleric',
        }),
      ]),
      campaignName,
    );
  });

  it('appends to existing reactions', async () => {
    const ps = makePlayerStats();
    const spellData = { name: 'Fireball', level: 3 };

    useRuntimeState.getRuntimeValue.mockReturnValue([
      { targetName: 'Orc', spellName: 'Magic Missile' },
    ]);

    applyWarCasterReaction('Goblin', 'Fireball', spellData, ps, campaignName);

    const calls = useRuntimeState.setRuntimeValue.mock.calls;
    const storedCall = calls.find(c => c[1] === 'warCasterReactions');
    expect(storedCall[2].length).toBe(2);
  });

  it('includes timestamp', async () => {
    const ps = makePlayerStats();
    const spellData = { name: 'Burning Hands', level: 3 };

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const before = Date.now();
    applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);
    const after = Date.now();

    const calls = useRuntimeState.setRuntimeValue.mock.calls;
    const storedCall = calls.find(c => c[1] === 'warCasterReactions');
    const entry = storedCall[2][0];
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it('calls addEntry with ability_use type', async () => {
    const ps = makePlayerStats();
    const spellData = { name: 'Burning Hands', level: 3 };

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCleric',
        abilityName: 'War Caster - Reactive Spell',
        description: 'War Caster Reactive Spell: Casting Burning Hands as a reaction on Goblin.',
      }),
    );
  });

  it('catches and swallows addEntry errors', async () => {
    const ps = makePlayerStats();
    const spellData = { name: 'Fireball', level: 3 };

    useRuntimeState.getRuntimeValue.mockReturnValue([]);
    logService.addEntry.mockRejectedValue(new Error('network'));

    const result = applyWarCasterReaction('Goblin', 'Fireball', spellData, ps, campaignName);

    expect(result).toEqual({ ok: true });
  });
});
