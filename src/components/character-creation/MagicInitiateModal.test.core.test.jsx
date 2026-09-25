// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

describe('MagicInitiateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renderMarkdown).mockReturnValue('<p>mocked</p>');
  });

  describe('initial rendering', () => {
    it('should still render header and description when allSpells is null', () => {
      const props = createProps({ allSpells: null });
      render(<MagicInitiateModal {...props} />);
      expect(screen.getByText('Magic Initiate')).toBeInTheDocument();
      expect(screen.getByText(/Choose a class/)).toBeInTheDocument();
    });
  });

  describe('ruleset-aware class selection', () => {
    it('should show 5e classes by default', () => {
      const props = createProps({ formData: { rules: '5e' } });
      render(<MagicInitiateModal {...props} />);
      const addBtn = screen.getByText('Add Another Instance');
      fireEvent.click(addBtn);

      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      const optionValues = Array.from(classSelect.querySelectorAll('option')).map(o => o.value).filter(v => v !== '');

      expect(optionValues).toEqual(['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard']);
    });

    it('should show only 2024 classes when ruleset is 2024', () => {
      const props = createProps({ formData: { rules: '2024' } });
      render(<MagicInitiateModal {...props} />);
      const addBtn = screen.getByText('Add Another Instance');
      fireEvent.click(addBtn);

      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      const optionValues = Array.from(classSelect.querySelectorAll('option')).map(o => o.value).filter(v => v !== '');

      expect(optionValues).toEqual(['Cleric', 'Druid', 'Wizard']);
    });
  });

  describe('adding instances', () => {
    it('should add a new instance in edit mode with default class', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      expect(screen.queryByText('Instance 1:')).not.toBeInTheDocument();

      const addBtn = screen.getByText('Add Another Instance');
      fireEvent.click(addBtn);

      expect(screen.getByText('Instance 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Instance' })).toBeInTheDocument();
    });

    it('should allow adding and removing multiple instances', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      // Add first instance
      fireEvent.click(screen.getByText('Add Another Instance'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // Add second instance
      fireEvent.click(screen.getByText('Add Another Instance'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText(/Instance 1:/)).toBeInTheDocument();
      expect(screen.getByText(/Instance 2:/)).toBeInTheDocument();
    });
  });

  describe('editing instances', () => {
    it('should switch from summary to editor view when clicking Edit', () => {
      const existingInstances = [
        {
          class: 'Wizard',
          cantrips: ['Acid Splash', 'Chill Touch'],
          level1Spell: 'Burning Hands',
        },
      ];
      const props = createProps({
        formData: { magicInitiateInstances: existingInstances, spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByText('Instance 1')).toBeInTheDocument();
      expect(screen.queryByText('Instance 1: Wizard')).not.toBeInTheDocument();
    });

    it('should return to summary view when clicking Cancel', () => {
      const existingInstances = [
        {
          class: 'Wizard',
          cantrips: ['Acid Splash', 'Chill Touch'],
          level1Spell: 'Burning Hands',
        },
      ];
      const props = createProps({
        formData: { magicInitiateInstances: existingInstances, spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText('Instance 1: Wizard')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  describe('class selection in editor', () => {
    it('should update cantrip options when class changes', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];

      // Default is Bard - check Bard cantrips in the first cantrip selector (index 1)
      const cantripSelects = document.querySelectorAll('.mi-selector-select');
      const cantrip1Options = Array.from(cantripSelects[1].querySelectorAll('option')).map(o => o.textContent);
      expect(cantrip1Options.some(opt => opt.includes('Dancing Lights'))).toBe(true);

      // Switch to Cleric - Guidance is a Cleric cantrip but Dancing Lights is not
      fireEvent.change(classSelect, { target: { value: 'Cleric' } });

      const updatedSelects = document.querySelectorAll('.mi-selector-select');
      const clericCantripOptions = Array.from(updatedSelects[1].querySelectorAll('option')).map(o => o.textContent);
      expect(clericCantripOptions.some(opt => opt.includes('Guidance'))).toBe(true);
      expect(clericCantripOptions.some(opt => opt.includes('Dancing Lights'))).toBe(false);
    });

    it('should update level 1 spell options when class changes', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });

      // Wizard has Burning Hands, Magic Missile, Shield, etc.
      expect(screen.getByText('Burning Hands (1rd)')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile (1rd)')).toBeInTheDocument();

      // Switch to Cleric
      fireEvent.change(classSelect, { target: { value: 'Cleric' } });
      expect(screen.getByText('Bless (1rd)')).toBeInTheDocument();
      expect(screen.getByText('Command (1rd)')).toBeInTheDocument();
      expect(screen.queryByText('Burning Hands (1rd)')).not.toBeInTheDocument();
    });
  });

  describe('duplicate cantrip prevention', () => {
    it('should remove a duplicate when selecting the same cantrip for both slots', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });

      // Select Acid Splash for Cantrip 1
      const cantrip1Select = screen.getByText('Cantrip 1:').nextElementSibling;
      fireEvent.change(cantrip1Select, { target: { value: 'Acid Splash' } });

      // Cantrip 2 should now show null/default (duplicate removed)
      const cantrip2Select = screen.getByText('Cantrip 2:').nextElementSibling;
      expect(cantrip2Select.value).toBe('');
    });
  });

  describe('instance removal', () => {
    it('should remove an instance and renumber remaining ones when clicking Remove', () => {
      const existingInstances = [
        {
          class: 'Wizard',
          cantrips: ['Acid Splash', 'Chill Touch'],
          level1Spell: 'Burning Hands',
        },
        {
          class: 'Bard',
          cantrips: ['Dancing Lights', 'Guidance'],
          level1Spell: 'Bless',
        },
      ];
      const props = createProps({
        formData: { magicInitiateInstances: existingInstances, spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      expect(screen.getByText('Instance 1: Wizard')).toBeInTheDocument();
      expect(screen.getByText('Instance 2: Bard')).toBeInTheDocument();

      const removeButtons = document.querySelectorAll('.mi-remove-btn');
      fireEvent.click(removeButtons[0]);

      expect(screen.queryByText('Instance 1: Wizard')).not.toBeInTheDocument();
      expect(screen.queryByText('Instance 2: Bard')).not.toBeInTheDocument();
      // After removing Wizard, Bard is renumbered as Instance 1
      expect(screen.getByText('Instance 1: Bard')).toBeInTheDocument();
    });
  });

  describe('overlay interaction', () => {
    it('should NOT call onClose when clicking the overlay background (outside the modal)', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      const overlay = document.querySelector('.mi-overlay');
      fireEvent.click(overlay);
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Magic Initiate')).toBeInTheDocument();
    });

    it('should NOT call onClose when clicking inside the modal', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      const modal = document.querySelector('.mi-modal');
      fireEvent.click(modal);
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  describe('editor state management', () => {
    it('should hide summary controls while editing an instance', () => {
      const existingInstances = [
        { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
      ];
      const props = createProps({
        formData: { magicInitiateInstances: existingInstances, spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      expect(screen.getByText('Add Another Instance')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.queryByText('Add Another Instance')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save All/ })).not.toBeInTheDocument();
    });
  });
});
