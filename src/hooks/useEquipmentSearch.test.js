import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEquipmentSearch } from '../../hooks/useEquipmentSearch.js';

vi.mock('../../services/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([
    { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' },
    { name: 'Shield', index: 'shield', equipment_category: 'Armor' },
    { name: 'Rope', index: 'rope', equipment_category: 'Adventuring Gear' },
    { name: 'Quarterstaff', index: 'quarterstaff', equipment_category: 'Weapon' },
  ])),
}));

describe('useEquipmentSearch', () => {
  const defaultTempInventory = { backpack: [], equipped: [] };

  const Wrapper = (props) => {
    const hookResult = useEquipmentSearch(
      props.tempInventory || defaultTempInventory,
      props.onTempInventoryChange || vi.fn(),
      props.onInventoryChange || vi.fn(),
    );
    return (
      <div>
        <div data-testid="search-query">{hookResult.searchQuery}</div>
        <div data-testid="filtered-count">{hookResult.filteredEquipment.length}</div>
        <div data-testid="categories">{hookResult.uniqueCategories.join(',')}</div>
        <div data-testid="search-field">{hookResult.searchField || 'null'}</div>
        <div data-testid="show-backpack">{hookResult.showOnlySelectedBackpack ? 'true' : 'false'}</div>
        <div data-testid="show-equipped">{hookResult.showOnlySelectedEquipped ? 'true' : 'false'}</div>
        <input
          data-testid="search-input"
          value={hookResult.searchQuery}
          onChange={(e) => hookResult.setSearchQuery(e.target.value)}
          onKeyDown={(e) => hookResult.handleKeyDown(e)}
        />
        <select
          data-testid="category-select"
          value={hookResult.selectedCategory}
          onChange={(e) => hookResult.handleCategoryChange(e.target.value)}
        >
          {hookResult.uniqueCategories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button data-testid="focus-backpack" onClick={() => hookResult.handleSearchFieldFocus('backpack')}>Focus Backpack</button>
        <button data-testid="focus-equipped" onClick={() => hookResult.handleSearchFieldFocus('equip')}>Focus Equipped</button>
        <button data-testid="select-item" onClick={() => hookResult.handleEquipmentSelect({ name: 'Longsword', index: 'longsword' })}>Select</button>
        <button data-testid="add-custom" onClick={() => hookResult.handleAddCustomItem('Custom Item')}>Add Custom</button>
        <button data-testid="toggle-backpack" onClick={() => hookResult.setShowOnlySelectedBackpack(!hookResult.showOnlySelectedBackpack)}>Toggle BP</button>
        <button data-testid="toggle-equipped" onClick={() => hookResult.setShowOnlySelectedEquipped(!hookResult.showOnlySelectedEquipped)}>Toggle EQ</button>
        <ul>
          {hookResult.filteredEquipment.map(item => (
            <li key={item.index} data-testid={`item-${item.name}`}>{item.name}</li>
          ))}
        </ul>
      </div>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with empty search query', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('search-query').textContent).toBe('');
  });

  it('should start with All category', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('category-select').value).toBe('All');
  });

  it('should filter equipment by search query', async () => {
    render(<Wrapper />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('filtered-count').textContent).toBe('0');
    });
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'long' } });
    await vi.waitFor(() => {
      expect(screen.getByTestId('filtered-count').textContent).toBe('1');
    });
  });

  it('should filter equipment by index', async () => {
    render(<Wrapper />);
    await vi.waitFor(() => {
      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'shield' } });
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId('item-Shield')).toBeInTheDocument();
    });
  });

  it('should filter by category', async () => {
    render(<Wrapper />);
    await vi.waitFor(() => {
      fireEvent.change(screen.getByTestId('search-input'), { target: { value: '' } });
      fireEvent.change(screen.getByTestId('category-select'), { target: { value: 'Weapon' } });
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId('filtered-count').textContent).toBe('0');
    });
  });

  it('should show unique categories', async () => {
    render(<Wrapper />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('categories').textContent).toContain('All');
      expect(screen.getByTestId('categories').textContent).toContain('Weapon');
      expect(screen.getByTestId('categories').textContent).toContain('Armor');
    });
  });

  it('should clear results when query is empty', async () => {
    render(<Wrapper />);
    await vi.waitFor(() => {
      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'long' } });
    });
    await vi.waitFor(() => {
      fireEvent.change(screen.getByTestId('search-input'), { target: { value: '' } });
    });
    expect(screen.getByTestId('filtered-count').textContent).toBe('0');
  });

  it('should handle search field focus', () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByTestId('focus-backpack'));
    expect(screen.getByTestId('search-field').textContent).toBe('backpack');
  });

  it('should clear search query on field focus', () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'long' } });
    fireEvent.click(screen.getByTestId('focus-equipped'));
    expect(screen.getByTestId('search-query').textContent).toBe('');
  });

  it('should add equipment to backpack on select', () => {
    const onTempInventoryChange = vi.fn();
    const onInventoryChange = vi.fn();
    render(<Wrapper
      tempInventory={{ backpack: [], equipped: [] }}
      onTempInventoryChange={onTempInventoryChange}
      onInventoryChange={onInventoryChange}
    />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'long' } });
    fireEvent.click(screen.getByTestId('select-item'));
    expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Longsword']);
    expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Longsword']);
  });

  it('should not add duplicate equipment to backpack', () => {
    const onTempInventoryChange = vi.fn();
    render(<Wrapper
      tempInventory={{ backpack: ['Longsword'], equipped: [] }}
      onTempInventoryChange={onTempInventoryChange}
      onInventoryChange={vi.fn()}
    />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'long' } });
    fireEvent.click(screen.getByTestId('select-item'));
    expect(onTempInventoryChange).not.toHaveBeenCalled();
  });

  it('should handle custom item add', () => {
    const onTempInventoryChange = vi.fn();
    render(<Wrapper
      tempInventory={{ backpack: [], equipped: [] }}
      onTempInventoryChange={onTempInventoryChange}
      onInventoryChange={vi.fn()}
    />);
    fireEvent.click(screen.getByTestId('focus-backpack'));
    fireEvent.click(screen.getByTestId('add-custom'));
    expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Custom Item']);
  });

  it('should not add duplicate custom item', () => {
    const onTempInventoryChange = vi.fn();
    render(<Wrapper
      tempInventory={{ backpack: ['Custom Item'], equipped: [] }}
      onTempInventoryChange={onTempInventoryChange}
      onInventoryChange={vi.fn()}
    />);
    fireEvent.click(screen.getByTestId('focus-backpack'));
    fireEvent.click(screen.getByTestId('add-custom'));
    expect(onTempInventoryChange).not.toHaveBeenCalled();
  });

  it('should handle Enter key to add custom item', () => {
    const onTempInventoryChange = vi.fn();
    render(<Wrapper
      tempInventory={{ backpack: [], equipped: [] }}
      onTempInventoryChange={onTempInventoryChange}
      onInventoryChange={vi.fn()}
    />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Magic Sword' } });
    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Enter' });
    expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
  });

  it('should handle category change', () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByTestId('category-select'), { target: { value: 'Weapon' } });
    expect(screen.getByTestId('category-select').value).toBe('Weapon');
  });

  it('should show backpack filter toggle', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('show-backpack').textContent).toBe('false');
    fireEvent.click(screen.getByTestId('toggle-backpack'));
    expect(screen.getByTestId('show-backpack').textContent).toBe('true');
  });

  it('should show equipped filter toggle', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('show-equipped').textContent).toBe('false');
    fireEvent.click(screen.getByTestId('toggle-equipped'));
    expect(screen.getByTestId('show-equipped').textContent).toBe('true');
  });
});
