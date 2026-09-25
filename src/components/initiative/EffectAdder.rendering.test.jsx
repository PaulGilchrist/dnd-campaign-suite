// @improved-by-ai
// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

describe('EffectAdder - rendering', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'conditions',
      onCancel: () => {},
      onApply: () => {},
      creatures: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Dragon' },
      ],
    };
  });

  describe('overlay and modal structure', () => {
    it.each`
      targetName
      ${'Goblin'}
      ${'Alice the Wizard'}
      ${''}
    `('should render target name "$targetName" in heading', ({ targetName }) => {
      render(<EffectAdder {...props} targetName={targetName} />);
      expect(screen.getByRole('heading', { level: 3, name: targetName })).toBeInTheDocument();
    });

    it('should render three tabs: Conditions, Effects, Concentration', () => {
      render(<EffectAdder {...props} />);
      expect(screen.getByRole('button', { name: 'Conditions' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Effects' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Concentration' })).toBeInTheDocument();
    });

    it('should NOT call onCancel when the overlay background is clicked', () => {
      const onCancel = vi.fn();
      render(<EffectAdder {...props} onCancel={onCancel} />);
      const overlay = document.querySelector('.ea-overlay');
      overlay.click();
      expect(onCancel).not.toHaveBeenCalled();
      expect(document.querySelector('.ea-modal')).toBeInTheDocument();
    });

    it('should NOT call onCancel when the modal content is clicked', () => {
      const onCancel = vi.fn();
      render(<EffectAdder {...props} onCancel={onCancel} />);
      const modal = document.querySelector('.ea-modal');
      modal.click();
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
