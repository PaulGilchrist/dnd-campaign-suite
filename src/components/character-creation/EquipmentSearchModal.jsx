import React from 'react';

const EquipmentSearchModal = ({
  showSearchModal,
  onClose,
  filteredEquipment,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  showOnlySelected,
  onShowOnlySelectedChange,
  onEquipmentSelect,
  onAddCustomItem,
  currentItemCount,
  searchField,
  uniqueCategories = ['All']
}) => {
  if (!showSearchModal) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onAddCustomItem(searchQuery.trim());
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="equipment-search-modal-overlay">
      <div className="equipment-search-modal">
        <div className="search-modal-header">
          <h3>Select Equipment</h3>
          <button
            className="close-modal-btn"
            onClick={handleClose}
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
                onClick={() => onCategoryChange(category)}
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
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div className="filter-checkbox-group">
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={showOnlySelected}
                onChange={(e) => onShowOnlySelectedChange(e.target.checked)}
              />
              Show Only Selected&nbsp;(
            </label>
            <span className="filter-checkbox-count">
              {currentItemCount} selected)
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
                  onClick={() => onEquipmentSelect(item)}
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
        </div>

        <div className="search-modal-footer">
          <button
            className="cancel-btn"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentSearchModal;
