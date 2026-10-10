// SP-125: Warding Bond previously had no gate — casts fell through to the
// generic paid lane, burning the lv2 slot on the handler's no-target refusal
// and never setting metaCtx.wardingBondTargetName outside combat. gateWardingBond
// opens the chooser UNPAID (pay-at-confirm) whenever a picker candidate exists,
// and defers to the paid lane byte-identically when an initiative target is armed.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  isStable: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn((cs, attackerName) => {
    const attacker = cs?.creatures?.find(c => c.name === attackerName);
    if (!attacker?.targetName) return null;
    return cs.creatures.find(c => c.name === attacker.targetName) || null;
  }),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'War_Cleric';

const WARDING_BOND = {
  name: 'Warding Bond',
  level: 2,
  casting_time: 'Action',
  range: 'Touch',
  concentration: false,
  duration: '1 hour',
  automation: { type: 'warding_bond', duration: '1 hour', target: 'willing_creature', casting_time: '1 action' },
};

function gate({ cs, characters = [] } = {}) {
  getCombatSummary.mockReturnValue(cs);
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('warding bond', CAMPAIGN, cfSetPending, {
    spell: WARDING_BOND,
    metaCtx: {},
    playerStats: { name: CASTER },
    characters,
    isSorcerer: false,
    setPopupHtml: vi.fn(),
  });
  return { handled, pending: cfSetPending.mock.calls[0]?.[1] };
}

describe('SP-125 gateWardingBond — unpaid chooser + paid-lane preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('armed initiative target: gate defers (returns false) so the verified paid lane stays byte-identical', () => {
    const cs = {
      creatures: [
        { name: CASTER, type: 'player', targetName: 'AasimarTest' },
        { name: 'AasimarTest', type: 'player' },
      ],
    };
    const { handled } = gate({ cs });
    expect(handled).toBe(false);
  });

  it('combat without armed target: opens chooser unpaid with candidates excluding the caster', () => {
    const cs = {
      creatures: [
        { name: CASTER, type: 'player' },
        { name: 'AasimarTest', type: 'player' },
        { name: 'Bandit 1', type: 'npc' },
      ],
    };
    const { handled, pending } = gate({ cs });
    expect(handled).toBe(true);
    expect(pending.spellName).toBe('Warding Bond');
    expect(pending.spellLevel).toBe(2);
    expect(pending.creatureTargets).toEqual(['AasimarTest', 'Bandit 1']);
    expect(pending.creatureTargets).not.toContain(CASTER);
  });

  it('outside combat: campaign roster fallback feeds the chooser (the previously dead lane)', () => {
    const { handled, pending } = gate({
      cs: null,
      characters: [{ name: CASTER }, { name: 'AasimarTest' }, { name: 'ElderPaladin' }],
    });
    expect(handled).toBe(true);
    expect(pending.creatureTargets).toEqual(['AasimarTest', 'ElderPaladin']);
  });

  it('zero candidates (no combat, empty roster): returns false so the unpaid refusal gate catches it', () => {
    const { handled } = gate({ cs: null, characters: [] });
    expect(handled).toBe(false);
  });

  it('solo roster (only the caster): RAW "another creature" — no chooser', () => {
    const { handled } = gate({ cs: null, characters: [{ name: CASTER }] });
    expect(handled).toBe(false);
  });
});
