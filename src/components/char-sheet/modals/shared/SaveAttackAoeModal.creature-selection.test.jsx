// @maintained-by-ai 2026-11-27
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// Picker-lane tests use the REAL CreatureSelectionModal. SaveAttackAoeModal
// DOES pass campaignName/attackerName/rangeFt (overlay auto-select wiring), but
// every lookup seam resolves empty here: the mocked combatSummary has no
// 'overlay-' targetName (getCurrentOverlayTarget → null before any fetch) and
// the mocked getRuntimeValue has no active map (getActiveMapName → null, so
// getTargetMapStatuses → null before any load), leaving the real
// spellOverlayService byte-inert — no network mocks needed and the picker
// renders deterministically. The armed-overlay auto-select face is pinned in
// SaveAttackAoeModal.overlay-auto-select.test.jsx.
// AreaEffectTargetModalBase is never mounted on this lane (no 'overlay-'
// targetName) — its lane lives in SaveAttackAoeModal.overlay.test.jsx.
// maxTargets: SaveAttackAoeModal never passes it to the picker mount
// (SaveAttackAoeModal.jsx:2196-2216), so the cap guard is intentionally NOT
// pinned here — pinning it would require fabricating a prop the host never
// sends. It lives in CreatureSelectionModal.test.jsx:289/:301.
// The confirmDisabled={dispatched} double-dispatch latch is owned by
// SaveAttackAoeModal.dispatch-guard.test.jsx; confirm-click payload resolution
// by damage-resolution/blocking-effects lanes. Here we pin the picker UI
// contract only.

// ── Mocked modules (data seams only) ──

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, resistances: [], immunities: [] },
      { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30 },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as allySelection from '../../../../hooks/useAllySelection.js';

// ── Test fixtures ──

const mockAction = {
  name: 'Fireball',
  automation: {
    scaling: { damage: '8d6' },
  },
};

const baseProps = {
  action: mockAction,
  playerStats: { name: 'Cleric1', level: 12 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

// getByText's default matcher only reads an element's OWN text nodes, and the
// buildPickerCopy head is split across the <strong>ability</strong> — match
// the <p>'s complete normalized textContent so the full sentence is pinned
// byte-exact, not a regex fragment.
const sentence = (text) => (_content, node) =>
  node?.tagName === 'P' && node.textContent.replace(/\s+/g, ' ').trim() === text;

const DEFAULT_NOTE = 'On a failed save, target takes 8d6 Fire damage. On a successful save, target takes half damage.';
const HEIGHTEN_NOTE = `${DEFAULT_NOTE} Heightened Spell: one target will have disadvantage.`;

function rowFor(name) {
  return [...document.querySelectorAll('.secondary-target-row')]
    .find(row => row.textContent.includes(name));
}

function checkboxFor(name) {
  return rowFor(name).querySelector('input[type="checkbox"]');
}

function radioFor(name) {
  return rowFor(name).querySelector('input[type="radio"]');
}

// ── Tests ──

describe('SaveAttackAoeModal - CreatureSelectionModal picker lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-baseline every override: clearAllMocks keeps mockReturnValue set by
    // a previous test (the careful-ally list must not bleed forward).
    allySelection.getAllyList.mockReturnValue(null);
  });

  it('renders the picker with action title, save copy, damage note, and one row per combatant', () => {
    render(<SaveAttackAoeModal {...makeProps({ saveType: 'CON', saveDc: 18 })} />);

    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(document.querySelector('.sp-header .fa-bomb')).toBeInTheDocument();
    // buildPickerCopy: head + default half-damage note, both byte-exact.
    expect(screen.getByText(sentence('Select creatures in the area of effect. Each must make a CON saving throw (DC 18).'))).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_NOTE)).toBeInTheDocument();
    // Every combatant selectable; confirm starts disabled with a zero count.
    for (const name of ['Goblin A', 'Goblin B', 'Player One']) {
      expect(rowFor(name)).toBeInTheDocument();
      expect(checkboxFor(name)).not.toBeChecked();
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    // Host toPickerTargets threads the combatSummary HP pair into monster rows;
    // the player row reads the (here empty) character buckets and honestly
    // drops its HP chip — pinning the host mapping, not the picker's law.
    expect(rowFor('Goblin A').querySelector('.secondary-target-hp')?.textContent).toBe('(50% HP)');
    expect(rowFor('Goblin B').querySelector('.secondary-target-hp')?.textContent).toBe('(30% HP)');
    expect(rowFor('Player One').querySelector('.secondary-target-hp')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fireball (0)' })).toBeDisabled();
  });

  it('tracks selection in the confirm button and Skip closes the modal', () => {
    const onClose = vi.fn();
    render(<SaveAttackAoeModal {...makeProps({ onClose })} />);

    fireEvent.click(checkboxFor('Goblin A'));
    expect(checkboxFor('Goblin A')).toBeChecked();
    // Real modal stamps the highlight class on the selected row (CreatureSelectionModal.jsx:45).
    expect(rowFor('Goblin A').className).toContain('secondary-target-selected');
    expect(rowFor('Goblin B').className).not.toContain('secondary-target-selected');
    expect(screen.getByRole('button', { name: 'Fireball (1)' })).not.toBeDisabled();

    fireEvent.click(checkboxFor('Goblin A'));
    expect(checkboxFor('Goblin A')).not.toBeChecked();
    expect(rowFor('Goblin A').className).not.toContain('secondary-target-selected');
    expect(screen.getByRole('button', { name: 'Fireball (0)' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('badges careful-protected allies and heighten radios only when the metamagics are armed', () => {
    allySelection.getAllyList.mockReturnValue(['Goblin A']);

    // Disarmed face: no badges, no radios, and the ally seam is never read —
    // byte-inert default.
    const { unmount } = render(<SaveAttackAoeModal {...makeProps()} />);
    expect(screen.queryByText('✓ Careful Spell protected')).not.toBeInTheDocument();
    expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
    expect(allySelection.getAllyList).not.toHaveBeenCalled();
    unmount();

    render(<SaveAttackAoeModal {...makeProps({ metamagicCareful: true, metamagicHeighten: true })} />);
    // Ally list is keyed by the caster name threaded from host props.
    expect(allySelection.getAllyList).toHaveBeenCalledWith('Cleric1');
    expect(rowFor('Goblin A').textContent).toContain('✓ Careful Spell protected');
    expect(rowFor('Goblin B').textContent).not.toContain('✓ Careful Spell protected');
    expect(rowFor('Player One').textContent).not.toContain('✓ Careful Spell protected');
    expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(3);
  });

  it('threads heighten selection through the host state into the real modal radio group', () => {
    render(<SaveAttackAoeModal {...makeProps({ metamagicHeighten: true })} />);

    // Armed heighten also extends the picker note (buildPickerCopy suffix).
    expect(screen.getByText(HEIGHTEN_NOTE)).toBeInTheDocument();

    // Host threads heightenTarget/setHeightenTarget (SaveAttackAoeModal.jsx:2207-2209):
    // clicking Goblin B's radio marks ONLY that row's radio checked via host state.
    expect(rowFor('Goblin B').textContent).toContain('Heighten');
    fireEvent.click(radioFor('Goblin B'));
    expect(radioFor('Goblin B')).toBeChecked();
    expect(radioFor('Goblin A')).not.toBeChecked();
    expect(radioFor('Player One')).not.toBeChecked();

    // Choosing a different target moves the single heighten stamp (radio semantics
    // plus host state — no second radio may stay checked).
    fireEvent.click(radioFor('Goblin A'));
    expect(radioFor('Goblin A')).toBeChecked();
    expect(radioFor('Goblin B')).not.toBeChecked();
  });
});
