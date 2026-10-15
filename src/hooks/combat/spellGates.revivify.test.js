// @maintained-by-ai: 2026-10-14
//
// SP-100 gateRevivify lane (spellGates.js). Revivify's "died within the last
// minute" window is NOT a wall-clock timer (no-timers policy) — the gate only
// filters candidates by canonical dead-state via isCreatureDead, and the GM
// adjudicates the 1-minute window at the table. This unit exercises the gate's
// target-selection + refusal popup only; downstream revival execution lives in
// the revivifyService.* lane.
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
const spell = { name: 'Revivify', level: 3, range: 'Touch' };

// Default roster: Cleric (caster, alive), AllyPC (player stub 1/1),
// Thug 1 (monster, dead 0 HP), Goblin 1 (monster, alive).
function defaultCreatures() {
  return [
    { name: 'Cleric', type: 'player' },
    { name: 'AllyPC', type: 'player' },
    { name: 'Thug 1', type: 'npc', currentHp: 0, maxHp: 32 },
    { name: 'Goblin 1', type: 'npc', currentHp: 5, maxHp: 7 },
  ];
}

function gate(setPopupHtml = vi.fn()) {
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('Revivify', CAMPAIGN, cfSetPending, {
    spell,
    playerStats: { name: 'Cleric' },
    setPopupHtml,
  });
  return { handled, cfSetPending, setPopupHtml };
}

describe('SP-100 gateRevivify — dead-target picker gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({ creatures: defaultCreatures() });
  });

  it.each([
    { desc: 'offers dead monsters, filtering out living creatures', runtime: () => null, expected: ['Thug 1'] },
    { desc: 'includes dead PCs via runtime currentHitPoints', runtime: (_n, k) => (k === 'currentHitPoints' ? 0 : null), expected: ['AllyPC', 'Thug 1'] },
    { desc: 'includes dead PCs via runtime isDead (no HP key)', runtime: (_n, k) => (k === 'isDead' ? 1 : null), expected: ['AllyPC', 'Thug 1'] },
  ])('$desc', ({ runtime, expected }) => {
    getRuntimeValue.mockImplementation(runtime);
    const { handled, cfSetPending } = gate();
    expect(handled).toBe(true);
    expect(cfSetPending).toHaveBeenCalledWith('revivify', expect.objectContaining({ creatureTargets: expected }));
  });

  it.each([
    { desc: 'no creature is dead', runtime: () => null, creatures: [{ name: 'Cleric', type: 'player' }, { name: 'Goblin 1', type: 'npc', currentHp: 7 }] },
    { desc: 'only the caster is dead (self-resurrection excluded)', runtime: (_n, k) => (k === 'currentHitPoints' ? 0 : null), creatures: [{ name: 'Cleric', type: 'player', currentHp: 1 }] },
    { desc: 'a monster without HP data is treated as alive', runtime: () => null, creatures: [{ name: 'Cleric', type: 'player' }, { name: 'Mystery', type: 'npc' }] },
  ])('refuses with popup, never opens the picker, when $desc', ({ runtime, creatures }) => {
    getRuntimeValue.mockImplementation(runtime);
    getCombatSummary.mockReturnValue({ creatures });
    const { handled, cfSetPending, setPopupHtml } = gate();
    expect(handled).toBe(true);
    expect(cfSetPending).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      automationType: 'revivify',
      description: expect.stringContaining('died'),
    }));
  });
});
