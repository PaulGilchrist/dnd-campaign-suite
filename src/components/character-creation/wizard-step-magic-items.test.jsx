import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepMagicItems from './wizard-step-magic-items.jsx';

vi.mock('./selectable-list.jsx', () => ({
  default: vi.fn(({ title, resultLabel, renderWarnings, items }) => (
     <div data-testid="selectable-list">
       <h2>{title}</h2>
       <div data-testid="result-label">{resultLabel}</div>
       <div data-testid="item-count">{items?.length || 0} items</div>
       {renderWarnings && <div data-testid="warnings">{renderWarnings()}</div>}
     </div>
   ))
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

describe('WizardStepMagicItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  const mockProps = {
    formData: {
      magicItems: ['Wand of Magic'],
     },
    allMagicItems: [
      { name: 'Wand of Magic', index: 'wand', type: 'Rod', rarity: 'Uncommon', description: '<p>A magic wand.</p>', requiresAttunement: false },
      { name: 'Amulet of Health', index: 'amulet', type: 'Amulet', rarity: 'Uncommon', description: '<p>Health amulet.</p>', requiresAttunement: true },
     ],
    ruleset: '5e',
    onArrayFieldChange: vi.fn(),
   };

  it('should render the step title', async () => {
    render(<WizardStepMagicItems {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
     });
   });

  it('should pass items to SelectableList', async () => {
    render(<WizardStepMagicItems {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('2');
     });
   });

  it('should display attunement warning when more than 3 attuned items selected', async () => {
    const attunedItems = [
      { name: 'Item 1', requiresAttunement: true },
      { name: 'Item 2', requiresAttunement: true },
      { name: 'Item 3', requiresAttunement: true },
      { name: 'Item 4', requiresAttunement: true },
     ];
    
    render(
       <WizardStepMagicItems
        {...mockProps}
        formData={{ magicItems: ['Item 1', 'Item 2', 'Item 3', 'Item 4'] }}
        allMagicItems={attunedItems}
       />
     );
    
    await waitFor(() => {
      expect(screen.getByText(/items requiring attunement/)).toBeInTheDocument();
     });
   });

  it('should not show attunement warning when 3 or fewer attuned items', async () => {
    const attunedItems = [
      { name: 'Item 1', requiresAttunement: true },
      { name: 'Item 2', requiresAttunement: false },
     ];
    
    render(
       <WizardStepMagicItems
        {...mockProps}
        formData={{ magicItems: ['Item 1', 'Item 2'] }}
        allMagicItems={attunedItems}
       />
     );
    
    await waitFor(() => {
      expect(screen.queryByText(/items requiring attunement/)).not.toBeInTheDocument();
     });
   });

  it('should pass correct resultLabel to SelectableList', async () => {
    render(<WizardStepMagicItems {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('result-label')).toHaveTextContent('magic item');
     });
   });

  it('should handle empty magic items', async () => {
    render(
       <WizardStepMagicItems
        {...mockProps}
        formData={{ magicItems: [] }}
        allMagicItems={[]}
       />
     );
    
    await waitFor(() => {
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
     });
   });

  it('should handle undefined allMagicItems', async () => {
    const props = {
       ...mockProps,
      allMagicItems: undefined,
     };
    
    render(<WizardStepMagicItems {...props} />);
    
    await waitFor(() => {
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
     });
   });

  it('should handle items with multi-line descriptions', async () => {
    const multiLineItem = {
      name: 'Multi Description Item',
      index: 'multi',
      type: 'Ring',
      rarity: 'Rare',
      description: ['<p>Line 1</p>', '<p>Line 2</p>'],
     };
    
    render(
       <WizardStepMagicItems
        {...mockProps}
        allMagicItems={[multiLineItem]}
       />
     );
    
    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
     });
   });

  it('should handle items with single string description', async () => {
    const singleDescItem = {
      name: 'Single Desc',
      index: 'single',
      type: 'Potion',
      description: '<p>A potion.</p>',
     };
    
    render(
       <WizardStepMagicItems
        {...mockProps}
        allMagicItems={[singleDescItem]}
       />
     );
    
    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
     });
   });
});
