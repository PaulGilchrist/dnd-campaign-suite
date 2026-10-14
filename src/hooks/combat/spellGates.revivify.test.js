import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

// PCs canonical via runtime store (pitfall 37); monsters via combatSummary.
vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

const CAMPAIGN = 'TestCampaign';
const spell = { name: 'Revivify', level: 3, range: 'Touch', casting_time: '1 Action' };

function makeCs() {
  return {
    creatures: [
      { name: 'Cleric', type: 'player', currentHp: 1, maxHp: 1 },
      { name: 'AllyPC', type: 'player', currentHp: 1, maxHp: 1 },
      { name: 'Thug 1', type: 'npc', currentHp: 0, maxHp: 32 },
      { name: 'Goblin 1', type: 'npc', currentHp: 5, maxHp: 7 },
    ],
  };
}

function gate(cs, setPopupHtml = vi.fn()) {
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('Revivify', CAMPAIGN, cfSetPending, {
    spell,
    metaCtx: {},
    playerStats: { name: 'Cleric' },
    characters: [],
    isSorcerer: false,
    setPopupHtml,
  });
  return { handled, cfSetPending, setPopupHtml };
}

describe('SP-100 gateRevivify — dead-target picker gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
  });

  it('offers dead monsters but filters out living creatures', () => {
    getRuntimeValue.mockImplementation(() => null);
    const { handled, cfSetPending } = gate();
    expect(handled).toBe(true);
    expect(cfSetPending).toHaveBeenCalledWith('revivify', expect.objectContaining({
      creatureTargets: ['Thug 1'],
    }));
  });

  it('includes dead PCs via runtime currentHitPoints (combatSummary 1/1 stub ignored)', () => {
    getRuntimeValue.mockImplementation((_name, key) => (key === 'currentHitPoints' ? 0 : null));
    const { cfSetPending } = gate();
    expect(cfSetPending.mock.calls[0][1].creatureTargets).toEqual(['AllyPC', 'Thug 1']);
  });

  it('includes dead PCs via runtime isDead even without HP key', () => {
    getRuntimeValue.mockImplementation((_name, key) => (key === 'isDead' ? 1 : null));
    const { cfSetPending } = gate();
    expect(cfSetPending.mock.calls[0][1].creatureTargets).toContain('AllyPC');
  });

  it('refuses with popup and never opens picker when no creature is dead', () => {
    getRuntimeValue.mockImplementation(() => null);
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Cleric', type: 'player' },
        { name: 'Goblin 1', type: 'npc', currentHp: 7 },
      ],
    });
    const { handled, cfSetPending, setPopupHtml } = gate();
    expect(handled).toBe(true);
    expect(cfSetPending).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      automationType: 'revivify',
    }));
    expect(setPopupHtml.mock.calls[0][0].description).toContain('died');
  });

  it('excludes the caster even if dead', () => {
    getRuntimeValue.mockImplementation((_name, key) => (key === 'currentHitPoints' ? 0 : null));
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Cleric', type: 'player', currentHp: 1 },
      ],
    });
    const { cfSetPending, setPopupHtml } = gate();
    expect(cfSetPending).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
  });

  it('treats monsters without HP data as alive (no false offer)', () => {
    getRuntimeValue.mockImplementation(() => null);
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Cleric', type: 'player' },
        { name: 'Mystery', type: 'npc' },
      ],
    });
    const { cfSetPending, setPopupHtml } = gate();
    expect(cfSetPending).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
  });
});
