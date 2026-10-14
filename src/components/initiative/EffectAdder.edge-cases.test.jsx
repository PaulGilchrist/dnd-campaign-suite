import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

describe('EffectAdder - edge cases', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [
        { name: 'Alice' },
        { name: 'Bob' },
      ],
    };
  });

  it('should render without crashing when all props are minimal', () => {
    render(<EffectAdder targetName='Test' onCancel={vi.fn()} onApply={vi.fn()} creatures={[]} />);
    expect(document.querySelector('.ea-modal')).toBeInTheDocument();
  });

  it('should handle invalid initialTab gracefully', () => {
    expect(() => {
      render(<EffectAdder {...props} initialTab='invalidTab' />);
    }).not.toThrow();
    expect(document.querySelector('.ea-modal')).toBeInTheDocument();
  });

  it('should render effects tab correctly when it is the initial tab', () => {
    render(<EffectAdder {...props} initialTab='effects' />);
    expect(screen.getByPlaceholderText('Search effects…')).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
  });
});
