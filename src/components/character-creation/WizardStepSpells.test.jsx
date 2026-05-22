import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';
import * as spellLimits from '../../services/spellLimits.js';
import * as spellValidation from '../../services/spellValidation.js';

vi.mock('./SelectableList.jsx', () => ({
  default: vi.fn(({ title, resultLabel, renderSummary, items, renderItem }) => (
     <div data-testid="selectable-list">
       <h2>{title}</h2>
       <div data-testid="result-label">{resultLabel}</div>
       <div data-testid="item-count">{items?.length || 0} items</div>
       {renderSummary && <div data-testid="summary">{renderSummary()}</div>}
       {items && items.map((item, index) =>
         renderItem ? renderItem(item, index, {
           isSelected: index === 0,
           isPreSelected: false,
           isExpanded: index === 0,
           onToggle: () => {},
           onToggleExpand: () => {},
         }) : null
       )}
     </div>
   ))
}));

vi.mock('../../services/spellLimits.js', () => ({
  getSpellLimits: vi.fn(() => Promise.resolve({ cantrip: 3, level1: 2, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 })),
  validateSpellSelection: vi.fn(() => Promise.resolve({ valid: true, violations: [] })),
}));

vi.mock('../../services/spellValidation.js', () => ({
  getSpellValidationInfo: vi.fn(() => Promise.resolve({ warnings: [] })),
}));

describe('WizardStepSpells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

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

  it('should render step title', async () => {
    render(<WizardStepSpells {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
     });
   });

  it('should pass spells to SelectableList', async () => {
    render(<WizardStepSpells {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('2');
     });
   });

  it('should display spell summary', async () => {
    render(<WizardStepSpells {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Spell Selection Summary')).toBeInTheDocument();
     });
   });

  it('should display cantrip count', async () => {
    render(<WizardStepSpells {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cantrips:')).toBeInTheDocument();
     });
   });

  it('should display level counts', async () => {
    render(<WizardStepSpells {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('1th level:')).toBeInTheDocument();
    });
  });

  it('should pass correct resultLabel', async () => {
    render(<WizardStepSpells {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('result-label')).toHaveTextContent('spell');
     });
   });

  it('should handle empty spells', async () => {
    const emptyProps = {
       ...mockProps,
      formData: { ...mockProps.formData, spells: [] },
     };
    
    render(<WizardStepSpells {...emptyProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
     });
   });

  it('should handle undefined formData', async () => {
    render(
       <WizardStepSpells
        formData={{}}
        allSpells={[]}
        onArrayFieldChange={vi.fn()}
       />
     );
    
    await waitFor(() => {
      expect(screen.getByText('Step 9: Spells')).toBeInTheDocument();
     });
   });

  it('should handle spells with various levels', async () => {
    const variedSpells = [
      { name: 'Cantrip', level: 0, school: 'Evocation', classes: ['Wizard'], desc: [] },
      { name: 'Level 1', level: 1, school: 'Conjuration', classes: ['Wizard'], desc: [] },
      { name: 'Level 5', level: 5, school: 'Necromancy', classes: ['Wizard'], desc: [] },
      { name: 'Level 9', level: 9, school: 'Evocation', classes: ['Wizard'], desc: [] },
     ];
    
    render(
       <WizardStepSpells
        {...mockProps}
        allSpells={variedSpells}
        formData={{ ...mockProps.formData, spells: ['Cantrip', 'Level 1', 'Level 5', 'Level 9'] }}
       />
     );
    
    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
     });
   });

  it('should handle spells without level (defaults to 0)', async () => {
    const noLevelSpell = { name: 'No Level', school: 'Abjuration', classes: ['Wizard'], desc: [] };
    
    render(
       <WizardStepSpells
        {...mockProps}
        allSpells={[noLevelSpell]}
        formData={{ ...mockProps.formData, spells: ['No Level'] }}
       />
     );
    
    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
     });
   });

  it('should handle non-spellcasting class warning', async () => {
    const barbarianProps = {
       ...mockProps,
      formData: {
        class: { name: 'Barbarian' },
        level: 3,
        spells: ['Healing Word'],
       },
      };
    
    render(<WizardStepSpells {...barbarianProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
     });
   });

  describe('Spell limit error handling', () => {
    it('should catch error when getSpellLimits rejects and use default limits', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      spellLimits.getSpellLimits.mockRejectedValueOnce(new Error('Network error'));

      render(
        <WizardStepSpells
          formData={{ class: { name: 'Wizard' }, level: 5, spells: [] }}
          allSpells={[]}
          onArrayFieldChange={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching spell limits:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Spell validation warnings', () => {
    it('should display spell validation warnings in summary', async () => {
      spellValidation.getSpellValidationInfo.mockResolvedValueOnce({
        warnings: [{ message: 'Spell chosen outside of class spell list', type: 'warning' }],
      });

      render(
        <WizardStepSpells
          {...mockProps}
          formData={{ ...mockProps.formData, spells: ['Fireball', 'Unknown Spell'] }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Spell chosen outside/)).toBeInTheDocument();
      });
    });

    it('should not show warnings when none returned', async () => {
      render(<WizardStepSpells {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/Spell chosen outside/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Spell level classes', () => {
    it('should apply cantrip class for level 0 spells', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[
            { name: 'Cantrip Spell', index: 'cantrip', level: 0, school: 'Evocation', desc: ['test'], classes: ['Wizard'] },
          ]}
          formData={{ ...mockProps.formData, spells: [] }}
        />
      );

      await waitFor(() => {
        const levelSpan = container.querySelector('.spell-level');
        expect(levelSpan).toHaveClass('cantrip');
        expect(levelSpan).not.toHaveClass('low');
      });
    });

    it('should apply low class for level 1-3 spells', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[
            { name: 'Level 2 Spell', index: 'lvl2', level: 2, school: 'Conjuration', desc: ['test'], classes: ['Wizard'] },
          ]}
          formData={{ ...mockProps.formData, spells: [] }}
        />
      );

      await waitFor(() => {
        const levelSpan = container.querySelector('.spell-level');
        expect(levelSpan).toHaveClass('low');
        expect(levelSpan).not.toHaveClass('mid');
        expect(levelSpan).not.toHaveClass('high');
      });
    });

    it('should apply mid class for level 4-5 spells', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[
            { name: 'Level 4 Spell', index: 'lvl4', level: 4, school: 'Divination', desc: ['test'], classes: ['Wizard'] },
          ]}
          formData={{ ...mockProps.formData, spells: [] }}
        />
      );

      await waitFor(() => {
        const levelSpan = container.querySelector('.spell-level');
        expect(levelSpan).toHaveClass('mid');
        expect(levelSpan).not.toHaveClass('low');
        expect(levelSpan).not.toHaveClass('high');
      });
    });

    it('should apply high class for level 6-9 spells', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[
            { name: 'Level 7 Spell', index: 'lvl7', level: 7, school: 'Necromancy', desc: ['test'], classes: ['Wizard'] },
          ]}
          formData={{ ...mockProps.formData, spells: [] }}
        />
      );

      await waitFor(() => {
        const levelSpan = container.querySelector('.spell-level');
        expect(levelSpan).toHaveClass('high');
        expect(levelSpan).not.toHaveClass('mid');
      });
    });
  });

  describe('Expanded spell details', () => {
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
      higher_level: ['When cast at higher levels...'],
    };

    it('should show ritual and concentration tags in spell meta', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[richSpell]}
          formData={{ ...mockProps.formData, spells: ['Bless'] }}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.spell-ritual')).toHaveTextContent('Ritual');
        expect(container.querySelector('.spell-concentration')).toHaveTextContent('Concentration');
      });
    });

    it('should show duration and casting time in spell meta', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[richSpell]}
          formData={{ ...mockProps.formData, spells: ['Bless'] }}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.spell-duration')).toHaveTextContent('Duration: Concentration, up to 1 minute');
        expect(container.querySelector('.spell-casting-time')).toHaveTextContent('Casting: 1 action');
      });
    });

    it('should show spell description when expanded', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[richSpell]}
          formData={{ ...mockProps.formData, spells: ['Bless'] }}
        />
      );

      await waitFor(() => {
        const descriptionDiv = container.querySelector('.spell-description');
        expect(descriptionDiv).toBeInTheDocument();
        expect(descriptionDiv).toHaveTextContent('You bless your allies');
      });
    });

    it('should show components list', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[richSpell]}
          formData={{ ...mockProps.formData, spells: ['Bless'] }}
        />
      );

      await waitFor(() => {
        const componentsDiv = container.querySelector('.spell-components');
        expect(componentsDiv).toBeInTheDocument();
        expect(componentsDiv).toHaveTextContent('V, S, M');
      });
    });

    it('should show damage type when present', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[richSpell]}
          formData={{ ...mockProps.formData, spells: ['Bless'] }}
        />
      );

      await waitFor(() => {
        const damageDiv = container.querySelector('.spell-damage');
        expect(damageDiv).toBeInTheDocument();
        expect(damageDiv).toHaveTextContent('Radiant');
      });
    });

    it('should show material component', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[richSpell]}
          formData={{ ...mockProps.formData, spells: ['Bless'] }}
        />
      );

      await waitFor(() => {
        const materialDiv = container.querySelector('.spell-material');
        expect(materialDiv).toBeInTheDocument();
        expect(materialDiv).toHaveTextContent('a holy symbol');
      });
    });

    it('should show higher level description when present', async () => {
      const { container } = render(
        <WizardStepSpells
          {...mockProps}
          allSpells={[richSpell]}
          formData={{ ...mockProps.formData, spells: ['Bless'] }}
        />
      );

      await waitFor(() => {
        const higherLevelDiv = container.querySelector('.spell-higher-level');
        expect(higherLevelDiv).toBeInTheDocument();
        expect(higherLevelDiv).toHaveTextContent(/higher levels/i);
      });
    });
  });
});
