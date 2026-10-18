// @maintained-by-ai
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';
import SelectableList from './SelectableList.jsx';
import * as spellLimits from '../../services/rules/spells/spellLimits.js';
import * as spellValidation from '../../services/rules/spells/spellValidation.js';

vi.mock('./SelectableList.jsx', () => ({
  default: vi.fn(({
    title,
    resultLabel,
    renderSummary,
    items = [],
    renderItem,
    className,
    filters = [],
    searchPlaceholder,
  }) => {
    const defaultSort = (a, b) => String(a).localeCompare(String(b));
    return (
      <div data-testid="selectable-list" className={className}>
        <h2>{title}</h2>
        {searchPlaceholder && <input placeholder={searchPlaceholder} readOnly />}
        {resultLabel && <div data-testid="result-label">{resultLabel}</div>}
        {filters.map((filter) => (
          <div key={filter.field} data-testid={`filter-${filter.field}`}>
            {[...new Set(items.flatMap(filter.getValue))]
              .sort(filter.sortFn || defaultSort)
              .map((value) => (
                <span key={value}>{filter.renderOption ? filter.renderOption(value) : value}</span>
              ))}
          </div>
        ))}
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

const defaultSpellLimits = {
  cantrip: 3,
  level1: 2, level2: 0, level3: 0, level4: 0,
  level5: 0, level6: 0, level7: 0, level8: 0, level9: 0,
  spellType: 'known',
  preparedSpells: null,
};

vi.mock('../../services/rules/spells/spellLimits.js', () => ({
  getSpellLimits: vi.fn(() => Promise.resolve(defaultSpellLimits)),
  validateSpellSelection: vi.fn(() => Promise.resolve({ valid: true, violations: [] })),
}));

vi.mock('../../services/rules/spells/spellValidation.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getSpellValidationInfo: vi.fn(() => Promise.resolve({ warnings: [] })),
}));

const spell = (name, level, extra = {}) => ({
  name,
  index: name.toLowerCase().replace(/\s+/g, '_'),
  level,
  school: 'Evocation',
  classes: ['Wizard'],
  description: [`${name} description.`],
  ...extra,
});

const makeProps = ({ spells = ['Fireball'], allSpells = null, ...overrides } = {}) => ({
  stepNumber: 14,
  formData: {
    class: { name: 'Wizard', subclass: { name: 'Evocation' } },
    level: 5,
    rules: '5e',
    spells,
  },
  allSpells: allSpells || [
    spell('Fireball', 3, { school: 'Evocation' }),
    spell('Magic Missile', 0),
  ],
  onArrayFieldChange: vi.fn(),
  ...overrides,
});

// Shared helper to reduce per-test setup noise
const setSpellLimits = (overrides = {}) => {
  spellLimits.getSpellLimits.mockResolvedValueOnce({ ...defaultSpellLimits, ...overrides });
};

describe('WizardStepSpells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step title, spell rows, auto-assigned label, and wires the spells field and search to SelectableList', async () => {
    const props = makeProps({ preSelectedSpells: ['Magic Missile'] });
    render(<WizardStepSpells {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Step 14: Spells')).toBeInTheDocument();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('(Auto-assigned)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search spells...')).toBeInTheDocument();
      expect(screen.getByTestId('result-label')).toHaveTextContent('spell');
    });

    const listProps = SelectableList.mock.calls.at(-1)[0];
    expect(listProps.fieldName).toBe('spells');
    expect(listProps.onArrayFieldChange).toBe(props.onArrayFieldChange);
    expect(listProps.preSelectedItems).toEqual(['Magic Missile']);
  });

  describe('known-spell summary', () => {
    it('renders the exact per-level count breakdown', async () => {
      setSpellLimits({ cantrip: 3, level1: 2, level2: 4 });
      const allSpells = [spell('Magic Missile', 0), spell('Shield', 1), spell('Misty Step', 2)];
      render(<WizardStepSpells {...makeProps({ spells: ['Magic Missile', 'Shield', 'Misty Step'], allSpells })} />);

      await waitFor(() => {
        expect(screen.getByText('Spell Selection Summary')).toBeInTheDocument();
        expect(screen.getByText('Cantrips:')).toBeInTheDocument();
        expect(screen.getByText('1/3')).toBeInTheDocument();
        expect(screen.getByText('1th level:')).toBeInTheDocument();
        expect(screen.getByText('1/2')).toBeInTheDocument();
        expect(screen.getByText('2th level:')).toBeInTheDocument();
        expect(screen.getByText('1/4')).toBeInTheDocument();
      });
      // Remaining seven levels render explicit zero counts; prepared mode is off
      expect(screen.getAllByText('0/0')).toHaveLength(7);
      expect(screen.queryByText('Prepared Spells:')).not.toBeInTheDocument();
    });

    it('flags only the exceeded count with the exceeded class', async () => {
      setSpellLimits({ cantrip: 3, level1: 2 });
      const allSpells = [
        spell('C1', 0), spell('C2', 0), spell('C3', 0), spell('C4', 0), spell('L1', 1),
      ];
      render(<WizardStepSpells {...makeProps({ spells: ['C1', 'C2', 'C3', 'C4', 'L1'], allSpells })} />);

      await waitFor(() => {
        expect(screen.getByText('4/3')).toBeInTheDocument();
      });
      expect(screen.getByText('4/3')).toHaveClass('exceeded');
      expect(screen.getByText('1/2')).not.toHaveClass('exceeded');
    });

    it('does not crash or miscount when a selected spell is missing from allSpells', async () => {
      const allSpells = [spell('Magic Missile', 0)];
      render(<WizardStepSpells {...makeProps({ spells: ['Magic Missile', 'NonExistentSpell'], allSpells })} />);

      await waitFor(() => {
        expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
        // Only the known spell counts toward the cantrip total
        expect(screen.getByText('1/3')).toBeInTheDocument();
      });
      expect(screen.queryByText('NonExistentSpell')).not.toBeInTheDocument();
    });

    it('excludes pre-selected spells from cantrip and level counts', async () => {
      setSpellLimits({ cantrip: 3, level1: 1 });
      const allSpells = [
        spell('PreSelCantrip', 0), spell('PreSel1', 1), spell('PreSel2', 1), spell('UserSpell', 1),
      ];
      render(<WizardStepSpells {...makeProps({
        spells: ['PreSelCantrip', 'PreSel1', 'PreSel2', 'UserSpell'],
        allSpells,
        preSelectedSpells: ['PreSelCantrip', 'PreSel1', 'PreSel2'],
      })} />);

      await waitFor(() => {
        // All three level-1 spells selected, but two are pre-selected: 1/1
        expect(screen.getByText('1/1')).toBeInTheDocument();
        // The only cantrip is pre-selected: 0/3
        expect(screen.getByText('0/3')).toBeInTheDocument();
      });
    });
  });

  describe('prepared-spell mode', () => {
    it('replaces the per-level breakdown with one prepared count and flags it when exceeded', async () => {
      setSpellLimits({ spellType: 'prepared', preparedSpells: 1 });
      const allSpells = [spell('Light', 0), spell('Shield', 1), spell('Detect Magic', 1)];
      render(<WizardStepSpells {...makeProps({ spells: ['Light', 'Shield', 'Detect Magic'], allSpells })} />);

      await waitFor(() => {
        expect(screen.getByText('Prepared Spells:')).toBeInTheDocument();
        expect(screen.getByText('2/1')).toHaveClass('exceeded');
        expect(screen.getByText('1/3')).toBeInTheDocument();
      });
      expect(screen.queryByText('1th level:')).not.toBeInTheDocument();
    });
  });

  describe('spell list filtered to available spell slots', () => {
    it('hides unselected spells above the highest slot level but keeps selected ones for deselection', async () => {
      setSpellLimits({ cantrip: 3, level1: 4, level2: 3 });
      const allSpells = [
        spell('Booming Blade', 0), spell('Level1', 1), spell('Level2', 2),
        spell('Level3Hidden', 3), spell('SelectedHigh', 3),
      ];
      render(<WizardStepSpells {...makeProps({ spells: ['SelectedHigh'], allSpells })} />);

      await waitFor(() => {
        expect(screen.getByText('Booming Blade')).toBeInTheDocument();
        expect(screen.getByText('Level1')).toBeInTheDocument();
        expect(screen.getByText('Level2')).toBeInTheDocument();
        expect(screen.getByText('SelectedHigh')).toBeInTheDocument();
      });
      expect(screen.queryByText('Level3Hidden')).not.toBeInTheDocument();
    });

    it('offers only cantrips when the class has no spell slots at this level', async () => {
      setSpellLimits({ cantrip: 2, level1: 0 });
      const allSpells = [spell('OnlyCantrip', 0), spell('SlotSpell', 1)];
      render(<WizardStepSpells {...makeProps({ spells: [], allSpells })} />);

      await waitFor(() => {
        expect(screen.getByText('OnlyCantrip')).toBeInTheDocument();
        expect(screen.getByText('0/2')).toBeInTheDocument();
      });
      expect(screen.queryByText('SlotSpell')).not.toBeInTheDocument();
    });
  });

  it('extends Wizard spells into Fighter and Rogue class-filter options and labels cantrip levels', async () => {
    render(<WizardStepSpells {...makeProps()} />);

    await waitFor(() => {
      const classFilter = within(screen.getByTestId('filter-class'));
      expect(classFilter.getByText('Wizard')).toBeInTheDocument();
      expect(classFilter.getByText('Fighter')).toBeInTheDocument();
      expect(classFilter.getByText('Rogue')).toBeInTheDocument();
    });
    const levelFilter = within(screen.getByTestId('filter-level'));
    expect(levelFilter.getByText('Cantrip')).toBeInTheDocument();
    expect(levelFilter.getByText('3')).toBeInTheDocument();
  });

  describe('validation warnings', () => {
    it('renders warnings returned by getSpellValidationInfo', async () => {
      spellValidation.getSpellValidationInfo.mockResolvedValueOnce({
        warnings: [{ message: 'Spell chosen outside of class spell list', type: 'warning' }],
      });
      render(<WizardStepSpells {...makeProps({ spells: ['Fireball', 'Unknown Spell'] })} />);

      await waitFor(() => {
        expect(screen.getByText(/Spell chosen outside/)).toBeInTheDocument();
      });
    });

    it('does not call getSpellValidationInfo when no spells are selected', async () => {
      render(<WizardStepSpells {...makeProps({ spells: [] })} />);

      await waitFor(() => {
        expect(screen.getByText('Spell Selection Summary')).toBeInTheDocument();
      });
      expect(spellValidation.getSpellValidationInfo).not.toHaveBeenCalled();
    });

    it('logs the error and renders no warnings when getSpellValidationInfo rejects', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      spellValidation.getSpellValidationInfo.mockRejectedValueOnce(new Error('Validation error'));
      render(<WizardStepSpells {...makeProps()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error validating spells:', expect.any(Error));
        expect(screen.getByText('Spell Selection Summary')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Warning/i)).not.toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  it('logs the error and falls back to wizard defaults when getSpellLimits rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    spellLimits.getSpellLimits.mockRejectedValueOnce(new Error('Network error'));
    render(<WizardStepSpells {...makeProps({ spells: [], allSpells: [] })} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching spell limits:', expect.any(Error));
      // Fallback limits (cantrip: 4) are visible in the summary
      expect(screen.getByText('0/4')).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  describe('spell detail tags', () => {
    const richSpell = spell('Bless', 1, {
      school: 'Abjuration',
      ritual: true,
      concentration: true,
      components: ['V', 'S', 'M'],
      material: 'a holy symbol',
      damage: { damage_type: 'Radiant' },
      casting_time: '1 action',
      duration: 'Concentration, up to 1 minute',
    });

    it('shows every detail tag when spell properties are present', async () => {
      const { container } = render(<WizardStepSpells {...makeProps({ spells: ['Bless'], allSpells: [richSpell] })} />);

      await waitFor(() => {
        expect(container.querySelector('.spell-ritual')).toHaveTextContent('Ritual');
        expect(container.querySelector('.spell-concentration')).toHaveTextContent('Concentration');
        expect(container.querySelector('.spell-duration')).toHaveTextContent('Duration: Concentration, up to 1 minute');
        expect(container.querySelector('.spell-casting-time')).toHaveTextContent('Casting: 1 action');
        expect(container.querySelector('.spell-description')).toHaveTextContent('Bless description.');
        expect(container.querySelector('.spell-components')).toHaveTextContent('V, S, M');
        expect(container.querySelector('.spell-damage')).toHaveTextContent('Radiant');
        expect(container.querySelector('.spell-material')).toHaveTextContent('a holy symbol');
        expect(container.querySelector('.spell-school')).toHaveTextContent('Abjuration');
      });
    });

    it('omits detail tags when properties are absent and defaults school to Unknown', async () => {
      const bareSpell = {
        ...richSpell,
        ritual: false, concentration: false, duration: null,
        components: [], damage: null, material: null, school: undefined,
      };
      const { container } = render(<WizardStepSpells {...makeProps({ spells: ['Bless'], allSpells: [bareSpell] })} />);

      await waitFor(() => {
        expect(container.querySelector('.spell-ritual')).not.toBeInTheDocument();
        expect(container.querySelector('.spell-concentration')).not.toBeInTheDocument();
        expect(container.querySelector('.spell-duration')).not.toBeInTheDocument();
        expect(container.querySelector('.spell-components')).not.toBeInTheDocument();
        expect(container.querySelector('.spell-damage')).not.toBeInTheDocument();
        expect(container.querySelector('.spell-material')).not.toBeInTheDocument();
        expect(container.querySelector('.spell-school')).toHaveTextContent('Unknown');
      });
    });
  });
});
