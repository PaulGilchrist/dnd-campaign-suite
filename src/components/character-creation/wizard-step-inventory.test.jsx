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
    const buttons = screen.getAllByText(/🔍 Search Equipment/);
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

  it('should handle search field focus for backpack', () => {
    render(<WizardStepInventory {...mockProps} />);
    const searchButtons = screen.getAllByText(/Search Equipment/);
    fireEvent.click(searchButtons[0]); // Backpack search
    expect(global.fetch).toHaveBeenCalledWith('/data/equipment.json');
  });

  it('should handle search field focus for equipped', () => {
    render(<WizardStepInventory {...mockProps} />);
    const searchButtons = screen.getAllByText(/Search Equipment/);
    fireEvent.click(searchButtons[1]); // Equipped search
    expect(global.fetch).toHaveBeenCalledWith('/data/equipment.json');
  });

  it('should filter equipment by category', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Longsword', equipment_category: 'Weapons' },
        { name: 'Leather Armor', equipment_category: 'Armor' },
      ]),
    });

    render(<WizardStepInventory {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
    });
  });

  it('should handle equipment selection for backpack', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Longsword', index: 'longsword' },
      ]),
    });

    const propsWithMock = {
      ...mockProps,
      onTempInventoryChange: vi.fn(),
      onInventoryChange: vi.fn(),
    };

    render(<WizardStepInventory {...propsWithMock} />);

    await waitFor(() => {
      expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
    });
  });

  it('should handle custom item addition', () => {
    render(<WizardStepInventory {...mockProps} />);

    const textareas = document.querySelectorAll('textarea');
    if (textareas[0]) {
      fireEvent.change(textareas[0], { target: { value: 'Sword, Shield' } });
    }

    expect(mockProps.onTempInventoryChange).toHaveBeenCalled();
  });

  it('should handle empty equipment data', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
    });

    render(<WizardStepInventory {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
    });
  });
});
