// @maintained-by-ai 2026-11-26
//
// SP-100 gateRevivify lane (spellGates.js). Revivify's "died within the last
// minute" window is NOT a wall-clock timer (no-timers policy) — the gate only
// filters candidates by canonical dead-state via isCreatureDead, and the GM
// adjudicates the 1-minute window at the table. This unit owns the picker
// payload matrix (who the gate arms 'revivify' with, incl. excludeCaster);
// the zero-corpse refusal popup bytes + revivify_refused audit row are owned
// by spellGates.revivify-refused-row.test.js, the isCreatureDead branch truth
// table by services/shared/hpModifier.test.js, and downstream revival
// execution by the revivifyService.* lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

// Refusal writes a revivify_refused audit row (refuse-must-log law) — stub the lane.
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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
    { desc: 'offers dead PCs via runtime currentHitPoints (the 1/1 summary stub never decides)', runtime: (_n, k) => (k === 'currentHitPoints' ? 0 : null), expected: ['AllyPC', 'Thug 1'] },
    { desc: 'never offers a desynced player bucket — isDead:1 with positive runtime HP is not a corpse (bug-revivify-stale-isdead-negative-heal)', runtime: (_n, k) => (k === 'isDead' ? 1 : k === 'currentHitPoints' ? 18 : null), expected: ['Thug 1'] },
    { desc: 'never offers the dead caster self-resurrection (excludeCaster: the runtime-dead Cleric is dropped even beside a real corpse)', runtime: (_n, k) => (_n === 'Cleric' && k === 'currentHitPoints' ? 0 : null), expected: ['Thug 1'] },
  ])('$desc', ({ runtime, expected }) => {
    getRuntimeValue.mockImplementation(runtime);
    const { handled, cfSetPending } = gate();
    expect(handled).toBe(true);
    expect(cfSetPending).toHaveBeenCalledWith('revivify', expect.objectContaining({ creatureTargets: expected }));
  });

  it('refuses (handled, no picker) when the caster is the only corpse on the board — excludeCaster empties the pool', () => {
    getRuntimeValue.mockImplementation((_n, k) => (k === 'currentHitPoints' ? 0 : null));
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Cleric', type: 'player', currentHp: 1 }] });
    const { handled, cfSetPending, setPopupHtml } = gate();
    expect(handled).toBe(true);
    expect(cfSetPending).not.toHaveBeenCalled();
    // Popup copy + audit-row bytes are pinned verbatim in
    // spellGates.revivify-refused-row.test.js; here only the refusal lane fires.
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      automationType: 'revivify',
    }));
  });
});
