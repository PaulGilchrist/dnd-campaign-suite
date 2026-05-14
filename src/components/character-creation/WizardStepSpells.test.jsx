import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';

vi.mock('./SelectableList.jsx', () => ({
  default: vi.fn(({ title, resultLabel, renderSummary, items }) => (
     <div data-testid="selectable-list">
       <h2>{title}</h2>
       <div data-testid="result-label">{resultLabel}</div>
       <div data-testid="item-count">{items?.length || 0} items</div>
       {renderSummary && <div data-testid="summary">{renderSummary()}</div>}
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
});
