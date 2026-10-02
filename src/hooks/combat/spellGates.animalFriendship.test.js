import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const UPCAST_DATA = { 1: '1 target', 2: '2 targets', 3: '3 targets' };

function makeSpell(overrides = {}) {
  return {
    name: 'Animal Friendship',
    level: 1,
    range: '30 feet',
    casting_time: 'Action',
    upcast_at_slot_level: UPCAST_DATA,
    ...overrides,
  };
}

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

describe('SP-002 gateAnimalFriendship — upcast maxTargets threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
    getMonsterData.mockResolvedValue({ type: 'beast' });
  });

  it('base lv1 caps the picker at 1 target', async () => {
    const { handled, pending } = await gate(makeSpell());

    expect(handled).toBe(true);
    expect(pending.creatureTargets).toEqual(['Wolf 1', 'Wolf 2']);
    expect(pending.maxTargets).toBe(1);
    expect(pending.spellLevel).toBe(1);
  });

  it('lv2 upcast radio threads upcastLevel and caps at 2 targets', async () => {
    const { handled, pending } = await gate(makeSpell({ isUpcast: true, upcastLevel: 2 }));

    expect(handled).toBe(true);
    expect(pending.spell.upcastLevel).toBe(2);
    expect(pending.maxTargets).toBe(2);
  });

  it('lv3 upcast caps at 3 targets', async () => {
    const { pending } = await gate(makeSpell({ isUpcast: true, upcastLevel: 3 }));

    expect(pending.maxTargets).toBe(3);
  });

  it('falls back to a cap of 1 when upcast data is missing', async () => {
    const { pending } = await gate({ name: 'Animal Friendship', level: 1, range: '30 feet', casting_time: 'Action' });

    expect(pending.maxTargets).toBe(1);
  });
});
