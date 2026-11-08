// @maintained-by-ai
// QA improve 2026-11-08 EL: unticking a selected custom:true magic-item row must
// arm the shared DeleteConfirmModal (role=dialog) instead of instantly destroying
// the fully-authored item; catalog rows keep the instant selection-only untick.
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepMagicItems from './WizardStepMagicItems.jsx';

const BAG_OF_HOLDING = {
  index: 'bag_of_holding',
  name: 'Bag of Holding',
  type: 'Wondrous Item',
  rarity: 'uncommon',
  requiresAttunement: false,
  description: '<p>Wondrous item, Uncommon</p>',
};
const STORMCALLER = {
  name: 'Stormcaller Blade',
  type: 'Weapon',
  rarity: 'rare',
  requiresAttunement: true,
  description: 'A sentient longsword that hums before a storm.',
  custom: true,
};

const magicItemsProps = ({ selected = [], allItems = [BAG_OF_HOLDING] } = {}) => ({
  stepNumber: 15,
  formData: { inventory: { magicItems: selected } },
  allMagicItems: allItems,
  ruleset: '5e',
  onArrayFieldChange: vi.fn(),
});

const checkboxFor = (name) =>
  screen.getByText(name).closest('.magic-item').querySelector('.list-item-checkbox-trigger');

describe('WizardStepMagicItems — custom-item untick guard', () => {
  let props;

  beforeEach(() => {
    props = magicItemsProps({ selected: ['Bag of Holding', STORMCALLER] });
    render(<WizardStepMagicItems {...props} />);
  });

  // AC1: untick does NOT destroy; the shared modal opens instead.
  it('opening: untick arms the DeleteConfirmModal without touching the draft', () => {
    fireEvent.click(checkboxFor('Stormcaller Blade'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Remove Custom Magic Item?')).toBeInTheDocument();
    expect(within(dialog).getByText(/"Stormcaller Blade"/)).toBeInTheDocument();
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    // Row stays checked while the prompt is up.
    expect(checkboxFor('Stormcaller Blade').className).toContain('checked');
  });

  // AC2: Cancel = zero data loss — no write, row still checked and intact.
  it('cancel: closes the modal, keeps the custom row checked and unmodified', () => {
    fireEvent.click(checkboxFor('Stormcaller Blade'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    const row = screen.getByText('Stormcaller Blade').closest('.magic-item');
    expect(row.className).toContain('selected');
    expect(checkboxFor('Stormcaller Blade').className).toContain('checked');
    expect(within(row).getByText('custom')).toBeInTheDocument();
  });

  // AC5: re-ticking after a cancel re-arms the modal — never duplicates the row
  // or writes anything to the draft.
  it('cancel then re-tick: modal re-arms once, draft untouched, no duplicate', () => {
    fireEvent.click(checkboxFor('Stormcaller Blade'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(checkboxFor('Stormcaller Blade'));

    const dialogs = screen.queryAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    expect(screen.getAllByText('Stormcaller Blade')).toHaveLength(1);
  });

  // AC3: confirming removes the row exactly as the old instant untick did,
  // leaving the other selections alone.
  it('confirm: removes only the custom entry from the draft', () => {
    fireEvent.click(checkboxFor('Stormcaller Blade'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Remove' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onArrayFieldChange).toHaveBeenCalledTimes(1);
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('inventory.magicItems', ['Bag of Holding']);
  });

  // AC4: catalog rows are unchanged — instant deselect, no modal.
  it('catalog untick: deselects instantly with no confirm dialog', () => {
    fireEvent.click(checkboxFor('Bag of Holding'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onArrayFieldChange).toHaveBeenCalledTimes(1);
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('inventory.magicItems', [STORMCALLER]);
  });
});
