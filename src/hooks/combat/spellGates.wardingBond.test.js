// @maintained-by-ai: 2026-10-14
// SP-125: Warding Bond (2024) targets ANOTHER willing creature at touch range.
// Previously casts fell through to the generic paid lane, burning the lv2 slot
// on the handler's no-target refusal and never setting metaCtx.wardingBondTargetName
// outside combat. gateWardingBond opens the SecondaryTarget chooser UNPAID
// (pay-at-confirm) whenever a picker candidate exists, and defers to the verified
// paid lane when an initiative target is armed. Gate lane only — handler/AC-bonus
// seams live in wardingBondHandler + loggedDiceRollUtils.warding-bond tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells2024 from '../../../public/data/2024/spells.json';

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

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'War_Cleric';

// Data authority: 2024 Essentials row (SP-125 gate was built for the 2024 text;
// the 5e row shares the same automation and the gate keys off lowercase name).
const WARDING_BOND = spells2024.find(s => s.name === 'Warding Bond');

function gate({ cs, characters = [] } = {}) {
  getCombatSummary.mockReturnValue(cs);
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('warding bond', CAMPAIGN, cfSetPending, {
    spell: { ...WARDING_BOND },
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

  it('combat without armed target: opens chooser unpaid over every non-caster in initiative', () => {
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
    expect(pending.range).toBe('Touch');
    expect(pending.creatureTargets).toEqual(['AasimarTest', 'Bandit 1']);
  });

  it('outside combat: campaign roster fallback feeds the chooser (the previously dead lane)', () => {
    const { handled, pending } = gate({
      cs: null,
      characters: [{ name: CASTER }, { name: 'AasimarTest' }, { name: 'ElderPaladin' }],
    });
    expect(handled).toBe(true);
    expect(pending.creatureTargets).toEqual(['AasimarTest', 'ElderPaladin']);
  });

  it('no valid candidate (empty roster, or RAW "another creature" solo caster): returns false for the unpaid refusal gate', () => {
    expect(gate({ cs: null, characters: [] }).handled).toBe(false);
    expect(gate({ cs: null, characters: [{ name: CASTER }] }).handled).toBe(false);
  });
});
