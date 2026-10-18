// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

const selectFor = (labelText) =>
  screen.getByText(labelText).closest('.mi-selector').querySelector('select');

const optionValues = (select) =>
  Array.from(select.querySelectorAll('option')).map(o => o.value).filter(v => v !== '');

describe('MagicInitiateModal', () => {
  describe('render and close contract', () => {
    it('renders header and description, and routes header close and Skip to onClose', () => {
      const props = createProps();
      const { unmount } = render(<MagicInitiateModal {...props} />);

      expect(screen.getByText('Magic Initiate')).toBeInTheDocument();
      expect(screen.getByText(/Choose a class and select spells from its spell list/)).toBeInTheDocument();
      expect(screen.queryByText(/^Instance \d+/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(props.onClose).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
      expect(props.onClose).toHaveBeenCalledTimes(2);
      unmount();

      // Crash-guard: modal still renders before spell data is loaded
      const nullSpellProps = createProps({ allSpells: null });
      render(<MagicInitiateModal {...nullSpellProps} />);
      expect(screen.getByText('Magic Initiate')).toBeInTheDocument();
      expect(screen.getByText(/Choose a class/)).toBeInTheDocument();
    });
  });

  describe('ruleset-aware class selection', () => {
    it.each([
      { rules: '5e', classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'] },
      { rules: '2024', classes: ['Cleric', 'Druid', 'Wizard'] },
    ])('offers exactly the $rules class list, defaulting to the first class', ({ rules, classes }) => {
      const props = createProps({ formData: { rules } });
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));

      const classSelect = selectFor('Class:');
      expect(optionValues(classSelect)).toEqual(classes);
      expect(classSelect.value).toBe(classes[0]);
    });
  });

  describe('adding instances', () => {
    it('opens a numbered editor per add and keeps cancelled adds as summaries', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));
      expect(screen.getByRole('heading', { name: 'Instance 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Instance' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('Instance 1: Bard')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Add Another Instance'));
      expect(screen.getByRole('heading', { name: 'Instance 2' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('Instance 1: Bard')).toBeInTheDocument();
      expect(screen.getByText('Instance 2: Bard')).toBeInTheDocument();
    });
  });

  describe('editing instances', () => {
    it('prefills the editor byte-exactly, hides summary controls, and restores the summary on Cancel', () => {
      const props = createProps({
        formData: {
          magicInitiateInstances: [
            { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
          ],
          spells: [],
        },
      });
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

      expect(screen.getByRole('heading', { name: 'Instance 1' })).toBeInTheDocument();
      expect(selectFor('Class:').value).toBe('Wizard');
      expect(selectFor('Cantrip 1:').value).toBe('Acid Splash');
      expect(selectFor('Cantrip 2:').value).toBe('Chill Touch');
      expect(selectFor('Level 1 Spell:').value).toBe('Burning Hands');
      expect(screen.queryByText('Instance 1: Wizard')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Another Instance')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save All/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText('Instance 1: Wizard')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save All/ })).toBeInTheDocument();
      expect(screen.getByText('Add Another Instance')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  describe('class selection in editor', () => {
    it('re-filters both cantrip and level 1 spell lists when the class changes', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));

      // Default class Bard (default cantrip values are empty)
      expect(selectFor('Cantrip 1:').value).toBe('');
      expect(optionValues(selectFor('Cantrip 1:'))).toEqual(['Dancing Lights']);
      expect(optionValues(selectFor('Level 1 Spell:'))).toEqual([
        'Animal Friendship', 'Charm Person', 'Cure Wounds', 'Disguise Self',
        'Feather Fall', 'Healing Word', 'Heroism', 'Identify', 'Silence', 'Sleep', 'Thunderwave',
      ]);

      fireEvent.change(selectFor('Class:'), { target: { value: 'Cleric' } });

      expect(optionValues(selectFor('Cantrip 1:'))).toEqual(['Guidance']);
      expect(optionValues(selectFor('Cantrip 2:'))).toEqual(['Guidance']);
      expect(optionValues(selectFor('Level 1 Spell:'))).toEqual([
        'Animal Friendship', 'Bless', 'Command', 'Cure Wounds', 'Healing Word', 'Thunderwave',
      ]);
    });
  });

  describe('duplicate cantrip prevention', () => {
    it('clears the other cantrip slot when a duplicate is selected', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));
      fireEvent.change(selectFor('Class:'), { target: { value: 'Wizard' } });
      fireEvent.change(selectFor('Cantrip 1:'), { target: { value: 'Acid Splash' } });
      fireEvent.change(selectFor('Cantrip 2:'), { target: { value: 'Acid Splash' } });

      // The newly selected slot keeps its value; the duplicate in the other slot is auto-cleared
      expect(selectFor('Cantrip 2:').value).toBe('Acid Splash');
      expect(selectFor('Cantrip 1:').value).toBe('');
      // Auto-clear is silent — validation errors stay reserved for the save gate
      expect(screen.queryByText('Must be different from Cantrip 1')).not.toBeInTheDocument();
    });
  });

  describe('instance removal', () => {
    it('removes an instance and renumbers the remaining one', () => {
      const props = createProps({
        formData: {
          magicInitiateInstances: [
            { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
            { class: 'Sorcerer', cantrips: ['Dancing Lights', 'Chill Touch'], level1Spell: 'Shield' },
          ],
          spells: [],
        },
      });
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

      expect(screen.queryByText('Instance 1: Wizard')).not.toBeInTheDocument();
      expect(screen.getByText('Instance 1: Sorcerer')).toBeInTheDocument();
      expect(screen.getByText('Shield')).toBeInTheDocument();
    });
  });
});
