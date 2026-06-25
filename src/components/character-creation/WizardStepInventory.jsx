import React, { useState, useEffect } from 'react';
// No component-specific CSS needed - uses shared wizard styles
import { useEquipmentSearch } from '../../hooks/ui/useEquipmentSearch.js';
import EquipmentSearchModal from './EquipmentSearchModal.jsx';

const WizardStepInventory = React.memo(function WizardStepInventory({ formData, tempInventory, onInventoryChange, onTempInventoryChange }) {
  const {
    searchQuery,
    setSearchQuery,
    filteredEquipment,
    selectedCategory,
    showOnlySelectedBackpack,
    setShowOnlySelectedBackpack,
    showOnlySelectedEquipped,
    setShowOnlySelectedEquipped,
    searchField,
    setSearchField,
    handleEquipmentSelect,
    handleAddCustomItem,
    handleCategoryChange,
    handleSearchFieldFocus,
  } = useEquipmentSearch(tempInventory, onTempInventoryChange, onInventoryChange);

  // Raw text state for each textarea field - allows free typing including commas
  const [rawTexts, setRawTexts] = useState({ backpack: '', equipped: '' });
  // Track which field's textarea currently has focus
  const [focusedField, setFocusedField] = useState(null);

  // Sync raw text from items array when items change AND the field is NOT focused
  // This ensures the textarea updates when the search modal adds an item
  useEffect(() => {
    if (!focusedField) {
      setRawTexts({
        backpack: (tempInventory.backpack || []).join(', '),
        equipped: (tempInventory.equipped || []).join(', '),
      });
    }
  }, [tempInventory.backpack, tempInventory.equipped, focusedField]);

  const handleManualInputChange = (field, value) => {
    const items = value.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item =>
      item.trim().replace(/^"|"$/g, '')
    ).filter(item => item.length > 0);

    onTempInventoryChange(field, items);
    onInventoryChange(field, items);
  };

  const commitRawText = (fieldName) => {
    const raw = rawTexts[fieldName] || '';
    handleManualInputChange(fieldName, raw);
  };

  const renderInputWithSearch = (label, fieldValue, fieldName, placeholder) => {
    const items = fieldValue;

    // Initialize raw text from items if empty (first render)
    const currentRaw = rawTexts[fieldName] !== undefined ? rawTexts[fieldName] : items.join(', ');

    const handleRawChange = (e) => {
      setRawTexts(prev => ({
        ...prev,
        [fieldName]: e.target.value,
      }));
    };

    const handleBlur = () => {
      commitRawText(fieldName);
      setFocusedField(null);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitRawText(fieldName);
      }
    };

    const handleFocus = () => {
      setFocusedField(fieldName);
    };

    return (
      <div className="form-group">
        <label>{label}</label>
        <div className="searchable-input-container">
          <textarea
            value={currentRaw}
            onChange={handleRawChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder}
            rows={3}
            className="inventory-textarea"
          />
          <div className="searchable-input-controls">
            <button
              type="button"
              className="search-equipment-btn"
              onClick={() => handleSearchFieldFocus(fieldName)}
            >
              🔍 Search Equipment
            </button>
          </div>
          {items.length > 0 && (
            <div className="inventory-items-preview">
              <span className="items-count">{items.length} item{items.length > 1 ? 's' : ''}</span>
              <div className="items-list">
                {items.slice(0, 5).map((item, idx) => (
                  <span key={idx} className="item-tag">{item}</span>
                ))}
                {items.length > 5 && (
                  <span className="item-tag more-items">+{items.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>
        <p className="field-description">{placeholder}</p>
      </div>
    );
  };

  return (
    <div className="wizard-step">
      <h2>Step 11: Inventory</h2>

      <div className="form-group">
        <label>Gold Pieces *</label>
        <input
          type="number"
          min="0"
          value={formData.inventory.gold}
          onChange={(e) => onInventoryChange('gold', parseInt(e.target.value) || 0)}
        />
      </div>

      {renderInputWithSearch(
        'Backpack Items',
        tempInventory.backpack,
        'backpack',
        'Enter items separated by commas (e.g., Rope, Hempen, Torch, rations) or use Search Equipment'
      )}

      {renderInputWithSearch(
        'Equipped Items',
        tempInventory.equipped,
        'equipped',
        'Enter items separated by commas (e.g., Longsword, Chain mail, Shield) or use Search Equipment. First weapon will be in main hand, and second weapon will be in offhand.'
      )}

      <EquipmentSearchModal
        showSearchModal={searchField !== null}
        onClose={() => {
          setFocusedField(null);
          setSearchField(null);
          setSearchQuery('');
        }}
        filteredEquipment={filteredEquipment}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        showOnlySelected={searchField === 'backpack' ? showOnlySelectedBackpack : showOnlySelectedEquipped}
        onShowOnlySelectedChange={(checked) => {
          if (searchField === 'backpack') {
            setShowOnlySelectedBackpack(checked);
          } else if (searchField === 'equipped') {
            setShowOnlySelectedEquipped(checked);
          }
        }}
        onEquipmentSelect={handleEquipmentSelect}
        onAddCustomItem={handleAddCustomItem}
        currentItemCount={searchField === 'backpack' ? (tempInventory.backpack || []).length : (tempInventory.equipped || []).length}
        searchField={searchField}
      />
    </div>
  );
});

export default WizardStepInventory;
