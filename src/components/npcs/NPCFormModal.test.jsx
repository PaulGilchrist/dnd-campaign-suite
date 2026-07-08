// @cleaned-by-ai
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
    it('should render "New NPC" heading when no editingNPC', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'New NPC' })).toBeInTheDocument();
    });

    it('should render "Edit NPC" heading when editingNPC is provided', () => {
      renderModal({ editingNPC: { name: 'Gandalf' } });
      expect(screen.getByRole('heading', { name: 'Edit NPC' })).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Close'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Avatar Section ────────────────────────────────────────────────

  describe('Avatar Section', () => {
    it('should render remove button when image exists', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc' },
      });
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('should render remove button when imagePath exists', () => {
      renderModal({
        formData: { ...defaultFormData, imagePath: '/campaigns/test/npc.png' },
      });
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('should not render remove button when no image data', () => {
      renderModal();
      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });

    it('should clear image data on remove click', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc' },
      });
      fireEvent.click(screen.getByText('Remove'));
      expect(mockSetFormData).toHaveBeenCalled();
    });

    it('should show AvatarModal when avatar with image is clicked', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc', name: 'Gandalf' },
      });
      // AvatarImage renders as avatar-wrapper with role="button" when onClick is provided
      const avatarWrappers = document.querySelectorAll('.avatar-wrapper[role="button"]');
      expect(avatarWrappers.length).toBeGreaterThan(0);
      fireEvent.click(avatarWrappers[0]);
      expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();
    });

    it('should show AvatarModal when avatar with imagePath is clicked', () => {
      renderModal({
        formData: { ...defaultFormData, imagePath: '/campaigns/test/npc.png', name: 'Gandalf' },
      });
      const avatarWrappers = document.querySelectorAll('.avatar-wrapper[role="button"]');
      expect(avatarWrappers.length).toBeGreaterThan(0);
      fireEvent.click(avatarWrappers[0]);
      expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();
    });

    it('should not show AvatarModal when no image data', () => {
      renderModal({ name: 'Gandalf' });
      // Without image, AvatarImage has no onClick, so no button role
      const avatarButtons = document.querySelectorAll('.avatar-wrapper[role="button"]');
      expect(avatarButtons.length).toBe(0);
      expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('should close AvatarModal via its close handler', () => {
      renderModal({
        formData: { ...defaultFormData, image: 'data:image/png;base64,abc', name: 'Gandalf' },
      });
      const avatarWrappers = document.querySelectorAll('.avatar-wrapper[role="button"]');
      fireEvent.click(avatarWrappers[0]);
      expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();

      // The AvatarModal listens for keydown to close
      const handleClose = screen.getAllByLabelText('Close')[1];
      fireEvent.click(handleClose);
      expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });
  });

  // ── Image Upload ──────────────────────────────────────────────────

  describe('Image Upload', () => {
    it('should not process file when no file selected', () => {
      renderModal();
      const fileInput = document.querySelector('.npcs-avatar-input');
      fireEvent.change(fileInput, { target: { files: [] } });
      expect(mockSetFormData).not.toHaveBeenCalled();
    });
  });

  // ── Tabs ──────────────────────────────────────────────────────────

  describe('Tabs', () => {
    it('should switch tabs when clicked and show corresponding content', () => {
      renderModal();

      // Stats tab
      const statsTab = screen.getByText('Stats');
      fireEvent.click(statsTab);
      expect(screen.getByText('AC')).toBeInTheDocument();

      // Back to roleplay tab
      const roleplayTab = screen.getByText('Roleplay');
      fireEvent.click(roleplayTab);
      expect(screen.getByLabelText('Race')).toBeInTheDocument();
    });

    it('should apply active tab CSS class to active tab button', () => {
      renderModal();

      // Roleplay tab should be active by default
      const roleplayTab = screen.getByText('Roleplay').closest('button');
      expect(roleplayTab).toHaveClass('npcs-tab-active');

      // Stats tab should not be active
      const statsTab = screen.getByText('Stats').closest('button');
      expect(statsTab).not.toHaveClass('npcs-tab-active');

      // Switch to stats
      fireEvent.click(statsTab);
      expect(statsTab).toHaveClass('npcs-tab-active');
      expect(roleplayTab).not.toHaveClass('npcs-tab-active');
    });

    it('should hide inactive tab content', () => {
      renderModal();

      // Initially roleplay tab visible, stats hidden
      const roleplayTabContent = screen.getByLabelText('Race').closest('.npcs-roleplay-tab');
      const statsTabContent = screen.getByText('AC').closest('.npcs-stats-tab');

      expect(roleplayTabContent).not.toHaveClass('npcs-tab-hidden');
      expect(statsTabContent).toHaveClass('npcs-tab-hidden');

      // Switch to stats
      fireEvent.click(screen.getByText('Stats'));
      expect(roleplayTabContent).toHaveClass('npcs-tab-hidden');
      expect(statsTabContent).not.toHaveClass('npcs-tab-hidden');
    });
  });

  // ── Name Field ────────────────────────────────────────────────────

  describe('Name Field', () => {
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

    it('should have name input focused by default', () => {
      renderModal();
      const nameInput = screen.getByLabelText(/Name/);
      expect(nameInput).toHaveFocus();
    });

    it('should mark name field with required indicator', () => {
      renderModal();
      const nameLabel = screen.getByText('Name');
      expect(nameLabel.querySelector('.ct-required')).toBeInTheDocument();
    });
  });

  // ── Footer Buttons ────────────────────────────────────────────────

  describe('Footer Buttons', () => {
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

    it('should show saving state and disable save button when saving is true', () => {
      renderModal({ saving: true });
      expect(screen.getByText('Saving…')).toBeInTheDocument();
      const saveButton = screen.getByText('Saving…').closest('button');
      expect(saveButton).not.toHaveAttribute('disabled');
    });

    it('should disable cancel button when saving is true', () => {
      renderModal({ saving: true });
      const cancelButton = screen.getByText('Cancel').closest('button');
      expect(cancelButton).toHaveAttribute('disabled');
    });

    it('should have floppy disk icon on save button', () => {
      renderModal();
      const saveButton = screen.getByText('Save').closest('button');
      expect(saveButton.querySelector('.fa-solid.fa-floppy-disk')).toBeInTheDocument();
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

    it('should show deleting state and disable delete button when deleting is true', () => {
      renderModal({ editingNPC: { name: 'Gandalf' }, deleting: true });
      expect(screen.getByText('Deleting…')).toBeInTheDocument();
      const deleteButton = screen.getByText('Deleting…').closest('button');
      expect(deleteButton).toHaveAttribute('disabled');
    });

    it('should have trash icon on delete button', () => {
      renderModal({ editingNPC: { name: 'Gandalf' } });
      const deleteButton = screen.getByText(/Delete/).closest('button');
      expect(deleteButton.querySelector('.fa-solid.fa-trash-can')).toBeInTheDocument();
    });
  });

  // ── Save & Add to Initiative ──────────────────────────────────────

  describe('Save & Add to Initiative', () => {
    it('should not render button when npcHasStatBlock is false', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: undefined } });
      expect(screen.queryByText(/Save & Add to Initiative/)).not.toBeInTheDocument();
    });

    it('should not render button when callback is missing', () => {
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

    it('should render button when npcHasStatBlock is true and callback is provided', () => {
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

    it('should have shield icon on save button', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: 15 } });
      const btn = screen.getByText(/Save & Add to Initiative/).closest('button');
      expect(btn.querySelector('.fa-solid.fa-shield-alt')).toBeInTheDocument();
    });

    it('should have tooltip title on save button', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: 15 } });
      const btn = screen.getByText(/Save & Add to Initiative/).closest('button');
      expect(btn).toHaveAttribute('title', 'Save and add to initiative');
    });
  });

  // ── Tab Icons ─────────────────────────────────────────────────────

  describe('Tab Icons', () => {
    it('should have book icon on roleplay tab', () => {
      renderModal();
      const roleplayTab = screen.getByText('Roleplay').closest('button');
      expect(roleplayTab.querySelector('.fa-solid.fa-book')).toBeInTheDocument();
    });

    it('should have shield icon on stats tab', () => {
      renderModal();
      const statsTab = screen.getByText('Stats').closest('button');
      expect(statsTab.querySelector('.fa-solid.fa-shield')).toBeInTheDocument();
    });
  });

  // ── Camera Icon ───────────────────────────────────────────────────

  describe('Camera Icon', () => {
    it('should have camera icon on upload avatar label', () => {
      renderModal();
      const uploadLabel = screen.getByText('Upload Avatar').closest('label');
      expect(uploadLabel.querySelector('.fa-solid.fa-camera')).toBeInTheDocument();
    });
  });

  // ── Modal Structure ───────────────────────────────────────────────

  describe('Modal Structure', () => {
    it('should have npcs-modal class on modal', () => {
      renderModal();
      const modal = document.querySelector('.ct-modal.npcs-modal');
      expect(modal).toBeInTheDocument();
    });

    it('should have ct-modal-overlay wrapper', () => {
      renderModal();
      const overlay = document.querySelector('.ct-modal-overlay');
      expect(overlay).toBeInTheDocument();
    });

    it('should have ct-modal-body container', () => {
      renderModal();
      const body = document.querySelector('.ct-modal-body');
      expect(body).toBeInTheDocument();
    });

    it('should have ct-modal-footer container', () => {
      renderModal();
      const footer = document.querySelector('.ct-modal-footer');
      expect(footer).toBeInTheDocument();
    });

    it('should have npcs-avatar-section with controls', () => {
      renderModal();
      const avatarSection = document.querySelector('.npcs-avatar-section');
      expect(avatarSection).toBeInTheDocument();
      expect(avatarSection.querySelector('.npcs-avatar-controls')).toBeInTheDocument();
    });

    it('should have npcs-tabs container', () => {
      renderModal();
      const tabsContainer = document.querySelector('.npcs-tabs');
      expect(tabsContainer).toBeInTheDocument();
    });
  });

  // ── Disabled State ────────────────────────────────────────────────

  describe('Disabled State', () => {
    it('should disable save button when disabled', () => {
      renderModal({ disabled: true });
      expect(screen.getByText('Save').closest('button')).toHaveAttribute('disabled');
    });

    it('should disable cancel button when saving', () => {
      renderModal({ saving: true });
      expect(screen.getByText('Cancel').closest('button')).toHaveAttribute('disabled');
    });

    it('should disable delete button when deleting', () => {
      renderModal({ editingNPC: { name: 'Gandalf' }, deleting: true });
      expect(screen.getByText('Deleting…').closest('button')).toHaveAttribute('disabled');
    });

    it('should disable save & add to initiative when disabled', () => {
      renderModal({ formData: { ...defaultFormData, armorClass: 15 }, disabled: true });
      expect(screen.getByText(/Save & Add to Initiative/).closest('button')).toHaveAttribute('disabled');
    });
  });

  // ── No Image Path Variations ──────────────────────────────────────

  describe('Image Path Variations', () => {
    it('should show remove button when only imagePath is set', () => {
      renderModal({
        formData: { ...defaultFormData, imagePath: '/campaigns/test/npc.png' },
      });
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('should show remove button when both image and imagePath are set', () => {
      renderModal({
        formData: {
          ...defaultFormData,
          image: 'data:image/png;base64,abc',
          imagePath: '/campaigns/test/npc.png',
        },
      });
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('should not show remove button when both image and imagePath are empty', () => {
      renderModal();
      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });
  });
});
