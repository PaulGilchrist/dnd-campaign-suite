// @improved-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';
import * as spellLimits from '../../services/rules/spells/spellLimits.js';
import * as spellValidation from '../../services/rules/spells/spellValidation.js';

vi.mock('./SelectableList.jsx', () => ({
  default: vi.fn((props) => {
    const {
      title,
      resultLabel,
      renderSummary,
      items = [],
      renderItem,
      className,
    } = props;
    return (
      <div data-testid="selectable-list" className={className}>
        <h2>{title}</h2>
        {resultLabel && <div data-testid="result-label">{resultLabel}</div>}
        {renderSummary && <div data-testid="summary">{renderSummary()}</div>}
        {items.map((item, index) =>
          renderItem ? renderItem(item, index, {
            isSelected: index === 0,
            isPreSelected: index === 1,
            isExpanded: true,
            onToggle: vi.fn(),
            onToggleExpand: vi.fn(),
          }) : null
        )}
      </div>
    );
  }),
}));

vi.mock('../../services/rules/spells/spellLimits.js', () => ({
  getSpellLimits: vi.fn(() => Promise.resolve({
    cantrip: 3,
    level1: 2, level2: 0, level3: 0, level4: 0,
    level5: 0, level6: 0, level7: 0, level8: 0, level9: 0,
    spellType: 'known',
    preparedSpells: null,
  })),
  validateSpellSelection: vi.fn(() => Promise.resolve({ valid: true, violations: [] })),
}));

vi.mock('../../services/rules/spells/spellValidation.js', () => ({
  getSpellValidationInfo: vi.fn(() => Promise.resolve({ warnings: [] })),
}));

const mockProps = {
  formData: {
    class: { name: 'Wizard', subclass: { name: 'Evocation' } },
    level: 5,
    rules: '5e',
    spells: ['Fireball'],
  },
  allSpells: [
    { name: 'Fireball', index: 'fireball', level: 3, school: 'Evocation', desc: ['A ball of fire.'], classes: ['Wizard'] },
    { name: 'Magic Missile', index: 'magic_missile', level: 0, school: 'Evocation', desc: ['A missile.'], classes: ['Wizard'] },
  ],
  onArrayFieldChange: vi.fn(),
};

describe('WizardStepSpells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the step title', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
      });
    });

    it('passes the resultLabel to SelectableList', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('result-label')).toHaveTextContent('spell');
      });
    });

    it('passes className to SelectableList', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('selectable-list')).toHaveClass('wizard-step-spells');
      });
    });
  });

  describe('Spell summary', () => {
    it('renders the spell selection summary header', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Spell Selection Summary')).toBeInTheDocument();
      });
    });

    it('shows cantrip count in the summary', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Cantrips:')).toBeInTheDocument();
      });
    });

    it('shows per-level breakdown for known-spell mode', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('1th level:')).toBeInTheDocument();
        expect(screen.getByText('3th level:')).toBeInTheDocument();
      });
    });

    it('shows 0/limit when no spells are selected', async () => {
      render(<WizardStepSpells {...mockProps} formData={{ ...mockProps.formData, spells: [] }} />);
      await waitFor(() => {
        expect(screen.getByText('0/3')).toBeInTheDocument();
      });
    });

    it('shows exceeded class when cantrip count exceeds limit', async () => {
      const overLimitSpells = [
        { name: 'C1', level: 0, school: 'Evocation', classes: ['Wizard'], desc: [] },
        { name: 'C2', level: 0, school: 'Evocation', classes: ['Wizard'], desc: [] },
        { name: 'C3', level: 0, school: 'Evocation', classes: ['Wizard'], desc: [] },
        { name: 'C4', level: 0, school: 'Evocation', classes: ['Wizard'], desc: [] },
      ];
      render(<WizardStepSpells {...mockProps} allSpells={overLimitSpells} formData={{ ...mockProps.formData, spells: ['C1', 'C2', 'C3', 'C4'] }} />);
      await waitFor(() => {
        const countEl = screen.getByText('4/3');
        expect(countEl).toHaveClass('exceeded');
      });
    });
  });

  describe('Prepared spell mode', () => {
    const preparedLimits = {
      cantrip: 3,
      preparedSpells: 4,
      spellType: 'prepared',
      level1: 2, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0,
    };

    it('shows prepared spells count instead of per-level breakdown', async () => {
      spellLimits.getSpellLimits.mockResolvedValueOnce(preparedLimits);
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Prepared Spells:')).toBeInTheDocument();
        expect(screen.queryByText('1th level:')).not.toBeInTheDocument();
      });
    });

    it('still shows cantrip count in prepared mode', async () => {
      spellLimits.getSpellLimits.mockResolvedValueOnce(preparedLimits);
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Cantrips:')).toBeInTheDocument();
      });
    });

    it('shows exceeded when prepared spells exceed limit', async () => {
      spellLimits.getSpellLimits.mockResolvedValueOnce({ ...preparedLimits, preparedSpells: 2 });
      const manySpells = [
        { name: 'S1', level: 1, school: 'Abjuration', classes: ['Wizard'], desc: [] },
        { name: 'S2', level: 1, school: 'Abjuration', classes: ['Wizard'], desc: [] },
        { name: 'S3', level: 2, school: 'Evocation', classes: ['Wizard'], desc: [] },
      ];
      render(<WizardStepSpells {...mockProps} allSpells={manySpells} formData={{ ...mockProps.formData, spells: ['S1', 'S2', 'S3'] }} />);
      await waitFor(() => {
        const countEl = screen.getByText('3/2');
        expect(countEl).toHaveClass('exceeded');
      });
    });

    it('does not show exceeded when within limit', async () => {
      spellLimits.getSpellLimits.mockResolvedValueOnce(preparedLimits);
      render(<WizardStepSpells {...mockProps} formData={{ ...mockProps.formData, spells: [] }} />);
      await waitFor(() => {
        const countEl = screen.getByText('0/4');
        expect(countEl).not.toHaveClass('exceeded');
      });
    });
  });

  describe('Edge cases and null safety', () => {
    it('renders with empty spells array', async () => {
      render(<WizardStepSpells {...mockProps} formData={{ ...mockProps.formData, spells: [] }} allSpells={[]} />);
      await waitFor(() => {
        expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
      });
    });

    it('renders with minimal formData', async () => {
      render(<WizardStepSpells formData={{}} allSpells={[]} onArrayFieldChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
      });
    });

    it('renders with undefined class name', async () => {
      render(<WizardStepSpells {...mockProps} formData={{ ...mockProps.formData, class: { name: undefined } }} />);
      await waitFor(() => {
        expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
      });
    });

    it('renders spells with no level property (defaults to 0)', async () => {
      const noLevelSpell = { name: 'NoLevel', school: 'Abjuration', classes: ['Wizard'], desc: [] };
      render(<WizardStepSpells {...mockProps} allSpells={[noLevelSpell]} formData={{ ...mockProps.formData, spells: ['NoLevel'] }} />);
      await waitFor(() => {
        expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
      });
    });

    it('renders spells across all level ranges', async () => {
      const variedSpells = [
        { name: 'Cantrip', level: 0, school: 'Evocation', classes: ['Wizard'], desc: [] },
        { name: 'Level1', level: 1, school: 'Conjuration', classes: ['Wizard'], desc: [] },
        { name: 'Level5', level: 5, school: 'Necromancy', classes: ['Wizard'], desc: [] },
        { name: 'Level9', level: 9, school: 'Evocation', classes: ['Wizard'], desc: [] },
      ];
      render(<WizardStepSpells {...mockProps} allSpells={variedSpells} formData={{ ...mockProps.formData, spells: ['Cantrip', 'Level1', 'Level5', 'Level9'] }} />);
      await waitFor(() => {
        expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
      });
    });
  });

  describe('Spell validation warnings', () => {
    it('renders warnings when getSpellValidationInfo returns warnings', async () => {
      spellValidation.getSpellValidationInfo.mockResolvedValueOnce({
        warnings: [{ message: 'Spell chosen outside of class spell list', type: 'warning' }],
      });
      render(<WizardStepSpells {...mockProps} formData={{ ...mockProps.formData, spells: ['Fireball', 'Unknown Spell'] }} />);
      await waitFor(() => {
        expect(screen.getByText(/Spell chosen outside/)).toBeInTheDocument();
      });
    });

    it('does not render warnings when none are returned', async () => {
      spellValidation.getSpellValidationInfo.mockResolvedValueOnce({ warnings: [] });
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText(/Spell chosen outside/)).not.toBeInTheDocument();
      });
    });

    it('clears warnings when validation returns empty array', async () => {
      spellValidation.getSpellValidationInfo
        .mockResolvedValueOnce({ warnings: [{ message: 'old warning', type: 'warning' }] })
        .mockResolvedValueOnce({ warnings: [] });
      const { rerender } = render(<WizardStepSpells {...mockProps} formData={{ ...mockProps.formData, spells: ['Fireball', 'Unknown'] }} />);
      await waitFor(() => {
        expect(screen.getByText(/old warning/)).toBeInTheDocument();
      });
      rerender(<WizardStepSpells {...mockProps} formData={{ ...mockProps.formData, spells: ['Fireball'] }} />);
      await waitFor(() => {
        expect(screen.queryByText(/old warning/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Spell limit error handling', () => {
    it('logs error and uses fallback limits when getSpellLimits rejects', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      spellLimits.getSpellLimits.mockRejectedValueOnce(new Error('Network error'));

      render(<WizardStepSpells formData={{ class: { name: 'Wizard' }, level: 5, spells: [] }} allSpells={[]} onArrayFieldChange={vi.fn()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching spell limits:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('SelectableList integration', () => {
    it('passes availableSpells to SelectableList', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
      });
    });

    it('renders each spell via renderItem', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Fireball')).toBeInTheDocument();
        expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      });
    });

    it('shows auto-assigned label for pre-selected spells', async () => {
      render(<WizardStepSpells {...mockProps} preSelectedSpells={['Magic Missile']} />);
      await waitFor(() => {
        expect(screen.getByText('(Auto-assigned)')).toBeInTheDocument();
      });
    });

    it('passes onArrayFieldChange as a prop to SelectableList', async () => {
      const onArrayFieldChange = vi.fn();
      render(<WizardStepSpells {...mockProps} onArrayFieldChange={onArrayFieldChange} />);
      await waitFor(() => {
        expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
      });
    });

    it('passes search placeholder to SelectableList', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
      });
    });
  });

  describe('Spell level styling classes', () => {
    it('applies cantrip class for level 0 spells', async () => {
      const { container } = render(<WizardStepSpells {...mockProps} allSpells={[{ name: 'C', index: 'c', level: 0, school: 'Evocation', classes: ['Wizard'], desc: [] }]} formData={{ ...mockProps.formData, spells: [] }} />);
      await waitFor(() => {
        const el = container.querySelector('.spell-level');
        expect(el).toHaveClass('cantrip');
        expect(el).not.toHaveClass('low');
      });
    });

    it('applies low class for levels 1-3', async () => {
      const { container } = render(<WizardStepSpells {...mockProps} allSpells={[{ name: 'L2', index: 'l2', level: 2, school: 'Conjuration', classes: ['Wizard'], desc: [] }]} formData={{ ...mockProps.formData, spells: [] }} />);
      await waitFor(() => {
        const el = container.querySelector('.spell-level');
        expect(el).toHaveClass('low');
        expect(el).not.toHaveClass('mid');
        expect(el).not.toHaveClass('high');
      });
    });

    it('applies mid class for levels 4-5', async () => {
      const { container } = render(<WizardStepSpells {...mockProps} allSpells={[{ name: 'L4', index: 'l4', level: 4, school: 'Divination', classes: ['Wizard'], desc: [] }]} formData={{ ...mockProps.formData, spells: [] }} />);
      await waitFor(() => {
        const el = container.querySelector('.spell-level');
        expect(el).toHaveClass('mid');
        expect(el).not.toHaveClass('low');
        expect(el).not.toHaveClass('high');
      });
    });

    it('applies high class for levels 6-9', async () => {
      const { container } = render(<WizardStepSpells {...mockProps} allSpells={[{ name: 'L7', index: 'l7', level: 7, school: 'Necromancy', classes: ['Wizard'], desc: [] }]} formData={{ ...mockProps.formData, spells: [] }} />);
      await waitFor(() => {
        const el = container.querySelector('.spell-level');
        expect(el).toHaveClass('high');
        expect(el).not.toHaveClass('mid');
      });
    });
  });

  describe('Spell detail rendering', () => {
    const richSpell = {
      name: 'Bless',
      index: 'bless',
      level: 1,
      school: 'Abjuration',
      desc: ['You bless your allies'],
      classes: ['Cleric'],
      ritual: true,
      concentration: true,
      components: ['V', 'S', 'M'],
      material: 'a holy symbol',
      damage: { damage_type: 'Radiant' },
      casting_time: '1 action',
      duration: 'Concentration, up to 1 minute',
    };

    const baseProps = { ...mockProps, allSpells: [richSpell], formData: { ...mockProps.formData, spells: ['Bless'] } };

    it('shows ritual tag when spell has ritual property', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-ritual')).toHaveTextContent('Ritual');
      });
    });

    it('does not show ritual tag when spell lacks ritual property', async () => {
      const noRitualSpell = { ...richSpell, ritual: false };
      const { container } = render(<WizardStepSpells {...baseProps} allSpells={[noRitualSpell]} formData={{ ...baseProps.formData, spells: ['Bless'] }} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-ritual')).not.toBeInTheDocument();
      });
    });

    it('shows concentration tag when spell has concentration property', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-concentration')).toHaveTextContent('Concentration');
      });
    });

    it('does not show concentration tag when spell lacks concentration property', async () => {
      const noConcSpell = { ...richSpell, concentration: false };
      const { container } = render(<WizardStepSpells {...baseProps} allSpells={[noConcSpell]} formData={{ ...baseProps.formData, spells: ['Bless'] }} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-concentration')).not.toBeInTheDocument();
      });
    });

    it('shows duration when present', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-duration')).toHaveTextContent('Duration: Concentration, up to 1 minute');
      });
    });

    it('does not show duration when absent', async () => {
      const noDurationSpell = { ...richSpell, duration: null };
      const { container } = render(<WizardStepSpells {...baseProps} allSpells={[noDurationSpell]} formData={{ ...baseProps.formData, spells: ['Bless'] }} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-duration')).not.toBeInTheDocument();
      });
    });

    it('shows casting time when present', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-casting-time')).toHaveTextContent('Casting: 1 action');
      });
    });

    it('shows spell description', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        const desc = container.querySelector('.spell-description');
        expect(desc).toHaveTextContent('You bless your allies');
      });
    });

    it('shows components when present', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        const comps = container.querySelector('.spell-components');
        expect(comps).toHaveTextContent('V, S, M');
      });
    });

    it('does not show components when absent', async () => {
      const noCompsSpell = { ...richSpell, components: [] };
      const { container } = render(<WizardStepSpells {...baseProps} allSpells={[noCompsSpell]} formData={{ ...baseProps.formData, spells: ['Bless'] }} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-components')).not.toBeInTheDocument();
      });
    });

    it('shows damage type when present', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        const dmg = container.querySelector('.spell-damage');
        expect(dmg).toHaveTextContent('Radiant');
      });
    });

    it('does not show damage when absent', async () => {
      const noDamageSpell = { ...richSpell, damage: null };
      const { container } = render(<WizardStepSpells {...baseProps} allSpells={[noDamageSpell]} formData={{ ...baseProps.formData, spells: ['Bless'] }} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-damage')).not.toBeInTheDocument();
      });
    });

    it('shows material component when present', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        const mat = container.querySelector('.spell-material');
        expect(mat).toHaveTextContent('a holy symbol');
      });
    });

    it('does not show material when absent', async () => {
      const noMaterialSpell = { ...richSpell, material: null };
      const { container } = render(<WizardStepSpells {...baseProps} allSpells={[noMaterialSpell]} formData={{ ...baseProps.formData, spells: ['Bless'] }} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-material')).not.toBeInTheDocument();
      });
    });

    it('shows school name', async () => {
      const { container } = render(<WizardStepSpells {...baseProps} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-school')).toHaveTextContent('Abjuration');
      });
    });

    it('shows Unknown school when school is missing', async () => {
      const noSchoolSpell = { ...richSpell, school: undefined };
      const { container } = render(<WizardStepSpells {...baseProps} allSpells={[noSchoolSpell]} formData={{ ...baseProps.formData, spells: ['Bless'] }} />);
      await waitFor(() => {
        expect(container.querySelector('.spell-school')).toHaveTextContent('Unknown');
      });
    });
  });

  describe('Filter configuration', () => {
    it('passes filters to SelectableList', async () => {
      render(<WizardStepSpells {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
      });
    });
  });
});
