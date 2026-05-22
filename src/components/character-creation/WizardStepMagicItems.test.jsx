import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepMagicItems from './WizardStepMagicItems.jsx';

vi.mock('./SelectableList.jsx', () => ({
  default: vi.fn(({ title, resultLabel, renderWarnings, items, renderItem }) => (
     <div data-testid="selectable-list">
       <h2>{title}</h2>
       <div data-testid="result-label">{resultLabel}</div>
       <div data-testid="item-count">{items?.length || 0} items</div>
       {renderWarnings && <div data-testid="warnings">{renderWarnings()}</div>}
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

vi.mock('../../services/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

describe('WizardStepMagicItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  const mockProps = {
    formData: {
      inventory: {
        magicItems: ['Wand of Magic'],
      },
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
        formData={{ inventory: { magicItems: ['Item 1', 'Item 2', 'Item 3', 'Item 4'] } }}
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
        formData={{ inventory: { magicItems: ['Item 1', 'Item 2'] } }}
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
        formData={{ inventory: { magicItems: [] } }}
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

  it('should display item type for magic items', async () => {
    render(<WizardStepMagicItems {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Rod')).toBeInTheDocument();
      expect(screen.getByText('Amulet')).toBeInTheDocument();
     });
   });

  it('should display item rarity for magic items', async () => {
    const { container } = render(<WizardStepMagicItems {...mockProps} />);

    await waitFor(() => {
      const rarities = container.querySelectorAll('.magic-item-rarity');
      expect(rarities.length).toBe(2);
      expect(rarities[0]).toHaveTextContent('Uncommon');
     });
   });

  it('should show item description for expanded item', async () => {
    const { container } = render(<WizardStepMagicItems {...mockProps} />);

    await waitFor(() => {
      expect(container.querySelector('.magic-item-description')).toBeInTheDocument();
      expect(screen.getByText('A magic wand.')).toBeInTheDocument();
     });
   });

  it('should show Show Less for expanded items and Show More for collapsed items', async () => {
    render(<WizardStepMagicItems {...mockProps} />);

    await waitFor(() => {
      // First item is expanded -> "Show Less"
      expect(screen.getByText('Show Less')).toBeInTheDocument();
      // Second item is collapsed -> "Show More"
      expect(screen.getByText('Show More')).toBeInTheDocument();
     });
   });

  it('should render additional description lines for array descriptions', async () => {
    const multiLineItem = {
      name: 'Multi Desc Item',
      index: 'multi',
      type: 'Ring',
      rarity: 'Rare',
      description: ['<p>First paragraph.</p>', '<p>Second paragraph.</p>'],
     };
    
    const { container } = render(
       <WizardStepMagicItems
        {...mockProps}
        allMagicItems={[multiLineItem]}
       />
      );

    await waitFor(() => {
      expect(container.querySelector('.magic-item-description')).toBeInTheDocument();
      expect(container.querySelector('.magic-item-more-description')).toBeInTheDocument();
      expect(container.querySelector('.magic-item-more-description')).toHaveTextContent('Second paragraph.');
     });
   });

  it('should not render more-description for single-item array descriptions', async () => {
    const singleArrayItem = {
      name: 'Single Array',
      index: 'single-array',
      type: 'Scroll',
      description: ['<p>Only one entry.</p>'],
     };
    
    const { container } = render(
       <WizardStepMagicItems
        {...mockProps}
        allMagicItems={[singleArrayItem]}
       />
      );

    await waitFor(() => {
      expect(container.querySelector('.magic-item-description')).toBeInTheDocument();
      expect(container.querySelector('.magic-item-more-description')).not.toBeInTheDocument();
     });
   });
});
