// @maintained-by-ai
// CLA-244 consumer lane: with overchannel context present, SaveAttackAoeModal rolls the
// tagged damage formula through the REAL maximizer (diceRoller stays live) and delegates
// backlash ONCE, verbatim, to handleOverchannelSelfDamage. The useCount dice gate is owned
// by handleOverchannelSelfDamage.test.js — this lane pins pass-through integrity only, so
// useCount value changes never alter the modal's behavior here (one delegation test).
// Family roles: picker rendering → creature-selection.test.jsx; half-on-save round trip →
// damage-resolution.test.jsx; CLA-120 INT-fold → cla120-empowered-evocation.test.jsx.
// Real CreatureSelectionModal (proven inert in damage-resolution.test.jsx — no campaignName
// passed, its overlay lookup early-returns); AreaEffectTargetModalBase never mounts here
// (requires an 'overlay-' targetName), so it is not stubbed. persistAndNotify stays live.
//
// Determinism seam: computeNpcSave draws exactly TWO Math.random values per NPC (both dice
// always drawn; min taken only on disadvantage). Raw die pinned at 20 (20*0.99 =
// 19.800000000000000266… → floor 19 → +1 = 20): with saveBonuses.dex = -5 the total 15
// still fails DC 17, so full damage proves the lowercase bonus fold is live, not a silent
// +0. Normal-lane damage dice pinned at 0.5 (6*0.5 = 3 exact → 4,4,4 = 12).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules (data seams only — honest half-on-save semantics) ──

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((_cs, _name, dmg) => ({ finalDamage: dmg, newHp: 100 - dmg })),
  // Honest half-on-save semantics (fail pays full).
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Zombie 1', type: 'npc', currentHp: 22, maxHp: 22, saveBonuses: { dex: -5 }, resistances: [], immunities: [] },
      { name: 'Zombie 2', type: 'npc', currentHp: 22, maxHp: 22, saveBonuses: { dex: -5 }, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

// Inert unless metamagicCareful is set — isolated for determinism.
vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

// The delegation subject — dice-count gate lives in its own test file.
vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(() => Promise.resolve()),
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { handleOverchannelSelfDamage } from '../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js';

// ── Fixtures ──

const mockPlayerStats = { name: 'TestWizard', level: 20 };
// No spell:{} — the Bewitching Magic rider early-returns (this lane is class-feature, not spell-origin).
const mockAction = { name: 'Burning Hands', automation: {} };

function makeProps(overrides = {}) {
  return {
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: 'test-campaign',
    range: 0,
    damage: '3d6',
    damageType: 'Fire',
    saveType: 'DEX',
    saveDc: 17,
    dcSuccess: 'half',
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Helpers ──

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

function pick(...names) {
  names.forEach(n => fireEvent.click(checkboxFor(n)));
  const confirmBtn = screen.getByRole('button', { name: new RegExp(`Burning Hands \\(${names.length}\\)`) });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

function saveDamageLogs() {
  return addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.rollType === 'save-damage' && e.targetName);
}

// ── RNG stream (family seam: fallback draws roll a raw d20 of 20) ──

let randomSpy;
let randomDraws = [];

beforeEach(() => {
  vi.clearAllMocks();
  randomDraws = [];
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => randomDraws.shift() ?? 0.99);
});

afterEach(() => randomSpy.mockRestore());

describe('SaveAttackAoeModal — CLA-244 overchannel consumer', () => {
  it('rolls damage dice at MAXIMUM through the real maximizer and applies full 21 Fire to every failing target', async () => {
    render(<SaveAttackAoeModal {...makeProps({
      // Upstream savePath shape: tagged formula arrives pre-annotated.
      damage: '3d6 + 3 [Empowered Evocation] [Overchannel Maximize]',
      overchannelActive: true,
      overchannelUseCount: 1,
      overchannelSpellLevel: 1,
    })} />);

    // Pre-confirm inertness: nothing rolls or fires before the picker confirms.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(handleOverchannelSelfDamage).not.toHaveBeenCalled();

    await pick('Zombie 1', 'Zombie 2');

    // Raw die pinned at 20, dex −5 → 15 < DC 17: both fail, so every target pays the
    // FULL maximized 21 (3d6 max +3). A maximizer bypass would roll ≤18 raw here,
    // and a broken bonus lookup (silent +0) would succeed and halve to 10.
    expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Zombie 1', 21, ['Fire'], expect.any(Object));
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Zombie 2', 21, ['Fire'], expect.any(Object));

    const logs = saveDamageLogs();
    expect(logs).toHaveLength(2);
    expect(logs.map(l => l.targetName).sort()).toEqual(['Zombie 1', 'Zombie 2']);
    for (const log of logs) {
      expect(log.formula).toBe('3d6 + 3 [Empowered Evocation] [Overchannel Maximize]');
      expect(log.rolls).toEqual([6, 6, 6]);
      expect(log.total).toBe(21);
      expect(log.saveResult).toBe('failure');
      expect(log.finalDamage).toBe(21);
    }
  });

  it('delegates backlash to handleOverchannelSelfDamage once with the verbatim overchannel context whenever active', async () => {
    // Distinct useCount/spellLevel values pin the full-context passthrough — the modal
    // stamps identically on 1st and 2nd+ use (the gate is the handler's own lane).
    render(<SaveAttackAoeModal {...makeProps({
      damage: '3d6 [Overchannel Maximize]',
      overchannelActive: true,
      overchannelUseCount: 2,
      overchannelSpellLevel: 3,
    })} />);
    await pick('Zombie 1');

    expect(handleOverchannelSelfDamage).toHaveBeenCalledTimes(1);
    const [casterName, campaignName, ctx, logFn, characters] = handleOverchannelSelfDamage.mock.calls[0];
    expect(casterName).toBe('TestWizard');
    expect(campaignName).toBe('test-campaign');
    expect(ctx).toEqual({ overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 3 });
    expect(typeof logFn).toBe('function');
    expect(Array.isArray(characters)).toBe(true);
  });

  it('inactive control: dice roll NORMALLY (not maximized) and zero backlash delegation', async () => {
    // Queue: 2 save draws (raw 20, −5 = 15 < 17 fail) + 3 damage dice (0.5 → 4,4,4).
    randomDraws = [0.99, 0.99, 0.5, 0.5, 0.5];
    render(<SaveAttackAoeModal {...makeProps({ overchannelActive: false })} />);
    await pick('Zombie 1');

    expect(handleOverchannelSelfDamage).not.toHaveBeenCalled();
    // Maximization bypass check: the active lane rolls [6,6,6]/21 — this lane must not.
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Zombie 1', 12, ['Fire'], expect.any(Object));

    const logs = saveDamageLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].formula).toBe('3d6');
    expect(logs[0].rolls).toEqual([4, 4, 4]);
    expect(logs[0].total).toBe(12);
    expect(logs[0].saveResult).toBe('failure');
    expect(logs[0].finalDamage).toBe(12);
  });
});
