// @maintained-by-ai: 2026-10-14
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

  describe('Header', () => {
    it.each([
      ['New NPC', undefined],
      ['Edit NPC', { name: 'Gandalf' }],
    ])('renders %s heading', (heading, editingNPC) => {
      renderModal({}, { editingNPC });
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    });

    it('calls onClose when the close button is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    });

    it('shows the error message when provided', () => {
      renderModal({}, { error: 'A character with this name already exists.' });
      expect(screen.getByText('A character with this name already exists.')).toBeInTheDocument();
    });
  });

  // ── Conflict recovery banner (409 "Reload list") ───────────────────

  describe('Conflict recovery banner', () => {
    const conflictCopy =
      'NPC "Marta Copperkettle" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

    it('renders the unchanged conflict copy with a Reload list button and reports the click', () => {
      renderModal({}, { error: conflictCopy, errorConflict: true, onReloadList: callbacks.onReloadList });
      // Existing copy untouched (criterion 1).
      expect(screen.getByText(conflictCopy)).toBeInTheDocument();
      const button = screen.getByRole('button', { name: 'Reload list' });
      fireEvent.click(button);
      expect(callbacks.onReloadList).toHaveBeenCalledTimes(1);
    });

    it('omits the Reload list button for a non-conflict error', () => {
      renderModal({}, { error: 'An NPC with that name already exists', onReloadList: callbacks.onReloadList });
      expect(screen.getByText('An NPC with that name already exists')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
    });

    it('omits the Reload list button when no onReloadList handler is wired', () => {
      renderModal({}, { error: conflictCopy, errorConflict: true, onReloadList: undefined });
      expect(screen.getByText(conflictCopy)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
    });
  });

  // ── Avatar Section ─────────────────────────────────────────────────

  describe('Avatar Section', () => {
    const imageVariants = [
      ['a data URI image', { image: 'data:image/png;base64,abc', imageName: 'gandalf.png' }],
      ['an image path', { imagePath: '/campaigns/test/npc.png' }],
    ];

    it.each(imageVariants)(
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
      expect(callbacks.setFormData).toHaveBeenCalledTimes(1);
      expect(appliedUpdate()).toMatchObject({ name: 'Gandalf' });
    });

    it('displays a pre-filled name and focuses the input on mount', () => {
      renderModal({ name: 'Gandalf' });
      const input = screen.getByLabelText(/Name/);
      expect(input).toHaveValue('Gandalf');
      expect(screen.getByLabelText(/Name/)).toHaveFocus();
    });
  });

  // ── Footer Buttons ─────────────────────────────────────────────────

  describe('Footer Buttons', () => {
    it('calls onClose when Cancel is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSave when Save is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(callbacks.onSave).toHaveBeenCalledTimes(1);
    });

    it('disables Save when the disabled prop is true', () => {
      renderModal({}, { disabled: true });
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
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
    it('is hidden when creating a new NPC', () => {
      renderModal();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('renders when editing and calls onDelete on click', () => {
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

  describe('Save & Add to Initiative', () => {
    const initiativeButton = () => screen.getByRole('button', { name: /Save & Add to Initiative/ });

    it('renders when the NPC is combat-ready', () => {
      renderModal(combatReady);
      expect(initiativeButton()).toBeInTheDocument();
    });

    it.each([
      ['no armorClass', { armorClass: null }],
      ['non-numeric armorClass', { armorClass: '15' }],
      ['empty hitPoints', { hitPoints: '' }],
      ['zero hitPoints', { hitPoints: 0 }],
    ])('does not render when a combat-ready NPC lacks %s', (_label, overrides) => {
      renderModal({ ...combatReady, ...overrides });
      expect(screen.queryByRole('button', { name: /Save & Add to Initiative/ })).not.toBeInTheDocument();
    });

    it('does not render when the callback is missing', () => {
      renderModal(combatReady, { onSaveAndAddToInitiative: undefined });
      expect(screen.queryByRole('button', { name: /Save & Add to Initiative/ })).not.toBeInTheDocument();
    });

    it('calls onSaveAndAddToInitiative when clicked', () => {
      renderModal(combatReady);
      fireEvent.click(initiativeButton());
      expect(callbacks.onSaveAndAddToInitiative).toHaveBeenCalledTimes(1);
    });

    it('is disabled when the disabled prop is true', () => {
      renderModal(combatReady, { disabled: true });
      expect(initiativeButton()).toBeDisabled();
    });
  });
});
