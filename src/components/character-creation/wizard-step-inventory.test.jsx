import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepInventory from './wizard-step-inventory';

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
        { name: 'Longsword', index: 'longsword', equipment_category: 'Weapons', cost: { quantity: 15, unit: 'gp' }, weight: 3 },
        { name: 'Chain Mail', index: 'chain_mail', equipment_category: 'Armor', cost: { quantity: 75, unit: 'gp' }, weight: 55 },
       ]),
     });
});

describe('WizardStepInventory', () => {
  const mockProps = {
    formData: { inventory: { gold: 100 } },
    tempInventory: { backpack: ['Longsword'], equipped: ['Chain Mail'] },
    onInventoryChange: vi.fn(),
    onTempInventoryChange: vi.fn(),
      };

  beforeEach(() => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
          { name: 'Longsword', index: 'longsword', equipment_category: 'Weapons', cost: { quantity: 15, unit: 'gp' }, weight: 3 },
          { name: 'Chain Mail', index: 'chain_mail', equipment_category: 'Armor', cost: { quantity: 75, unit: 'gp' }, weight: 55 },
          ]),
        });
     });

  it('should render inventory step header', () => {
    render(<WizardStepInventory {...mockProps} />);
    expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
     });

  it('should render gold input', () => {
    render(<WizardStepInventory {...mockProps} />);
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
     });

  it('should render backpack label', () => {
    render(<WizardStepInventory {...mockProps} />);
    expect(screen.getByText('Backpack Items')).toBeInTheDocument();
     });

  it('should render equipped label', () => {
    render(<WizardStepInventory {...mockProps} />);
    expect(screen.getByText('Equipped Items')).toBeInTheDocument();
     });

   it('should display items preview for backpack', () => {
    render(<WizardStepInventory {...mockProps} />);
    const itemCounts = screen.getAllByText(/1 item/);
    expect(itemCounts.length).toBeGreaterThan(0);
    });

  it('should display multiple items count', () => {
    const multiItems = {
          ...mockProps,
      tempInventory: { backpack: ['Item A', 'Item B', 'Item C'], equipped: [] },
        };

    render(<WizardStepInventory {...multiItems} />);
    expect(screen.getByText(/3 items/)).toBeInTheDocument();
     });

   it('should render search equipment button', () => {
    render(<WizardStepInventory {...mockProps} />);
    const buttons = screen.getAllByText(/Search Equipment/);
    expect(buttons.length).toBe(2); // One for backpack, one for equipped
    });

  it('should not render modal when not active', () => {
    render(<WizardStepInventory {...mockProps} />);
    expect(screen.queryByText('Select Equipment')).not.toBeInTheDocument();
     });

  it('should render textarea for backpack items', () => {
    render(<WizardStepInventory {...mockProps} />);
    const textarea = screen.getByDisplayValue('Longsword');
    expect(textarea).toBeInTheDocument();
     });

  it('should call onManualInputChange when textarea changes', () => {
    const mockOnChange = vi.fn();
    render(
         <WizardStepInventory
          {...mockProps}
         onTempInventoryChange={mockOnChange}
         onInventoryChange={mockOnChange}
          />
        );

    const textarea = document.querySelector('textarea');
    fireEvent.change(textarea, { target: { value: 'Sword, Shield' } });

    expect(mockOnChange).toHaveBeenCalled();
     });

  it('should handle empty inventory', () => {
    const emptyInv = {
          ...mockProps,
      tempInventory: { backpack: [], equipped: [] },
        };

    render(<WizardStepInventory {...emptyInv} />);
    expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
     });

   it('should render field description', () => {
    render(<WizardStepInventory {...mockProps} />);
    const descriptions = screen.getAllByText(/Enter items separated by commas/);
    expect(descriptions.length).toBe(2); // One for backpack, one for equipped
    });
});
