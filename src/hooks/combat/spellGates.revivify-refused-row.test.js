// @maintained-by-ai: 2026-11-15
//
// PX 2026-11-15 improve (gate-revive refusal asymmetry): gateRevivify's zero-corpse
// clean denial must write EXACTLY ONE revivify_refused audit row to the campaign log,
// mirroring the material_refused / maze_refused / warding_bond_refused row family
// (type:'automation', reason, characterName, abilityName/spellName, description
// ending "Nothing spent.") — while keeping the verbatim refusal popup copy and
// remaining a zero-cost denial (no picker queue, so no slot/diamond/HP lane is reached).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

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
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'War_Cleric';
const spell = { name: 'Revivify', level: 3, range: 'Touch' };

function gate(setPopupHtml = vi.fn()) {
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('Revivify', CAMPAIGN, cfSetPending, {
    spell,
    playerStats: { name: CASTER },
    setPopupHtml,
  });
  return { handled, cfSetPending, setPopupHtml };
}

describe('gateRevivify zero-corpse denial — revivify_refused audit row (refuse-must-log)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fresh-campaign face: nobody at 0 HP / dead on the board.
    getRuntimeValue.mockReturnValue(null);
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: CASTER, type: 'player' },
        { name: 'AllyPC', type: 'player' },
        { name: 'Goblin 1', type: 'npc', currentHp: 5, maxHp: 7 },
      ],
    });
  });

  it('writes exactly ONE revivify_refused row naming spell + caster, mirroring the material_refused family shape', () => {
    gate();

    expect(addEntry).toHaveBeenCalledTimes(1);
    const [campaign, entry] = addEntry.mock.calls[0];
    expect(campaign).toBe(CAMPAIGN);
    expect(entry).toEqual({
      type: 'automation',
      automationType: 'revivify_refused',
      reason: 'no_corpse',
      characterName: CASTER,
      abilityName: spell.name,
      spellName: spell.name,
      description: 'Revivify refused: no creature has died within the last minute. Nothing spent.',
      timestamp: expect.any(Number),
    });
  });

  it('popup keeps the verbatim refusal copy and the row always accompanies it (never either alone)', () => {
    const { handled, setPopupHtml } = gate();

    expect(handled).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'automation_info',
      name: 'Revivify',
      automationType: 'revivify',
      description: 'No creature has died within the last minute. Revivify can only target a creature that has died.',
    });
    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  it('writes the refusal row even when the popup sink is absent (denial does not depend on the UI sink)', () => {
    gate(undefined);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      automationType: 'revivify_refused',
      description: 'Revivify refused: no creature has died within the last minute. Nothing spent.',
    }));
  });

  it('zero-cost denial: the picker never opens (no path to slot spend, diamond consumption, or HP write)', () => {
    const { cfSetPending } = gate();
    expect(cfSetPending).not.toHaveBeenCalled();
  });

  it('control: a corpse on the board opens the picker and writes NO refusal row', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: CASTER, type: 'player' },
        { name: 'Thug 1', type: 'npc', currentHp: 0, maxHp: 32 },
      ],
    });
    const { handled, cfSetPending } = gate();

    expect(handled).toBe(true);
    expect(cfSetPending).toHaveBeenCalledWith('revivify', expect.objectContaining({ creatureTargets: ['Thug 1'] }));
    expect(addEntry).not.toHaveBeenCalled();
  });
});
