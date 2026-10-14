import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';
import { TARGET_EFFECT_DEFINITIONS } from '../../services/combat/conditions/targetEffectDefinitions.js';

describe('EffectAdder - effects config view', () => {
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

  describe('config header and description', () => {
    it.each`
      effectLabel          | iconClass       | hasSource
      ${'Goad'}            | ${'fa-bullseye'}| ${true}
      ${"Tasha's Hideous Laughter"} | ${'fa-music'} | ${true}
    `('should show effect icon, label, description, and buttons for "$effectLabel"', ({ effectLabel, iconClass, hasSource }) => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText(effectLabel));
      const header = document.querySelector('.ea-config-header');
      expect(header).toBeInTheDocument();
      expect(header.querySelector('i')).toHaveClass(iconClass);
      expect(header.querySelector('strong')).toHaveTextContent(effectLabel);
      const def = TARGET_EFFECT_DEFINITIONS.find(d => d.label === effectLabel);
      expect(document.querySelector('.ea-config-desc')).toHaveTextContent(def.description);
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
      if (hasSource) {
        expect(screen.getByText('Source (who caused this):')).toBeInTheDocument();
      }
    });
  });

  describe('source field', () => {
    it('should populate creature names and have "Other" option when effect has source field', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Goad'));
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Dragon')).toBeInTheDocument();
      expect(screen.getByText('Other…')).toBeInTheDocument();
    });

    it('should show custom source input when "Other" is selected', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Goad'));
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '__other__' } });
      expect(screen.getByPlaceholderText('Custom source name')).toBeInTheDocument();
    });

    it('should not show source field for effects without source', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('No Opportunity Attacks'));
      expect(screen.queryByText('Source (who caused this):')).not.toBeInTheDocument();
    });
  });

  describe('value field', () => {
    it('should show value field with effect defaults for effects with value field', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Next Attack +N Bonus'));
      expect(screen.getByText('Value:')).toBeInTheDocument();
      expect(screen.getByLabelText('Value:')).toHaveValue(5);
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      fireEvent.click(screen.getByText('AC Penalty'));
      expect(screen.getByLabelText('Value:')).toHaveValue(2);
    });

    it('should reset to defaults when selecting a different effect', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Next Attack +N Bonus'));
      expect(screen.getByLabelText('Value:')).toHaveValue(5);
      fireEvent.change(screen.getByLabelText('Value:'), { target: { value: '99' } });
      expect(screen.getByLabelText('Value:')).toHaveValue(99);
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      fireEvent.click(screen.getByText('AC Penalty'));
      expect(screen.getByLabelText('Value:')).toHaveValue(2);
    });

    it('should allow changing value input and handle invalid input defaulting to 0', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('AC Penalty'));
      const valueInput = screen.getByLabelText('Value:');
      fireEvent.change(valueInput, { target: { value: '7' } });
      expect(valueInput).toHaveValue(7);
      fireEvent.change(valueInput, { target: { value: 'abc' } });
      expect(valueInput).toHaveValue(0);
    });
  });

  describe('ability field', () => {
    it('should show ability field with correct default for effects with ability field', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Check Disadv'));
      const abilitySelect = screen.getByLabelText('Ability:');
      expect(abilitySelect).toBeInTheDocument();
      expect(abilitySelect.value).toBe('wis');
      const optionValues = Array.from(abilitySelect.options).map(o => o.value);
      expect(optionValues).toContain('wis');
    });

    it('should allow changing ability in effect config', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Check Disadv'));
      const abilitySelect = screen.getByLabelText('Ability:');
      fireEvent.change(abilitySelect, { target: { value: 'str' } });
      expect(abilitySelect.value).toBe('str');
    });
  });

  describe('DC field', () => {
    it('should show DC field with correct default for effects with dc field', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText("Tasha's Hideous Laughter"));
      expect(screen.getByText('Save DC:')).toBeInTheDocument();
      expect(screen.getByLabelText('Save DC:')).toHaveValue(15);
    });

    it('should allow changing DC and handle invalid input defaulting to 10', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText("Tasha's Hideous Laughter"));
      const dcInput = screen.getByLabelText('Save DC:');
      fireEvent.change(dcInput, { target: { value: '20' } });
      expect(dcInput).toHaveValue(20);
      fireEvent.change(dcInput, { target: { value: 'abc' } });
      expect(dcInput).toHaveValue(10);
    });
  });

  describe('notes field', () => {
    it('should show notes textarea and allow entering notes', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Goad'));
      const textarea = screen.getByPlaceholderText('GM notes about this effect…');
      expect(textarea).toBeInTheDocument();
      fireEvent.change(textarea, { target: { value: 'GM note here' } });
      expect(textarea).toHaveValue('GM note here');
    });
  });

  describe('back navigation', () => {
    it('should go back to browse when Back is clicked', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText('Goad'));
      expect(document.querySelector('.ea-config')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(document.querySelector('.ea-config')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search effects…')).toBeInTheDocument();
    });
  });

  describe('onApply callback', () => {
    it.each`
      effectLabel                    | sourceValue | sourceExpected     | valueExpected | dcExpected | notesExpected
      ${'Goad'}                      | ${'Alice'}  | ${'Alice'}         | ${undefined}  | ${undefined} | ${undefined}
      ${'Goad'}                      | ${'__other__'} | ${'Mysterious Stranger'} | ${undefined} | ${undefined} | ${undefined}
      ${'Goad'}                      | ${''}       | ${undefined}       | ${undefined}  | ${undefined} | ${undefined}
      ${'Next Attack +N Bonus'}      | ${undefined}| ${undefined}       | ${8}          | ${undefined} | ${undefined}
      ${"Tasha's Hideous Laughter"}  | ${'Bob'}    | ${'Bob'}           | ${undefined}  | ${18}      | ${'Boss spell'}
    `('should call onApply with correct data for "$effectLabel"', ({ effectLabel, sourceValue, sourceExpected, valueExpected, dcExpected, notesExpected }) => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      fireEvent.click(screen.getByText(effectLabel));
      if (sourceValue !== undefined) {
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: sourceValue } });
      }
      if (sourceValue === '__other__') {
        const customInput = screen.getByPlaceholderText('Custom source name');
        fireEvent.change(customInput, { target: { value: 'Mysterious Stranger' } });
      }
      if (valueExpected !== undefined) {
        const valueInput = screen.getByLabelText('Value:');
        fireEvent.change(valueInput, { target: { value: '8' } });
      }
      if (dcExpected !== undefined) {
        const dcInput = screen.getByLabelText('Save DC:');
        fireEvent.change(dcInput, { target: { value: '18' } });
      }
      if (notesExpected !== undefined) {
        const textarea = screen.getByPlaceholderText('GM notes about this effect…');
        fireEvent.change(textarea, { target: { value: 'Boss spell' } });
      }
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(props.onApply).toHaveBeenCalledWith('effects', {
        target: 'Goblin',
        effectKey: expect.any(String),
        source: sourceExpected,
        value: valueExpected,
        ability: undefined,
        dc: dcExpected,
        notes: notesExpected,
      });
    });

    it('should not call onApply when no effect is selected in effects tab', () => {
      render(<EffectAdder {...props} initialTab='conditions' />);
      fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
      expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    });
  });
});
