// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells2024 from '../../../public/data/2024/spells.json';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';

const CAMPAIGN = 'test-campaign';

// Data authority: 2024 Essentials row (the only spells.json carrying the
// upcast_at_slot_level ladder for Animal Friendship; 5e row has none —
// covered by the missing-data fallback test below).
const AF = spells2024.find(s => s.name === 'Animal Friendship');

function makeCs() {
  return {
    creatures: [
      { name: 'Wild_Sage_Druid', type: 'player' },
      { name: 'Wolf 1', type: 'npc' },
      { name: 'Wolf 2', type: 'npc' },
    ],
  };
}

async function gate(spell) {
  const cfSetPending = vi.fn();
  const handled = await tryGateSpell('Animal Friendship', CAMPAIGN, cfSetPending, {
    spell,
    metaCtx: {},
    playerStats: { name: 'Wild_Sage_Druid' },
    characters: [],
    isSorcerer: false,
    setPopupHtml: vi.fn(),
  });
  return { handled, pending: cfSetPending.mock.calls[0]?.[1] };
}

describe('SP-002 gateAnimalFriendship — beast-only picker + upcast maxTargets threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
    getMonsterData.mockResolvedValue({ type: 'beast' });
  });

  it('base lv1 offers beasts only (caster excluded) capped at 1, 30 ft', async () => {
    const { handled, pending } = await gate({ ...AF });

    expect(handled).toBe(true);
    expect(pending.creatureTargets).toEqual(['Wolf 1', 'Wolf 2']);
    expect(pending.maxTargets).toBe(1);
    expect(pending.range).toBe('30 feet');
    expect(pending.rangeFt).toBe(30);
  });

  it.each([2, 3, 9])('lv%d upcast threads the RAW +1/slot ladder (extractMaxTargets)', async (lv) => {
    const { handled, pending } = await gate({ ...AF, isUpcast: true, upcastLevel: lv });

    expect(handled).toBe(true);
    expect(pending.maxTargets).toBe(lv);
  });

  it('excludes non-beast monsters from the picker', async () => {
    getMonsterData.mockImplementation(async (name) =>
      name === 'Wolf 1' ? { type: 'beast' } : { type: 'humanoid' });

    const { pending } = await gate({ ...AF });

    expect(pending.creatureTargets).toEqual(['Wolf 1']);
  });

  it('returns false when no beasts are in combat (cast falls through to generic path)', async () => {
    getMonsterData.mockResolvedValue({ type: 'humanoid' });

    const { handled, pending } = await gate({ ...AF });

    expect(handled).toBe(false);
    expect(pending).toBeUndefined();
  });

  it('falls back to a cap of 1 when upcast data is missing (5e data row shape)', async () => {
    const { pending } = await gate({ name: 'Animal Friendship', level: 1, range: '30 feet', casting_time: 'Action' });

    expect(pending.maxTargets).toBe(1);
  });
});
