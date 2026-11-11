// @maintained-by-ai
// SaveAttackAoeModal picker lane — same-effect charm survival (bug
// beguiling-song-own-damage-strips-its-charm).
// Family roles kept distinct from siblings:
//   - damage-resolution.test.jsx → damage arithmetic, dual pools, CLA-109
//   - creature-selection.test.jsx → picker rendering / metamagic
// Here: the failed-save GRANT must be sequenced AFTER the row's own damage
// legs have FULLY resolved. The real applyDamageToTarget reads
// activeConditions for its frightened/charmed damage-strip only AFTER several
// internal awaits; the pre-fix lane called it UN-AWAITED, so the synchronous
// resolveSaveFailGrant grant landed first and the strip deleted it seconds
// later (0/2 live rides, apply→remove ~3 ms). The mocked apply below
// emulates that internal ordering faithfully: it yields first, then strips
// charmed from the store — a regression to the un-awaited shape makes the
// grant land before the strip's read and the charmed condition dies.
// Sequencing mirrors saveProcessing.applySaveDamage (primary → secondary →
// applyFailedSaveConditions).
// RNG determinism copied from the damage-resolution family: DC 999 is the
// unconditional-NPC-fail seam (raw 19 from the 0.9+ stream).

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules (data seams only) ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

const { store } = vi.hoisted(() => ({ store: {} }));
const { callSequence } = vi.hoisted(() => ({ callSequence: [] }));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => {
    store[`${name}.${key}`] = value;
    if (key === 'activeConditions' && Array.isArray(value) && value.includes('charmed')) {
      callSequence.push('grant-charmed');
    }
  }),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  // Faithful race emulation: yields first (the REAL applyDamageToTarget has
  // several awaits before removeCombatConditionsOnDamage reads the store),
  // then strips frightened/charmed and logs the removal like the real lane.
  applyDamageToTarget: vi.fn(async (combatSummary, targetName, finalDamage) => {
    await Promise.resolve();
    const stored = store[`${targetName}.activeConditions`] || [];
    const remaining = stored.filter(c => !['charmed', 'frightened'].includes(String(c).toLowerCase()));
    if (remaining.length !== stored.length) {
      store[`${targetName}.activeConditions`] = remaining;
      callSequence.push('damage-strip');
    }
    callSequence.push('damage-resolved');
    return { finalDamage, oldHp: 20, newHp: 20 - finalDamage };
  }),
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
      { name: 'Goblin A', type: 'npc', currentHp: 40, maxHp: 40, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 60, maxHp: 60, saveBonuses: {} },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';

// ── Fixtures: the Maestro row shape (damage AND charmed on a failed save) ──

const baseProps = {
  action: { name: 'Beguiling Song', automation: {} },
  playerStats: { name: 'Performer Maestro', level: 6 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '3d10 + 4',
  damageType: 'Psychic',
  saveType: 'WIS',
  saveDc: 999,
  dcSuccess: 'half',
  saveConditions: ['charmed'],
  conditionDurationNote: "until the end of the performer's next turn",
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

function pick(...names) {
  names.forEach(n => fireEvent.click(checkboxFor(n)));
  const confirmBtn = screen.getByRole('button', { name: new RegExp(`Beguiling Song \\(${names.length}\\)`) });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

function dispatchSaveResult(promptId, detail) {
  return act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
    await new Promise((r) => setTimeout(r, 0)); // microtask flush of the resolution chain (benign yield)
  });
}

const conditionLogs = (action) => logService.addEntry.mock.calls
  .map(c => c[1])
  .filter(e => e && e.type === 'condition' && e.action === action);

// ── RNG stream ──

let randomSpy;
let randomCursor = 0;

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(store).forEach((k) => delete store[k]);
  callSequence.length = 0;
  randomCursor = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    randomCursor = (randomCursor % 10) + 1;
    return 0.9 + randomCursor / 1000;
  });
  diceRoller.rollExpression.mockImplementation(() => ({ total: 20, rolls: [6, 6, 8], modifier: 4 }));
});

afterEach(() => randomSpy.mockRestore());

// ── Tests ──

describe('Beguiling Song lane — the row\'s own damage never strips its own Charmed grant', () => {
  it('NPC auto-resolve: damage fully resolves BEFORE the grant write, charmed survives, zero removed rows', async () => {
    store['Goblin A.activeConditions'] = ['poisoned'];
    render(<SaveAttackAoeModal {...makeProps()} />);

    await pick('Goblin A');
    await waitFor(() => expect(screen.getByText(/Beguiling Song — Results/)).toBeInTheDocument());

    // The grant must not land until the damage apply has resolved.
    expect(callSequence.indexOf('damage-resolved')).toBeGreaterThanOrEqual(0);
    expect(callSequence.indexOf('grant-charmed')).toBeGreaterThan(callSequence.indexOf('damage-resolved'));
    expect(callSequence).not.toContain('damage-strip');

    // Store-truth: charmed SURVIVES its own row's damage (sibling kept).
    expect(store['Goblin A.activeConditions']).toEqual(['poisoned', 'charmed']);
    expect(conditionLogs('removed')).toHaveLength(0);
    const applied = conditionLogs('applied');
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ characterName: 'Goblin A', condition: 'Charmed', sourceName: 'Performer Maestro' });

    // Damage still pays (the law only re-arms for LATER damage).
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 20, ['Psychic'], expect.anything());
  });

  it('PC prompt resolution: failed save grants charmed AFTER the awaited damage apply, charmed survives', async () => {
    store['Player One.activeConditions'] = ['poisoned'];
    render(<SaveAttackAoeModal {...makeProps({ characters: [{ name: 'Player One' }] })} />);
    await pick('Player One');

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    const { promptId } = savePromptService.sendSavePrompt.mock.calls[0][1];
    await dispatchSaveResult(promptId, { success: false, saveBonus: 0, rawDamage: 20, total: 4, roll: 4, saveType: 'WIS', dcSuccess: 'half' });

    expect(callSequence.indexOf('grant-charmed')).toBeGreaterThan(callSequence.indexOf('damage-resolved'));
    expect(callSequence).not.toContain('damage-strip');
    expect(store['Player One.activeConditions']).toEqual(['poisoned', 'charmed']);
    expect(conditionLogs('removed')).toHaveLength(0);
    expect(conditionLogs('applied').map(e => e.condition)).toEqual(['Charmed']);
    // The grant also stamps the badge-click repeat-save meta row.
    expect(store['Player One.activeConditionMeta']).toMatchObject({ charmed: { dc: 999, ability: 'wis', source: 'Performer Maestro' } });
  });

  it('LATER damage from the same lane still strips charmed (engine law preserved)', async () => {
    // Charm already established BEFORE this row's damage resolves (an
    // earlier cast) → the strip read finds it and removes it. The law is
    // live; the fixed ordering only exempts the SAME resolution's own grant
    // (which then re-applies charmed — a fresh failed save re-charms).
    store['Goblin A.activeConditions'] = ['charmed'];
    store['Goblin A.activeConditionMeta'] = { charmed: { dc: 999, ability: 'wis', source: 'Performer Maestro' } };
    render(<SaveAttackAoeModal {...makeProps()} />);

    await pick('Goblin A');
    await waitFor(() => expect(screen.getByText(/Beguiling Song — Results/)).toBeInTheDocument());

    expect(callSequence.indexOf('damage-strip')).toBeGreaterThanOrEqual(0);
    expect(callSequence.indexOf('damage-strip')).toBeLessThan(callSequence.indexOf('damage-resolved'));
    expect(callSequence.indexOf('damage-resolved')).toBeLessThan(callSequence.indexOf('grant-charmed'));
    // The prior charm was broken mid-resolution, then re-granted by this cast.
    expect(store['Goblin A.activeConditions']).toEqual(['charmed']);
  });
});
