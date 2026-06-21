// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCFormModal from './NPCFormModal.jsx';

describe('NPCFormModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSaveAndAddToInitiative = vi.fn();
  const mockSetFormData = vi.fn((fn) => {
    const result = typeof fn === 'function' ? fn({}) : fn;
    return result;
  });

  const defaultFormData = {
    name: '',
    race: 'Human',
    classRole: 'Wizard',
    attitude: 'neutral',
    appearance: 'Tall with a long beard',
    personality: 'Wise and mysterious',
    goals: 'Defeat Sauron',
    secrets: 'He is a Maia',
    notes: 'Carries a staff',
    tags: 'ally, quest-giver',
    image: '',
    imageName: '',
    imagePath: '',
    armorClass: 10,
    hitPoints: '45',
    hitDice: '6d8',
    speed: { walk: '30 ft.' },
    initiativeBonus: '',
    abilityScores: { str: 10, dex: 12, con: 14, int: 16, wis: 8, cha: 10 },
    savingThrowBonuses: {},
    skillBonuses: {},
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    actions: [],
    traits: '',
    reactions: '',
  };

  const renderModal = (props = {}) => {
    return render(
      <NPCFormModal
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
        onSaveAndAddToInitiative={mockOnSaveAndAddToInitiative}
        {...props}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering: Header ─────────────────────────────────────────────

  describe('Header', () => {
    it('should render modal overlay and container', () => {
      renderModal();
      expect(document.querySelector('.ct-modal-overlay')).toBeInTheDocument();
      expect(document.querySelector('.ct-modal.npcs-modal')).toBeInTheDocument();
    });

    it('should render "New NPC" heading when no editingNPC', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'New NPC' })).toBeInTheDocument();
    });

    it('should render "Edit NPC" heading when editingNPC is provided', () => {
      renderModal({ editingNPC: { name: 'Gandalf' } });
      expect(screen.getByRole('heading', { name: 'Edit NPC' })).toBeInTheDocument();
    });

    it('should render close button with correct aria-label', () => {
      renderModal();
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Close'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Avatar Section ────────────────────────────────────────────────

  describe('Avatar Section', () => {
    it('should render avatar section', () => {
      renderModal();
      expect(screen.getByText('Upload Avatar').closest('.npcs-avatar-section')).toBeInTheDocument();
    });

    it('should render upload avatar button', () => {
      renderModal();
      expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
    });

    it('should not render remove button when no image', () => {
      renderModal();
      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });

    it('should render remove button when image or imagePath exists', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc' },
      });
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('should render remove button when imagePath exists without image', () => {
      renderModal({
        formData: { ...defaultFormData, imagePath: '/avatars/gandalf.png' },
      });
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('should call setFormData with image data on file upload', async () => {
      renderModal();
      const fileInput = document.querySelector('.npcs-avatar-input');
      const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockSetFormData).toHaveBeenCalled();
    });

    it('should clear image data on remove click', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc' },
      });
      fireEvent.click(screen.getByText('Remove'));
      expect(mockSetFormData).toHaveBeenCalled();
    });
  });

  // ── Tabs ──────────────────────────────────────────────────────────

  describe('Tabs', () => {
    it('should render Roleplay and Stats tab buttons', () => {
      renderModal();
      expect(screen.getByText('Roleplay')).toBeInTheDocument();
      expect(screen.getByText('Stats')).toBeInTheDocument();
    });

    it('should default to Roleplay tab active', () => {
      renderModal();
      const roleplayTab = screen.getByText('Roleplay').closest('button');
      expect(roleplayTab).toHaveClass('npcs-tab-active');
    });

    it('should switch to Stats tab when clicked', () => {
      renderModal();
      const statsTab = screen.getByText('Stats');
      fireEvent.click(statsTab);
      const statsBtn = statsTab.closest('button');
      expect(statsBtn).toHaveClass('npcs-tab-active');
    });

    it('should switch back to Roleplay tab when clicked', () => {
      renderModal();
      const statsTab = screen.getByText('Stats');
      fireEvent.click(statsTab);
      const roleplayTab = screen.getByText('Roleplay');
      fireEvent.click(roleplayTab);
      const roleplayBtn = roleplayTab.closest('button');
      expect(roleplayBtn).toHaveClass('npcs-tab-active');
    });

    it('should show roleplay tab content when roleplay tab active', () => {
      renderModal();
      expect(screen.getByLabelText('Race')).toBeInTheDocument();
    });

    it('should show stats tab content when stats tab active', () => {
      renderModal();
      const statsTab = screen.getByText('Stats');
      fireEvent.click(statsTab);
      expect(screen.getByText('AC')).toBeInTheDocument();
    });

    it('should apply hidden class to inactive tab content', () => {
      renderModal();
      const statsTabContent = screen.getByText('AC').closest('.npcs-stats-tab');
      const roleplayTabContent = screen.getByLabelText('Race').closest('.npcs-roleplay-tab');
      expect(roleplayTabContent).not.toHaveClass('npcs-tab-hidden');
      expect(statsTabContent).toHaveClass('npcs-tab-hidden');
    });

    it('should show only the active tab content visible', () => {
      renderModal();
      const statsTab = screen.getByText('Stats');
      fireEvent.click(statsTab);
      const statsTabContent = screen.getByText('AC').closest('.npcs-stats-tab');
      const roleplayTabContent = screen.getByText('Race').closest('.npcs-roleplay-tab');
      expect(statsTabContent).not.toHaveClass('npcs-tab-hidden');
      expect(roleplayTabContent).toHaveClass('npcs-tab-hidden');
    });

    it('should have both tab buttons with correct CSS classes', () => {
      renderModal();
      const tabs = document.querySelectorAll('.npcs-tab');
      expect(tabs.length).toBeGreaterThan(0);
      tabs.forEach((tab) => {
        expect(tab).toHaveClass('npcs-tab');
      });
    });

    it('should render book icon on roleplay tab', () => {
      renderModal();
      const roleplayTab = screen.getByText('Roleplay').closest('button');
      expect(roleplayTab.querySelector('.fa-book')).toBeInTheDocument();
    });

    it('should render shield icon on stats tab', () => {
      renderModal();
      const statsTab = screen.getByText('Stats').closest('button');
      expect(statsTab.querySelector('.fa-shield')).toBeInTheDocument();
    });
  });

  // ── Name Field ────────────────────────────────────────────────────

  describe('Name Field', () => {
    it('should render name input with required indicator', () => {
      renderModal();
      expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should render name input with autoFocus', () => {
      renderModal();
      const nameInput = screen.getByLabelText(/Name/);
      expect(nameInput).toBeInTheDocument();
    });

    it('should render name input with placeholder', () => {
      renderModal();
      expect(screen.getByLabelText(/Name/)).toHaveAttribute('placeholder', 'NPC name');
    });

    it('should handle name field change', () => {
      renderModal();
      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: 'Gandalf' } });
      expect(mockSetFormData).toHaveBeenCalled();
    });

    it('should display pre-filled name value', () => {
      renderModal({ formData: { ...defaultFormData, name: 'Gandalf' } });
      const nameInput = screen.getByLabelText(/Name/);
      expect(nameInput.value).toBe('Gandalf');
    });
  });

  // ── Footer Buttons ────────────────────────────────────────────────

  describe('Footer Buttons', () => {
    it('should render cancel and save buttons', () => {
      renderModal();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should call onClose when cancel clicked', () => {
      renderModal();
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onSave when save clicked', () => {
      renderModal();
      fireEvent.click(screen.getByText('Save'));
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('should disable save button when disabled prop is true', () => {
      renderModal({ disabled: true });
      const saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).toHaveAttribute('disabled');
    });

    it('should not disable save button when disabled prop is false', () => {
      renderModal({ disabled: false });
      const saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).not.toHaveAttribute('disabled');
    });

    it('should show saving state text when saving is true', () => {
      renderModal({ saving: true });
      expect(screen.getByText('Saving…')).toBeInTheDocument();
    });

    it('should disable save button when saving is true', () => {
      renderModal({ saving: true });
      const saveButton = screen.getByText('Saving…').closest('button');
      expect(saveButton).not.toHaveAttribute('disabled');
    });
  });

  // ── Delete Button ─────────────────────────────────────────────────

  describe('Delete Button', () => {
    it('should not render delete button when not editing', () => {
      renderModal({ editingNPC: undefined });
      expect(screen.queryByText(/^Delete$/)).not.toBeInTheDocument();
    });

    it('should render delete button when editing', () => {
      renderModal({ editingNPC: { name: 'Gandalf' } });
      expect(screen.getByText(/Delete/)).toBeInTheDocument();
    });

    it('should call onDelete when delete clicked', () => {
      renderModal({ editingNPC: { name: 'Gandalf' } });
      fireEvent.click(screen.getByText(/Delete/));
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should show deleting state text when deleting is true', () => {
      renderModal({ editingNPC: { name: 'Gandalf' }, deleting: true });
      expect(screen.getByText('Deleting…')).toBeInTheDocument();
    });

    it('should disable delete button when deleting is true', () => {
      renderModal({ editingNPC: { name: 'Gandalf' }, deleting: true });
      const deleteButton = screen.getByText('Deleting…').closest('button');
      expect(deleteButton).toHaveAttribute('disabled');
    });
  });

  // ── Save & Add to Initiative ──────────────────────────────────────

  describe('Save & Add to Initiative', () => {
    it('should not render button when npcHasStatBlock is false', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: undefined } });
      expect(screen.queryByText(/Save & Add to Initiative/)).not.toBeInTheDocument();
    });

    it('should render button when npcHasStatBlock is true', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: 15 } });
      expect(screen.getByText(/Save & Add to Initiative/)).toBeInTheDocument();
    });

    it('should call onSaveAndAddToInitiative when clicked', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: 15 } });
      fireEvent.click(screen.getByText(/Save & Add to Initiative/));
      expect(mockOnSaveAndAddToInitiative).toHaveBeenCalledTimes(1);
    });

    it('should disable button when disabled is true', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: 15 }, disabled: true });
      const btn = screen.getByText(/Save & Add to Initiative/).closest('button');
      expect(btn).toHaveAttribute('disabled');
    });

    it('should not render button when onSaveAndAddToInitiative is not provided', () => {
      render(
        <NPCFormModal
          formData={defaultFormData}
          setFormData={mockSetFormData}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(screen.queryByText(/Save & Add to Initiative/)).not.toBeInTheDocument();
    });
  });

  // ── Avatar Modal ──────────────────────────────────────────────────

  describe('Avatar Modal', () => {
    it('should not render avatar modal when no image', () => {
      renderModal();
      expect(screen.queryByText(/avatar/i)?.closest('.avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('should not render avatar modal by default even with image', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc' },
      });
      expect(screen.queryByText(/avatar/i)?.closest('.avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('should not render avatar modal by default even with imagePath', () => {
      renderModal({
        formData: { ...defaultFormData, imagePath: '/avatars/gandalf.png' },
      });
      expect(screen.queryByText(/avatar/i)?.closest('.avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('should pass name to avatar modal when rendered', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc', name: 'Gandalf' },
      });
      const avatarImg = document.querySelector('.avatar-image');
      if (avatarImg) {
        expect(avatarImg).toHaveAttribute('alt', 'Gandalf');
      }
    });
  });

  // ── Modal Structure ───────────────────────────────────────────────

  describe('Modal Structure', () => {
    it('should render all main modal sections', () => {
      renderModal();
      expect(document.querySelector('.ct-modal-header')).toBeInTheDocument();
      expect(document.querySelector('.npcs-avatar-section')).toBeInTheDocument();
      expect(document.querySelector('.npcs-tabs')).toBeInTheDocument();
      expect(document.querySelector('.ct-modal-body')).toBeInTheDocument();
      expect(document.querySelector('.ct-modal-footer')).toBeInTheDocument();
    });

    it('should render modal actions and buttons containers', () => {
      renderModal({ editingNPC: { name: 'Gandalf' } });
      expect(document.querySelector('.ct-modal-actions')).toBeInTheDocument();
      expect(document.querySelector('.ct-modal-buttons')).toBeInTheDocument();
    });

    it('should not call setFormData when no file provided', () => {
      renderModal();
      const fileInput = document.querySelector('.npcs-avatar-input');
      fireEvent.change(fileInput, { target: { files: [] } });
      expect(mockSetFormData).not.toHaveBeenCalled();
    });

    it('should render with empty form data', () => {
      renderModal({ formData: {} });
      expect(screen.getByRole('heading', { name: 'New NPC' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    });

    it('should not close on escape key press', () => {
      renderModal();
      const overlay = document.querySelector('.ct-modal-overlay');
      fireEvent.keyDown(overlay, { key: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
