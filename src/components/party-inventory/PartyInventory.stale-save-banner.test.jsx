// @maintained-by-ai 2026-11-24: 2026-11-24
// Stale-save (409) face for the item EDIT lane (QA backlog 2026-11-24: the
// native alert "…was deleted elsewhere — this window now shows the current
// list; your edit was NOT saved." is retired onto an IN-MODAL error banner
// riding the Quests-planner idiom .quests-form-error → .pi-form-error).
// OWNED HERE: an update intent that 409s REOPENS the editor seeded with the
// submitted draft, the honest sentence renders inside the modal
// (role="alert", .pi-form-error — not the root strip, never a native alert),
// the merged server doc converges underneath (the vanished row is gone), and
// Cancel closes cleanly with the converged list — the re-seed path. The
// root-strip legs (setQty 409, delete races, non-409s) are pinned by
// PartyInventory.item-intent-lane / delete-item-log / failed-save-reconcile.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockApplyItemIntent = vi.fn();

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  applyItemIntent: (...args) => mockApplyItemIntent(...args),
  adjustCurrency: vi.fn(),
  transferInventory: vi.fn(),
}));

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn().mockResolvedValue([]),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
  characters: [],
};

const lantern = { id: 'a1', name: 'QA Lantern', quantity: 1, description: 'steady flame' };
const CURRENCY = { pp: 0, gp: 11, sp: 0, cp: 1 };

const HONEST_COPY =
  'Party item "QA Ghost Lantern" was deleted elsewhere — this window now shows the current list; your edit was NOT saved.';

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

describe('PartyInventory stale-save 409 → in-modal banner (Quests-planner idiom)', () => {
  let alertSpy = null;
  let consoleSpy = null;

  beforeEach(() => {
    mockLoadInventory.mockReset().mockResolvedValue({ currency: { ...CURRENCY }, items: [{ ...lantern }] });
    mockApplyItemIntent.mockReset().mockImplementation(async () => {
      // Tab B already deleted the row: the server refuses the update with a
      // 409 carrying its CURRENT merged doc (the lantern is gone).
      const error = new Error(
        'Party item "QA Ghost Lantern" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.'
      );
      error.status = 409;
      error.inventory = { currency: { ...CURRENCY }, items: [] };
      throw error;
    });
    // Native alert/confirm on this path are regressions — make them loud.
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {
      throw new Error('native window.alert fired on the stale-save path');
    });
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  const openEditorAndSave = async () => {
    fireEvent.click(screen.getByLabelText('Edit "QA Lantern"'));
    const modal = (await screen.findByText('Edit QA Lantern')).closest('.pi-modal');
    fireEvent.change(within(modal).getByLabelText(/Name/), { target: { value: 'QA Ghost Lantern' } });
    fireEvent.click(within(modal).getByRole('button', { name: /Save/ }));
  };

  it('the 409 reopens the editor with the honest sentence in-modal — the server sentence\'s "reload" advice stays trimmed', async () => {
    await renderReady();
    await openEditorAndSave();

    // Editor reopened seeded with the submitted draft, banner inside it.
    const modal = await screen.findByText('Edit QA Ghost Lantern');
    const banner = modal.closest('.pi-modal').querySelector('.pi-form-error');
    expect(banner).not.toBeNull();
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toBe(HONEST_COPY);
    // The trimmed copy names the loss and the live convergence — no dead
    // "reload the list" advice (merged-doc adoption is already rendered).
    expect(banner.textContent).not.toMatch(/reload the list/i);
    // Never a native alert, and never the generic root strip for this face.
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert', { hidden: true })).not.toBeNull();
    const rootStrip = document.querySelector('.pi-action-error');
    expect(rootStrip).toBeNull();
  });

  it('the merged truth converges under the open banner — ghost row gone, zero phantom writes', async () => {
    await renderReady();
    await openEditorAndSave();

    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1));
    // The list UNDER the reopened editor already shows the current server
    // truth: the deleted row is gone with no ghost, and nothing re-POSTed.
    expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'update',
      item: { id: 'a1', name: 'QA Ghost Lantern', quantity: 1, description: 'steady flame' },
    });
    // Cancel out: editor closes, converged (empty) list stands, no second write.
    const modal = screen.getByText('Edit QA Ghost Lantern').closest('.pi-modal');
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Edit QA Ghost Lantern')).toBeNull());
    expect(screen.queryByText('QA Lantern')).toBeNull();
    expect(screen.queryByText('QA Ghost Lantern')).toBeNull();
    expect(mockApplyItemIntent).toHaveBeenCalledTimes(1);
  });

  it('re-saving the reopened draft pays the 409 again with the SAME single banner (no stacking)', async () => {
    await renderReady();
    await openEditorAndSave();
    await screen.findByText('Edit QA Ghost Lantern');

    const modal = screen.getByText('Edit QA Ghost Lantern').closest('.pi-modal');
    fireEvent.click(within(modal).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(2));
    expect(document.querySelectorAll('.pi-form-error')).toHaveLength(1);
  });
});
