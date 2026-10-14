import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';

describe('MagicInitiateModal - Save All Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save all', () => {
    it('should deduplicate spells from a single instance in the spells array', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));

      const selects = document.querySelectorAll('.mi-selector-select');
      fireEvent.change(selects[0], { target: { value: 'Wizard' } });
      fireEvent.change(selects[1], { target: { value: 'Acid Splash' } });
      fireEvent.change(selects[2], { target: { value: 'Chill Touch' } });
      fireEvent.change(selects[3], { target: { value: 'Burning Hands' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

      const saveAllBtn = screen.getByRole('button', { name: /Save All/ });
      fireEvent.click(saveAllBtn);

      expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(1, 'spells', [
        'Acid Splash',
        'Chill Touch',
        'Burning Hands',
      ]);
    });

    it('should build magicInitiateInstances array from a single instance', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));

      const selects = document.querySelectorAll('.mi-selector-select');
      fireEvent.change(selects[0], { target: { value: 'Wizard' } });
      fireEvent.change(selects[1], { target: { value: 'Acid Splash' } });
      fireEvent.change(selects[2], { target: { value: 'Chill Touch' } });
      fireEvent.change(selects[3], { target: { value: 'Burning Hands' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

      fireEvent.click(screen.getByRole('button', { name: /Save All/ }));

      expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(2, 'magicInitiateInstances', [
        {
          class: 'Wizard',
          cantrips: ['Acid Splash', 'Chill Touch'],
          level1Spell: 'Burning Hands',
        },
      ]);
    });

    it('should merge spells from multiple instances preserving order of first occurrence', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      // First instance: Wizard
      fireEvent.click(screen.getByText('Add Another Instance'));

      let selects = document.querySelectorAll('.mi-selector-select');
      fireEvent.change(selects[0], { target: { value: 'Wizard' } });
      fireEvent.change(selects[1], { target: { value: 'Acid Splash' } });
      fireEvent.change(selects[2], { target: { value: 'Chill Touch' } });
      fireEvent.change(selects[3], { target: { value: 'Burning Hands' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

      // Second instance: Sorcerer with overlapping spells
      fireEvent.click(screen.getByText('Add Another Instance'));

      selects = document.querySelectorAll('.mi-selector-select');
      fireEvent.change(selects[0], { target: { value: 'Sorcerer' } });
      fireEvent.change(selects[1], { target: { value: 'Dancing Lights' } });
      fireEvent.change(selects[2], { target: { value: 'Acid Splash' } });
      fireEvent.change(selects[3], { target: { value: 'Shield' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

      fireEvent.click(screen.getByRole('button', { name: /Save All/ }));

      expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(
        2,
        'magicInitiateInstances',
        [
          {
            class: 'Wizard',
            cantrips: ['Acid Splash', 'Chill Touch'],
            level1Spell: 'Burning Hands',
          },
          {
            class: 'Sorcerer',
            cantrips: ['Dancing Lights', 'Acid Splash'],
            level1Spell: 'Shield',
          },
        ]
      );
    });

    it('should not call onArrayFieldChange or onClose when validation fails', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      fireEvent.click(screen.getByText('Add Another Instance'));
      fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

      expect(screen.getByText('Cantrip 1 is required')).toBeInTheDocument();
      expect(screen.getByText('Cantrip 2 is required')).toBeInTheDocument();
      expect(screen.getByText('Level 1 spell is required')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const saveAllBtn = screen.getByRole('button', { name: /Save All/ });
      fireEvent.click(saveAllBtn);

      expect(props.onArrayFieldChange).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('should not call onArrayFieldChange or onClose when no instances exist', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      expect(screen.queryByRole('button', { name: /Save All/ })).not.toBeInTheDocument();
      expect(props.onArrayFieldChange).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });
});
