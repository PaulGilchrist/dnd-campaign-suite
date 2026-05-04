import React, { useState, useEffect } from 'react';
// No component-specific CSS needed - uses shared wizard styles
import { isEqual } from 'lodash';

const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.formData === nextProps.formData &&
    prevProps.onInventoryChange === nextProps.onInventoryChange &&
    prevProps.onTempInventoryChange === nextProps.onTempInventoryChange &&
    isEqual(prevProps.tempInventory, nextProps.tempInventory)
  );
};

const WizardStepInventory = React.memo(function WizardStepInventory({ formData, tempInventory, onInventoryChange, onTempInventoryChange }) {
  const [equipmentData, setEquipmentData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEquipment, setFilteredEquipment] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchField, setSearchField] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showOnlySelectedBackpack, setShowOnlySelectedBackpack] = useState(false);
  const [showOnlySelectedEquipped, setShowOnlySelectedEquipped] = useState(false);

  // Load equipment data
  useEffect(() => {
    const loadEquipment = async () => {
      try {
        const response = await fetch('/data/equipment.json');
        const data = await response.json();
        setEquipmentData(data);
      } catch (error) {
        console.error('Failed to load equipment:', error);
        setEquipmentData([]);
      }
    };
    loadEquipment();
  }, []);

  // Filter equipment based on search query and category
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEquipment([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    let results = equipmentData.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.index.toLowerCase().includes(query)
    );

    if (selectedCategory !== 'All') {
      results = results.filter(item => item.equipment_category === selectedCategory);
    }

     // Filter by selected items if the checkbox is checked
    if (showOnlySelectedBackpack && searchField === 'backpack') {
      const currentItems = tempInventory.backpack || [];
      results = results.filter(item => currentItems.includes(item.name));
      }
    if (showOnlySelectedEquipped && searchField === 'equipped') {
      const currentItems = tempInventory.equipped || [];
      results = results.filter(item => currentItems.includes(item.name));
      }

    setFilteredEquipment(results.slice(0, 20));
    }, [searchQuery, selectedCategory, equipmentData, showOnlySelectedBackpack, showOnlySelectedEquipped, searchField, tempInventory.backpack, tempInventory.equipped]);
  const handleSearchFieldFocus = (field) => {
    setSearchField(field);
    setShowSearchModal(true);
    setSearchQuery('');
    setFilteredEquipment([]);
  };

  const handleEquipmentSelect = (item) => {
    if (searchField === 'backpack') {
      const currentItems = tempInventory.backpack;
      if (!currentItems.includes(item.name)) {
        const newItems = [...currentItems, item.name];
        onTempInventoryChange('backpack', newItems);
        onInventoryChange('backpack', newItems);
        setShowSearchModal(false);
        setSearchField(null);
        setSearchQuery('');
        setFilteredEquipment([]);
      }
    } else if (searchField === 'equipped') {
      const currentItems = tempInventory.equipped;
      if (!currentItems.includes(item.name)) {
        const newItems = [...currentItems, item.name];
        onTempInventoryChange('equipped', newItems);
        onInventoryChange('equipped', newItems);
        setShowSearchModal(false);
        setSearchField(null);
        setSearchQuery('');
        setFilteredEquipment([]);
      }
    }
  };

  const handleAddCustomItem = (customItem) => {
    if (searchField === 'backpack') {
      const currentItems = tempInventory.backpack;
      if (!currentItems.includes(customItem)) {
        const newItems = [...currentItems, customItem];
        onTempInventoryChange('backpack', newItems);
        onInventoryChange('backpack', newItems);
      }
    } else if (searchField === 'equipped') {
      const currentItems = tempInventory.equipped;
      if (!currentItems.includes(customItem)) {
        const newItems = [...currentItems, customItem];
        onTempInventoryChange('equipped', newItems);
        onInventoryChange('equipped', newItems);
      }
    }
    setSearchQuery('');
    setShowSearchModal(false);
    setSearchField(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleAddCustomItem(searchQuery.trim());
    }
  };

  const handleManualInputChange = (field, value) => {
    // Convert comma-separated string to array, handling items with commas
    const items = value.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => 
      item.trim().replace(/^"|"$/g, '')
    ).filter(item => item.length > 0);
    
    onTempInventoryChange(field, items);
    onInventoryChange(field, items);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const uniqueCategories = ['All', ...new Set(equipmentData.map(item => item.equipment_category))];

  const renderSearchModal = () => {
    if (!showSearchModal) return null;

    return (
      <div className="equipment-search-modal-overlay">
        <div className="equipment-search-modal">
          <div className="search-modal-header">
            <h3>Select Equipment</h3>
            <button 
              className="close-modal-btn" 
              onClick={() => {
                setShowSearchModal(false);
                setSearchField(null);
                setSearchQuery('');
              }}
            >
              ✕
            </button>
          </div>
          
          <div className="search-modal-body">
            <div className="category-filters">
              {uniqueCategories.map(category => (
                <button
                  key={category}
                  className={`category-filter-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => handleCategoryChange(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="search-input-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>

             <div className="filter-checkbox-group">
               <label className="filter-checkbox-label">
                 <input
                  type="checkbox"
                  checked={searchField === 'backpack' ? showOnlySelectedBackpack : showOnlySelectedEquipped}
                  onChange={(e) => {
                    if (searchField === 'backpack') {
                      setShowOnlySelectedBackpack(e.target.checked);
                     } else if (searchField === 'equipped') {
                      setShowOnlySelectedEquipped(e.target.checked);
                     }
                   }}
                   />
                 Show Only Selected&nbsp;(
                  </label>
                  <span className="filter-checkbox-count">
                    {searchField === 'backpack' ? (tempInventory.backpack || []).length : (tempInventory.equipped || []).length} selected)
                  </span>
              </div>
             <div className="equipment-results">
               {filteredEquipment.length === 0 && searchQuery ? (
                 <div className="no-results">
                  No matches found. Press Enter to add as custom item.
                    </div>
               ) : filteredEquipment.length === 0 ? (
                 <div className="no-results">
                  Start typing to search equipment.
                  </div>
               ) : (
                filteredEquipment.map(item => (
                  <div
                    key={item.index}
                    className="equipment-item"
                    onClick={() => handleEquipmentSelect(item)}
                   >
                     <div className="equipment-item-name">{item.name}</div>
                     <div className="equipment-item-details">
                       <span className="equipment-item-category">{item.equipment_category}</span>
                       <span className="equipment-item-cost">
                         {item.cost?.quantity} {item.cost?.unit}
                       </span>
                       {item.weight && (
                         <span className="equipment-item-weight">
                           {item.weight} lb
                         </span>
                )}
              </div>
            </div>
                 ))
      )}
    </div>

             <div className="search-modal-footer">
               <button
                className="cancel-btn"
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchField(null);
                  setSearchQuery('');
                 }}
               >
                Close
               </button>
             </div>
           </div>
         </div>
       </div>
  );
   };

  const renderInputWithSearch = (label, fieldValue, fieldName, placeholder) => {
    const items = fieldValue; // Already an array
    
    return (
       <div className="form-group">
         <label>{label}</label>
         <div className="searchable-input-container">
           <textarea
            value={items.join(', ')}
            onChange={(e) => handleManualInputChange(fieldName, e.target.value)}
            onBlur={() => {
              // Items are already stored as array, just ensure they're clean
              const cleanItems = items.filter(item => item.trim().length > 0);
              onTempInventoryChange(fieldName, cleanItems);
              onInventoryChange(fieldName, cleanItems);
            }}
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
         'Enter items separated by commas (e.g., Longsword, Chain mail, Shield) or use Search Equipment'
       )}

       {renderSearchModal()}
     </div>
   );
 }, areEqual);
 
 export default WizardStepInventory;

