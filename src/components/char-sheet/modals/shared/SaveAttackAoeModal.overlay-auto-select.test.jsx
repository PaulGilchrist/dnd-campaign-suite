// @maintained-by-ai
// Regression pin for the 2026-10-30 overlay-targeted AoE picker bug: casting an
// area spell (repro: Fireball, sheet lane) while the caster's combatSummary
// target was armed to `overlay-<id>` opened the fully-generic picker with ZERO
// auto-selection, because SaveAttackAoeModal omitted campaignName/attackerName/
// rangeFt from its fallback <CreatureSelectionModal> — the effect that performs
// the overlay hit-test (getCurrentOverlayTarget → getCreaturesInsideOverlay)
// early-returns without them. The real cs resolution lives INSIDE that effect,
// so the product payload shape (playerStats WITHOUT a targetName field) must
// still auto-select: these tests never set playerStats.targetName.
//
// Owned here (not duplicated in siblings):
//   1. armed overlay → creatures inside are pre-selected, outside ones are not;
//   2. the lookup is keyed by the payload's campaignName + caster name
//      (prop-threading pin — the exact wiring the bug starved);
//   3. rangeFt threads the spell range into the distance-badge lookup;
//   4. untargeted cast (getCurrentOverlayTarget → null) auto-selects nothing.
// The base-branch lane (isOverlayTargeted && activeOverlay) is owned by
// SaveAttackAoeModal.overlay.test.jsx and is deliberately NOT re-litigated.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules (data seams only — mirror overlay.test.jsx) ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

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
  applyDamageToTarget: vi.fn(),
  computeDamageAfterEvasion: vi.fn(),
  computeDamageAfterResistancesWithDetails: vi.fn(),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
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

// ── spellOverlayService: mock ONLY the three async lookups the picker effect
// performs; distanceBadgeText stays REAL (rendered row copy). ──

const mockGetCurrentOverlayTarget = vi.fn();
const mockGetCreaturesInsideOverlay = vi.fn();
const mockGetTargetMapStatuses = vi.fn();

vi.mock('../../../../services/maps/spellOverlayService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCurrentOverlayTarget: (...args) => mockGetCurrentOverlayTarget(...args),
    getCreaturesInsideOverlay: (...args) => mockGetCreaturesInsideOverlay(...args),
    getTargetMapStatuses: (...args) => mockGetTargetMapStatuses(...args),
  };
});

// ── Fixtures ──

const coneOverlay = { id: 'cone-1', shape: 'cone', startGridX: 14, startGridY: 9, angle: 0, coneAngle: 53, distanceFt: 60 };

const baseProps = {
  action: { name: 'Fireball', automation: { scaling: { damage: '8d6' } } },
  // Product payload shape (savePath.js / saveAttackHandler.js builders): the raw
  // sheet playerStats — NO targetName field. The picker effect must resolve the
  // armed cs target itself from campaignName + attacker name.
  playerStats: { name: 'Cleric1', level: 12 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  activeOverlay: coneOverlay,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

function rowFor(name) {
  return [...document.querySelectorAll('.secondary-target-row')]
    .find(row => row.textContent.includes(name));
}

function checkboxFor(name) {
  return rowFor(name).querySelector('input[type="checkbox"]');
}

// ── Tests ──

describe('SaveAttackAoeModal - overlay-aware fallback picker (auto-select wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentOverlayTarget.mockResolvedValue(null);
    mockGetCreaturesInsideOverlay.mockResolvedValue([]);
    mockGetTargetMapStatuses.mockResolvedValue(null);
  });

  it('pre-selects creatures inside the armed overlay and leaves outside creatures unchecked', async () => {
    mockGetCurrentOverlayTarget.mockResolvedValue(coneOverlay);
    mockGetCreaturesInsideOverlay.mockResolvedValue(['Goblin A']);

    render(<SaveAttackAoeModal {...makeProps()} />);

    // The exact prop-threading the bug starved: the effect keys the lookup by
    // the payload campaignName + caster name, over every picker target name.
    await waitFor(() => expect(mockGetCurrentOverlayTarget).toHaveBeenCalledWith('test-campaign', 'Cleric1'));
    expect(mockGetCreaturesInsideOverlay).toHaveBeenCalledWith('test-campaign', coneOverlay, ['Goblin A', 'Goblin B', 'Player One']);

    await waitFor(() => {
      expect(checkboxFor('Goblin A')).toBeChecked();
      expect(checkboxFor('Goblin B')).not.toBeChecked();
      expect(checkboxFor('Player One')).not.toBeChecked();
    });
    expect(screen.getByRole('button', { name: /Fireball \(1\)/ })).not.toBeDisabled();
  });

  it('threads rangeFt into the distance-badge lookup and renders badges', async () => {
    mockGetTargetMapStatuses.mockResolvedValue({
      'Goblin A': { status: 'in', distFt: 10 },
      'Goblin B': { status: 'out', distFt: 90 },
      'Player One': { status: 'off-map', distFt: null },
    });

    render(<SaveAttackAoeModal {...makeProps()} />);

    await waitFor(() => expect(mockGetTargetMapStatuses).toHaveBeenCalledWith('test-campaign', 'Cleric1', ['Goblin A', 'Goblin B', 'Player One'], 20));
    await waitFor(() => {
      expect(screen.getByText('In range · 10 ft')).toBeInTheDocument();
      expect(screen.getByText('Out of range · 90 ft')).toBeInTheDocument();
      expect(screen.getByText('Off map')).toBeInTheDocument();
    });
  });

  it('untargeted cast (no overlay resolved) opens the picker with nothing auto-selected', async () => {
    render(<SaveAttackAoeModal {...makeProps()} />);

    await waitFor(() => expect(mockGetCurrentOverlayTarget).toHaveBeenCalled());
    expect(mockGetCreaturesInsideOverlay).not.toHaveBeenCalled();
    for (const name of ['Goblin A', 'Goblin B', 'Player One']) {
      expect(checkboxFor(name)).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: /Fireball \(0\)/ })).toBeDisabled();
  });
});
