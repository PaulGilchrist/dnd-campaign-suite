import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

describe('EffectAdder - concentration tab', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'conditions',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Dragon' },
      ],
    };
  });

  it('should render spell name input, DC field, and placeholder', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    expect(screen.getByText('Spell Name')).toBeInTheDocument();
    expect(screen.getByText('DC')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Hold Person')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Hold Person')).toHaveFocus();
    expect(screen.getByLabelText('DC')).toHaveValue(10);
  });

  it('should disable Apply with empty spell name and enable when entered', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    const spellInput = screen.getByPlaceholderText('e.g. Hold Person');
    fireEvent.change(spellInput, { target: { value: 'Fireball' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('should remain disabled when spell name is only whitespace', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    const spellInput = screen.getByPlaceholderText('e.g. Hold Person');
    fireEvent.change(spellInput, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('should default DC to 10 when entering invalid text or 0', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    const dcInput = screen.getByLabelText('DC');
    fireEvent.change(dcInput, { target: { value: 'xyz' } });
    expect(dcInput).toHaveValue(10);
    fireEvent.change(dcInput, { target: { value: '0' } });
    expect(dcInput).toHaveValue(10);
  });

  it('should call onApply with trimmed spell name and DC when applying', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    const spellInput = screen.getByPlaceholderText('e.g. Hold Person');
    fireEvent.change(spellInput, { target: { value: '  Shield  ' } });
    const dcInput = screen.getByLabelText('DC');
    fireEvent.change(dcInput, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledWith('concentration', {
      target: 'Goblin',
      spellName: 'Shield',
      dc: 15,
    });
  });

  it('should not call onApply when Apply is clicked with empty or whitespace spell name', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).not.toHaveBeenCalled();
    const spellInput = screen.getByPlaceholderText('e.g. Hold Person');
    fireEvent.change(spellInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('should call onCancel when Cancel is clicked', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
