// @maintained-by-ai
// @improved-by-ai
// Behavior-focused tests for AllySelectionModal: what the user sees and can do
// (select via checkbox or row, bulk actions, confirm/cancel payloads), queried
// through accessible roles rather than CSS class internals.
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllySelectionModal from './AllySelectionModal.jsx';

describe('AllySelectionModal', () => {
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
    render(
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

  const checkboxFor = name => screen.getByRole('checkbox', { name: new RegExp(name, 'i') });
  const selectedCount = () => screen.getByText(/\d+ selected/);

  // ── Rendering ──

  it('shows the provided title in the header', () => {
    renderModal();

    expect(screen.getByText('Select Allies')).toBeInTheDocument();
  });

  it('falls back to a default title and shield icon when none are provided', () => {
    renderModal({ title: undefined, icon: undefined });

    expect(screen.getByText('Select Allies')).toBeInTheDocument();
    expect(document.querySelector('.sp-header .fa-shield-halved')).toBeInTheDocument();
  });

  it('lists every creature with its type label', () => {
    renderModal();

    expect(checkboxFor('Goblin')).toBeInTheDocument();
    expect(checkboxFor('Hero')).toBeInTheDocument();
    expect(checkboxFor('Orc')).toBeInTheDocument();
    expect(within(checkboxFor('Hero').closest('label')).getByText('(Player)')).toBeInTheDocument();
    expect(within(checkboxFor('Goblin').closest('label')).getByText('(NPC)')).toBeInTheDocument();
    expect(within(checkboxFor('Orc').closest('label')).getByText('(NPC)')).toBeInTheDocument();
  });

  it('shows rounded HP percentage for NPCs', () => {
    renderModal({ creatures: [{ name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 20 }] });

    expect(within(checkboxFor('Goblin').closest('label')).getByText('(75% HP)')).toBeInTheDocument();
  });

  it('rounds fractional HP percentages to whole numbers', () => {
    renderModal({ creatures: [{ name: 'Third', type: 'npc', currentHp: 1, maxHp: 3 }] });

    expect(within(checkboxFor('Third').closest('label')).getByText('(33% HP)')).toBeInTheDocument();
  });

  it('hides HP for player creatures', () => {
    renderModal();

    const heroRow = checkboxFor('Hero').closest('label');
    expect(heroRow).not.toHaveTextContent(/HP/);
  });

  it('hides HP when currentHp or maxHp is missing', () => {
    renderModal({
      creatures: [
        { name: 'NoCurrent', type: 'npc', maxHp: 20 },
        { name: 'NoMax', type: 'npc', currentHp: 10 },
        { name: 'NoHpAtAll', type: 'npc' },
      ],
    });

    for (const name of ['NoCurrent', 'NoMax', 'NoHpAtAll']) {
      expect(checkboxFor(name).closest('label')).not.toHaveTextContent(/HP/);
    }
  });

  it('shows an empty-state note when no creatures are provided', () => {
    renderModal({ creatures: [] });

    expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  // ── Selection ──

  it('selects a creature when its checkbox is clicked', () => {
    renderModal();

    expect(selectedCount()).toHaveTextContent('0 selected');

    fireEvent.click(checkboxFor('Goblin'));

    expect(checkboxFor('Goblin')).toBeChecked();
    expect(selectedCount()).toHaveTextContent('1 selected');
  });

  it('deselects a creature when its checkbox is clicked again', () => {
    renderModal({ currentAllies: ['Orc'] });

    fireEvent.click(checkboxFor('Orc'));

    expect(checkboxFor('Orc')).not.toBeChecked();
    expect(selectedCount()).toHaveTextContent('0 selected');
  });

  it('toggles selection when the creature name text is clicked', () => {
    renderModal();

    fireEvent.click(screen.getByText('Goblin'));
    expect(checkboxFor('Goblin')).toBeChecked();

    fireEvent.click(screen.getByText('Goblin'));
    expect(checkboxFor('Goblin')).not.toBeChecked();
  });

  it('selects every creature when Select All is clicked', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).toBeChecked());
    expect(selectedCount()).toHaveTextContent('3 selected');
  });

  it('deselects every creature when Clear All is clicked', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));
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

  it('ignores stale currentAllies names that are not in the creature list', () => {
    renderModal({
      creatures: [{ name: 'Goblin', type: 'npc' }],
      currentAllies: ['Goblin', 'BanishedGhost'],
    });

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(checkboxFor('Goblin')).toBeChecked();
    expect(selectedCount()).toHaveTextContent('1 selected');

    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies/i }));
    expect(onConfirm).toHaveBeenCalledWith(['Goblin']);
  });

  // ── Self-only "trust no one" hint ──

  const hint = () =>
    screen.queryByText(/Select only yourself to trust no one/i);

  it('shows the self-only hint while nothing is selected, beside the disabled Confirm', () => {
    renderModal();

    expect(hint()).toBeVisible();
    expect(screen.getByRole('button', { name: /Confirm Allies \(0\)/ })).toBeDisabled();
  });

  it('hides the self-only hint as soon as one ally is selected', () => {
    renderModal();
    expect(hint()).toBeInTheDocument();

    fireEvent.click(checkboxFor('Goblin'));

    expect(hint()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Allies \(1\)/ })).not.toBeDisabled();
  });

  it('re-shows the hint when the last selection is cleared', () => {
    renderModal({ currentAllies: ['Orc'] });
    expect(hint()).not.toBeInTheDocument();

    fireEvent.click(checkboxFor('Orc'));

    expect(hint()).toBeInTheDocument();
  });

  it('keeps the hint hidden when pre-selected allies are present', () => {
    renderModal({ currentAllies: ['Goblin', 'Orc'] });

    expect(hint()).not.toBeInTheDocument();
  });

  it('does not show the hint when there are no creatures to select', () => {
    renderModal({ creatures: [] });

    expect(hint()).not.toBeInTheDocument();
    expect(screen.getByText('No creatures available.')).toBeInTheDocument();
  });

  // ── Confirm ──

  it('disables confirm until at least one ally is selected', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /Confirm Allies \(0\)/ })).toBeDisabled();

    fireEvent.click(checkboxFor('Orc'));

    expect(screen.getByRole('button', { name: /Confirm Allies \(1\)/ })).not.toBeDisabled();
  });

  it('does not confirm when nothing is selected', () => {
    renderModal();

    // The button is disabled while empty; clicking it must be a no-op either way.
    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies \(0\)/ }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms exactly the selected names in list order', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));
    fireEvent.click(checkboxFor('Hero')); // deselect one

    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies \(2\)/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['Goblin', 'Orc']);
  });

  it('confirms the pre-selected allies without any further interaction', () => {
    renderModal({ currentAllies: ['Orc'] });

    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies \(1\)/ }));

    expect(onConfirm).toHaveBeenCalledWith(['Orc']);
  });

  // ── "Self only (hostile)" one-click preset (LZ backlog 2026-11-11) ──

  const selfChip = () =>
    screen.queryByRole('button', { name: /Self only \(hostile\)/i });

  it('renders the preset chip when selfName is a candidate in the list', () => {
    renderModal({ selfName: 'Hero' });

    expect(selfChip()).toBeInTheDocument();
  });

  it('hides the preset chip when selfName is not provided', () => {
    renderModal();

    expect(selfChip()).not.toBeInTheDocument();
  });

  it('hides the preset chip when selfName is not a candidate in the list', () => {
    renderModal({ selfName: 'BanishedGhost' });

    expect(selfChip()).not.toBeInTheDocument();
  });

  it('preset from the 0-selection state checks exactly self and enables Confirm (1)', () => {
    renderModal({ selfName: 'Goblin' });

    expect(screen.getByRole('button', { name: /Confirm Allies \(0\)/ })).toBeDisabled();

    fireEvent.click(selfChip());

    expect(checkboxFor('Goblin')).toBeChecked();
    expect(checkboxFor('Hero')).not.toBeChecked();
    expect(checkboxFor('Orc')).not.toBeChecked();
    expect(selectedCount()).toHaveTextContent('1 selected');
    expect(screen.getByRole('button', { name: /Confirm Allies \(1\)/ })).toBeEnabled();
  });

  it('preset overwrites any prior multi-select with exactly self', () => {
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

  it('preset → Cancel is inert (no confirm payload, cancel only)', () => {
    renderModal({ selfName: 'Goblin' });

    fireEvent.click(selfChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // ── Cancel ──

  it('cancels without confirming, even after selecting allies', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Checkbox role semantics (CI 2026-11-03 a11y: rows pinned as named
  // checkboxes, keyboard-toggled, feeding Confirm Allies (n)) ──

  it('exposes every row as a checkbox with an accessible name', () => {
    renderModal();

    expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Hero' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Orc' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('Space on a focused row toggles what Confirm Allies (n) counts', async () => {
    const user = userEvent.setup();
    renderModal();

    const goblin = screen.getByRole('checkbox', { name: 'Select Goblin' });
    expect(goblin).toBeEnabled(); // natively focusable — reachable via Tab

    goblin.focus();
    await user.keyboard(' ');
    expect(goblin).toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm Allies \(1\)/ })).toBeEnabled();

    await user.keyboard(' ');
    expect(goblin).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm Allies \(0\)/ })).toBeDisabled();
  });

  it('confirms a keyboard-toggled selection', async () => {
    const user = userEvent.setup();
    renderModal();

    screen.getByRole('checkbox', { name: 'Select Hero' }).focus();
    await user.keyboard(' ');

    await user.click(screen.getByRole('button', { name: /Confirm Allies \(1\)/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['Hero']);
  });
});
