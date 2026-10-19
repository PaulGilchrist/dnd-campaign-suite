// @maintained-by-ai
// Lane: EffectAdder concentration-tab UI seam — form render/defaults, DC sanitiser,
// Apply disabled state-machine bytes (never click-blocked), exact onSubmit payload once,
// zero-write cancel. NOT owned here (cited): dispatch handler branches, exact service
// literals, Rage guards → createEffectAdderHandlers.test.jsx #839 :295-347 (+ guards :73-92),
// falling lane → createEffectAdderHandlers.falling.test.js #838, tab-button existence →
// EffectAdder.rendering.test.jsx, conditions tab → EffectAdder.conditions.test.jsx.
// Concentration is free-text (no registry select), so no targetEffectDefinitions census here.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

describe('EffectAdder - concentration tab', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'concentration',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Dragon' },
      ],
    };
  });

  it('should show the concentration form when its tab is selected, with spell name and default DC 10', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    const spellInput = screen.getByLabelText('Spell Name');
    expect(spellInput).toBeInTheDocument();
    expect(spellInput).toHaveAttribute('placeholder', 'e.g. Hold Person');
    expect(spellInput).toHaveFocus();
    expect(screen.getByLabelText('DC')).toHaveValue(10);
  });

  it('should keep valid DC edits and fall back to 10 for invalid or zero input', () => {
    render(<EffectAdder {...props} />);
    const dcInput = screen.getByLabelText('DC');
    fireEvent.change(dcInput, { target: { value: '13' } });
    expect(dcInput).toHaveValue(13);
    fireEvent.change(dcInput, { target: { value: '0' } });
    expect(dcInput).toHaveValue(10);
    fireEvent.change(dcInput, { target: { value: 'xyz' } });
    expect(dcInput).toHaveValue(10);
  });

  it('should disable Apply until spell name is non-blank text', () => {
    render(<EffectAdder {...props} />);
    const apply = screen.getByRole('button', { name: 'Apply' });
    expect(apply).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Spell Name'), { target: { value: '   ' } });
    expect(apply).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Spell Name'), { target: { value: 'Shield' } });
    expect(apply).toBeEnabled();
  });

  it('should dispatch tab and exact trimmed payload to onApply exactly once on Apply', () => {
    render(<EffectAdder {...props} />);
    fireEvent.change(screen.getByLabelText('Spell Name'), { target: { value: '  Shield  ' } });
    fireEvent.change(screen.getByLabelText('DC'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith('concentration', {
      target: 'Goblin',
      spellName: 'Shield',
      dc: 15,
    });
  });

  it('should call onCancel exactly once with zero writes from the concentration tab', () => {
    render(<EffectAdder {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();
  });
});
