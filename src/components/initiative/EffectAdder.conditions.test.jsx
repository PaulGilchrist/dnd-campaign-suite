// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';
import { CONDITIONS } from '../../services/combat/conditions/conditionUtils.js';

describe('EffectAdder - conditions tab', () => {
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

  it('should render all conditions as clickable badges', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    CONDITIONS.forEach(({ label }) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('should render DC and Save (ability) fields with correct defaults', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    const dcInput = screen.getByLabelText('DC');
    expect(dcInput).toBeInTheDocument();
    expect(dcInput).toHaveValue(10);
    const select = screen.getByLabelText('Save');
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('con');
  });

  it('should select a condition and show it as selected', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    const blindedBtn = screen.getByText('Blinded');
    fireEvent.click(blindedBtn);
    expect(blindedBtn).toHaveClass('ea-badge--selected');
  });

  it('should set the save ability to the condition\'s default ability when selected', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    // grappled defaults to 'str', blinded has no default (stays at previous 'str')
    fireEvent.click(screen.getByText('Grappled'));
    const select = screen.getByLabelText('Save');
    expect(select.value).toBe('str');
    fireEvent.click(screen.getByText('Blinded'));
    expect(select.value).toBe('str');
  });

  it('should allow changing the DC and save ability', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    const dcInput = screen.getByLabelText('DC');
    fireEvent.change(dcInput, { target: { value: '15' } });
    expect(dcInput).toHaveValue(15);
    const select = screen.getByLabelText('Save');
    fireEvent.change(select, { target: { value: 'dex' } });
    expect(select.value).toBe('dex');
  });

  it('should default DC to 10 when entering invalid text or 0', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    const dcInput = screen.getByLabelText('DC');
    fireEvent.change(dcInput, { target: { value: 'abc' } });
    expect(dcInput).toHaveValue(10);
    fireEvent.change(dcInput, { target: { value: '0' } });
    expect(dcInput).toHaveValue(10);
  });

  it('should call onApply with correct data when Apply is clicked', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByText('Blinded'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledWith('conditions', {
      target: 'Goblin',
      conditionKey: 'blinded',
      dc: 10,
      ability: 'con',
    });
  });

  it('should call onApply with custom DC and ability', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByText('Grappled'));
    const dcInput = screen.getByLabelText('DC');
    fireEvent.change(dcInput, { target: { value: '20' } });
    const select = screen.getByLabelText('Save');
    fireEvent.change(select, { target: { value: 'dex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledWith('conditions', {
      target: 'Goblin',
      conditionKey: 'grappled',
      dc: 20,
      ability: 'dex',
    });
  });

  it('should call onCancel when Cancel is clicked but NOT when the overlay is clicked', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    const overlay = document.querySelector('.ea-overlay');
    fireEvent.click(overlay);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(overlay).toBeInTheDocument();
  });

  it('should not call onApply when Apply is clicked without a selection', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('should have all six ability options in the Save dropdown', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    const select = screen.getByLabelText('Save');
    const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(options).toContain('str');
    expect(options).toContain('dex');
    expect(options).toContain('con');
    expect(options).toContain('int');
    expect(options).toContain('wis');
    expect(options).toContain('cha');
  });
});
