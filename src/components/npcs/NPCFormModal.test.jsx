// @maintained-by-ai 2026-11-26
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCFormModal from './NPCFormModal.jsx';
import { getDefaultFormData } from '../../services/npcs/npcFormUtils.js';

describe('NPCFormModal', () => {
  const callbacks = {
    setFormData: vi.fn(),
    onClose: vi.fn(),
    onReloadList: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onSaveAndAddToInitiative: vi.fn(),
  };

  // AC stays null in the app's default form until the GM fills in combat
  // stats, so this is the combat-ready variant used to trigger initiative.
  const combatReady = { armorClass: 15, hitPoints: '45' };

  // The component always calls setFormData with an updater function; this
  // records the form data the component is actually rendering so tests can
  // inspect the result of that updater deterministically.
  let currentFormData;

  const renderModal = (formOverrides = {}, props = {}) => {
    currentFormData = getDefaultFormData(formOverrides);
    return render(
      <NPCFormModal
        formData={currentFormData}
        {...callbacks}
        {...props}
      />
    );
  };

  const appliedUpdate = () => {
    const [updater] = callbacks.setFormData.mock.calls.at(-1) ?? [];
    expect(updater).toBeDefined();
    return typeof updater === 'function' ? updater(currentFormData) : updater;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Header ─────────────────────────────────────────────────────────

  it.each([
    ['New NPC', undefined],
    ['Edit NPC', { name: 'Gandalf' }],
  ])('renders the %s heading', (heading, editingNPC) => {
    renderModal({}, { editingNPC });
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  // ── Conflict recovery banner (409 "Reload list") ───────────────────

  describe('Conflict recovery banner', () => {
    const conflictCopy =
      'NPC "Marta Copperkettle" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

    it('renders the conflict copy verbatim with a working Reload list button', () => {
      renderModal({}, { error: conflictCopy, errorConflict: true });
      expect(screen.getByText(conflictCopy)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
      expect(callbacks.onReloadList).toHaveBeenCalledTimes(1);
    });

    // The Reload list button must never render in a state where it would be
    // dead: only 409 conflicts with a wired handler get the one-click lane.
    // (The parent's reload-then-reseed wiring is pinned in
    // NPCs.stale-list-recovery.test.jsx; the button's CSS tier in
    // NPCs.kit-classes.test.jsx.)
    it.each([
      ['a non-conflict error', { error: 'An NPC with that name already exists' }],
      ['a conflict with no onReloadList handler wired', { error: conflictCopy, errorConflict: true, onReloadList: undefined }],
    ])('shows the error text but omits Reload list for %s', (_label, props) => {
      renderModal({}, props);
      expect(screen.getByText(props.error)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
    });
  });

  // ── Avatar Section ─────────────────────────────────────────────────

  describe('Avatar Section', () => {
    it.each([
      ['a data URI image', { image: 'data:image/png;base64,abc', imageName: 'gandalf.png' }],
      ['an image path', { imagePath: '/campaigns/test/npc.png' }],
    ])(
      'shows a working avatar and Remove button when %s is set',
      (_label, imageData) => {
        renderModal({ name: 'Gandalf', ...imageData });
        expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Gandalf' }));
        expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();
      }
    );

    it('hides Remove and keeps the avatar static when there is no image', () => {
      renderModal({ name: 'Gandalf' });
      expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Gandalf' })).not.toBeInTheDocument();
    });

    it('clears image, imageName, and imagePath when Remove is clicked', () => {
      renderModal({ image: 'data:image/png;base64,abc', imagePath: '/old/path.png' });
      fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
      expect(appliedUpdate()).toMatchObject({ image: '', imageName: '', imagePath: '' });
    });
  });

  // ── Tabs ───────────────────────────────────────────────────────────

  describe('Tabs', () => {
    const roleplayTab = () => screen.getByRole('button', { name: /Roleplay/ });
    const statsTab = () => screen.getByRole('button', { name: /Stats/ });
    const roleplayContent = () => screen.getByLabelText('Race').closest('.npcs-roleplay-tab');
    const statsContent = () => screen.getByText('AC').closest('.npcs-stats-tab');

    const assertRoleplayVisible = () => {
      expect(roleplayTab()).toHaveClass('npcs-tab-active');
      expect(roleplayContent()).not.toHaveClass('npcs-tab-hidden');
      expect(statsTab()).not.toHaveClass('npcs-tab-active');
      expect(statsContent()).toHaveClass('npcs-tab-hidden');
    };

    it('defaults to the roleplay tab', () => {
      renderModal();
      assertRoleplayVisible();
    });

    it('opens the stats tab when initialTab="stats"', () => {
      renderModal({}, { initialTab: 'stats' });
      expect(statsTab()).toHaveClass('npcs-tab-active');
      expect(statsContent()).not.toHaveClass('npcs-tab-hidden');
    });

    it('switches tabs back and forth when clicked', () => {
      renderModal();
      fireEvent.click(statsTab());
      expect(statsTab()).toHaveClass('npcs-tab-active');
      expect(statsContent()).not.toHaveClass('npcs-tab-hidden');
      expect(roleplayContent()).toHaveClass('npcs-tab-hidden');
      fireEvent.click(roleplayTab());
      assertRoleplayVisible();
    });
  });

  // ── Name Field ─────────────────────────────────────────────────────

  describe('Name Field', () => {
    it('reports name edits through setFormData', () => {
      renderModal();
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Gandalf' } });
      expect(appliedUpdate()).toMatchObject({ name: 'Gandalf' });
    });

    it('displays a pre-filled name and focuses the input on mount', () => {
      renderModal({ name: 'Gandalf' });
      expect(screen.getByLabelText(/Name/)).toHaveValue('Gandalf');
      expect(screen.getByLabelText(/Name/)).toHaveFocus();
    });
  });

  // ── Footer Buttons ─────────────────────────────────────────────────

  describe('Footer Buttons', () => {
    it.each(['Close', 'Cancel'])('calls onClose when %s is clicked', (name) => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name }));
      expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSave when Save is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(callbacks.onSave).toHaveBeenCalledTimes(1);
    });

    it('disables action buttons when the disabled prop is true', () => {
      renderModal(combatReady, { disabled: true });
      expect(screen.getByRole('button', { name: /Save$/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Save & Add to Initiative/ })).toBeDisabled();
    });

    it('shows a disabled Saving… button and blocks Cancel while saving', () => {
      renderModal({}, { saving: true });
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
  });

  // ── Delete Button ──────────────────────────────────────────────────

  describe('Delete Button', () => {
    it('offers Delete only when editing, and calls onDelete on click', () => {
      const { unmount } = renderModal();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      unmount();

      renderModal({}, { editingNPC: { name: 'Gandalf' } });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
    });

    it('replaces Delete with a disabled Deleting… while deleting', () => {
      renderModal({}, { editingNPC: { name: 'Gandalf' }, deleting: true });
      expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });

  // ── Save & Add to Initiative ───────────────────────────────────────
  // The AC/HP readiness matrix itself is pinned in
  // src/services/encounters/npcStatBlockUtils.test.js; these tests only pin
  // that the modal wires the gate and the callback into the button.

  describe('Save & Add to Initiative', () => {
    const initiativeButton = () => screen.getByRole('button', { name: /Save & Add to Initiative/ });

    it('renders for a combat-ready NPC and calls onSaveAndAddToInitiative on click', () => {
      renderModal(combatReady);
      fireEvent.click(initiativeButton());
      expect(callbacks.onSaveAndAddToInitiative).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a non-numeric armorClass', { overrides: { armorClass: '15' } }],
      ['no onSaveAndAddToInitiative handler', { overrides: {}, props: { onSaveAndAddToInitiative: undefined } }],
    ])('does not render with %s', (_label, { overrides, props = {} }) => {
      renderModal({ ...combatReady, ...overrides }, props);
      expect(screen.queryByRole('button', { name: /Save & Add to Initiative/ })).not.toBeInTheDocument();
    });
  });
});
