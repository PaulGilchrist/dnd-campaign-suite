// @maintained-by-ai 2026-11-27 trim pass: 35 → 17 blocks, same-branch consolidation
// Behavior-focused tests for AllySelectionModal: what the user sees and can do
// (select via checkbox or row, bulk actions, self-only preset, confirm payload
// threading), queried through accessible roles/checkbox names. Class probes only
// where there is no accessible surface (decorative <i> icon fallback) and the
// label→input wrapping (the wide-row click mechanism).
// Lane split: Escape, pure-backdrop dismiss, the drag guard, the Cancel button's
// inert-close witness, and the confirm-only-writes single-select witness are
// OWNED by AllySelectionModal.dismiss.test.jsx (2026-11-23) — not restated here.
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllySelectionModal from './AllySelectionModal.jsx';

describe('AllySelectionModal', () => {
  // Shape mirrors the real producer (useAllyEditor.js:41 maps
  // {name, type, currentHp, maxHp} off combatSummary creatures).
  const creatures = [
    { name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 20 },
    { name: 'Hero', type: 'player', currentHp: 30, maxHp: 30 },
    { name: 'Orc', type: 'npc', currentHp: 0, maxHp: 25 },
  ];

  let onConfirm;
  let onCancel;

  beforeEach(() => {
    onConfirm = vi.fn();
    onCancel = vi.fn();
  });

  function renderModal(overrides = {}) {
    return render(
      <AllySelectionModal
        title="Select Allies"
        icon="fa-shield-halved"
        creatures={creatures}
        currentAllies={[]}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...overrides}
      />
    );
  }

  // Exact accessible name pinned by the CI 2026-11-03 a11y lane.
  const checkboxFor = name => screen.getByRole('checkbox', { name: `Select ${name}` });
  const selectedCount = () => screen.getByText(/\d+ selected/);
  const hint = () => screen.queryByText('Select only yourself to trust no one.');
  const selfChip = () => screen.queryByRole('button', { name: /Self only \(hostile\)/i });

  // ── Rendering ──

  it('renders the provided title and falls back to the default title and shield icon', () => {
    const { unmount } = renderModal({ title: 'Trust Circle' });
    expect(screen.getByText('Trust Circle')).toBeInTheDocument();

    // Re-harness for the fallback branch: unmount before the second render.
    unmount();
    renderModal({ title: undefined, icon: undefined });

    expect(screen.getByText('Select Allies')).toBeInTheDocument();
    // The decorative <i> has no accessible role, so a class probe is the only
    // witness for the `icon || 'fa-shield-halved'` fallback branch.
    expect(document.querySelector('.sp-header .fa-shield-halved')).toBeInTheDocument();
  });

  it('lists every creature as a named checkbox with its type label', () => {
    renderModal();

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    for (const name of ['Goblin', 'Hero', 'Orc']) {
      expect(checkboxFor(name)).toBeInTheDocument();
    }
    // closest('label') is the wrapping-row association, not a class-internals probe.
    expect(within(checkboxFor('Hero').closest('label')).getByText('(Player)')).toBeInTheDocument();
    expect(within(checkboxFor('Goblin').closest('label')).getByText('(NPC)')).toBeInTheDocument();
    expect(within(checkboxFor('Orc').closest('label')).getByText('(NPC)')).toBeInTheDocument();
  });

  it('shows rounded HP percentages for non-player creatures', () => {
    renderModal({
      creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 20 },
        // 2/3 distinguishes Math.round (67) from a Math.floor mutant (66).
        { name: 'Slick', type: 'npc', currentHp: 2, maxHp: 3 },
      ],
    });

    expect(within(checkboxFor('Goblin').closest('label')).getByText('(75% HP)')).toBeInTheDocument();
    expect(within(checkboxFor('Slick').closest('label')).getByText('(67% HP)')).toBeInTheDocument();
  });

  it('hides the HP readout for players and when an HP bound is missing', () => {
    renderModal({
      creatures: [
        { name: 'Hero', type: 'player', currentHp: 30, maxHp: 30 },
        // One falsy arm of the `currentHp != null && maxHp != null` guard is
        // enough — the other falsy variants take the same branch.
        { name: 'NoMax', type: 'npc', currentHp: 10 },
      ],
    });

    expect(checkboxFor('Hero').closest('label')).not.toHaveTextContent(/HP/);
    expect(checkboxFor('NoMax').closest('label')).not.toHaveTextContent(/HP/);
  });

  it('shows an empty-state note and no checkboxes or hint when no creatures are provided', () => {
    renderModal({ creatures: [] });

    expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    // The `creatures.length > 0` arm of the hint guard: no empty escape hatch
    // to advertise when there is nothing to select.
    expect(hint()).not.toBeInTheDocument();
  });

  // ── Selection ──

  it('a checkbox click selects, a second click deselects, feeding the count', () => {
    renderModal();

    expect(selectedCount()).toHaveTextContent('0 selected');

    fireEvent.click(checkboxFor('Goblin'));
    expect(checkboxFor('Goblin')).toBeChecked();
    expect(selectedCount()).toHaveTextContent('1 selected');

    fireEvent.click(checkboxFor('Goblin'));
    expect(checkboxFor('Goblin')).not.toBeChecked();
    expect(selectedCount()).toHaveTextContent('0 selected');
  });

  it('clicking the row name text toggles the checkbox (wide-row click UX)', async () => {
    const user = userEvent.setup();
    renderModal();

    // The label wraps the input, so clicking the name activates the checkbox —
    // the mechanism behind the whole-row target users actually hit.
    await user.click(screen.getByText('Goblin'));
    expect(checkboxFor('Goblin')).toBeChecked();

    await user.click(screen.getByText('Goblin'));
    expect(checkboxFor('Goblin')).not.toBeChecked();
  });

  it('Select All checks every row and Clear All empties them', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).toBeChecked());
    expect(selectedCount()).toHaveTextContent('3 selected');

    fireEvent.click(screen.getByRole('button', { name: /Clear All/i }));
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).not.toBeChecked());
    expect(selectedCount()).toHaveTextContent('0 selected');
  });

  it('pre-selects only the allies that appear in the creature list', () => {
    renderModal({ currentAllies: ['Goblin', 'Orc'] });

    expect(checkboxFor('Goblin')).toBeChecked();
    expect(checkboxFor('Orc')).toBeChecked();
    expect(checkboxFor('Hero')).not.toBeChecked();
    expect(selectedCount()).toHaveTextContent('2 selected');
  });

  it('drops stale currentAllies names from the count and the confirm payload', () => {
    renderModal({
      creatures: [{ name: 'Goblin', type: 'npc' }],
      currentAllies: ['Goblin', 'BanishedGhost'],
    });

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(checkboxFor('Goblin')).toBeChecked();
    expect(selectedCount()).toHaveTextContent('1 selected');

    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies \(1\)/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Goblin']);
  });

  // ── Self-only hint lifecycle + Confirm gating (one conditional branch:
  // selected.length === 0 && creatures.length > 0; the seeded-hidden and
  // re-show faces are the same branch as the transitions proven here) ──

  it('shows the self-only hint beside the disabled Confirm at 0, hides it while any ally is selected, re-shows when cleared', () => {
    renderModal();

    expect(hint()).toBeVisible();
    expect(screen.getByRole('button', { name: /Confirm Allies \(0\)/ })).toBeDisabled();

    fireEvent.click(checkboxFor('Goblin'));
    expect(hint()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Allies \(1\)/ })).not.toBeDisabled();

    fireEvent.click(checkboxFor('Goblin'));
    expect(hint()).toBeVisible();
    expect(screen.getByRole('button', { name: /Confirm Allies \(0\)/ })).toBeDisabled();
  });

  // The old "does not confirm when nothing is selected" forced-click-on-disabled
  // pin was removed: React suppresses onClick through disabled buttons in jsdom
  // (probe-verified #1920/#1921), so handleConfirm's empty-guard is unreachable
  // from the UI — an unreachable-defensive-branch test (#1896).

  // ── Confirm payload ──

  it('confirms exactly the selected names in list order', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));
    fireEvent.click(checkboxFor('Hero')); // deselect one

    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies \(2\)/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1); // double-commit detector
    expect(onConfirm).toHaveBeenCalledWith(['Goblin', 'Orc']);
  });

  // ── "Self only (hostile)" one-click preset (LZ backlog 2026-11-11) ──

  it('renders the preset chip when selfName is a candidate in the list', () => {
    renderModal({ selfName: 'Hero' });

    expect(selfChip()).toBeInTheDocument();
  });

  it('hides the preset chip when selfName is absent or not a candidate', () => {
    // Both faces are falsy arms of the one `!!selfName && creatures.some(...)`
    // guard — same-branch deletion keeps them as one case.
    const { unmount } = renderModal();
    expect(selfChip()).not.toBeInTheDocument();

    unmount();
    renderModal({ selfName: 'BanishedGhost' });
    expect(selfChip()).not.toBeInTheDocument();
  });

  it('preset overwrites any prior multi-select with exactly self', () => {
    // Strictly stronger than the from-0 face (which also merely asserted the
    // disabled→enabled flip already pinned in the hint-lifecycle test).
    renderModal({ selfName: 'Hero', currentAllies: ['Goblin', 'Orc'] });

    // Whatever the prior state (even Select All), one click resets to self only.
    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));
    fireEvent.click(selfChip());

    expect(checkboxFor('Hero')).toBeChecked();
    expect(checkboxFor('Goblin')).not.toBeChecked();
    expect(checkboxFor('Orc')).not.toBeChecked();
    expect(selectedCount()).toHaveTextContent('1 selected');
  });

  it('preset → Confirm emits exactly [self] (betrayal flip in two clicks)', () => {
    renderModal({ selfName: 'Orc' });

    fireEvent.click(selfChip());
    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies \(1\)/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['Orc']);
  });

  // Cancel and preset→Cancel inert-close witnesses live in
  // AllySelectionModal.dismiss.test.jsx (Select All draft + Cancel → onCancel
  // once, onConfirm never). Not restated here.

  // ── Keyboard a11y (CI 2026-11-03: rows are real checkboxes, Space-toggled) ──

  it('Space on a focused row toggles what Confirm Allies (n) counts', async () => {
    const user = userEvent.setup();
    renderModal();

    const goblin = checkboxFor('Goblin');
    goblin.focus();
    await user.keyboard(' ');
    expect(goblin).toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm Allies \(1\)/ })).toBeEnabled();

    await user.keyboard(' ');
    expect(goblin).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm Allies \(0\)/ })).toBeDisabled();
  });
});
