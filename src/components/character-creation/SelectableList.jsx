import { useState, useMemo } from 'react';

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function SelectableList({
  items,
  fieldName,
  formData,
  onArrayFieldChange,
  title,
  searchPlaceholder,
  filters = [],
  renderItem,
  renderSummary,
  renderWarnings,
  loadingMessage,
  preSelectedItems = [],
  repeatableItems = [],
  className = '',
  resultLabel,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullDetails, setShowFullDetails] = useState({});
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Initialize filter states from config
  const [filterStates, setFilterStates] = useState(() => {
    const states = {};
    filters.forEach(filter => {
      states[filter.field] = filter.defaultLabel || 'All';
    });
    return states;
  });

  // Extract unique filter options from data
  const filterOptions = useMemo(() => {
    const options = {};
    filters.forEach(filter => {
      const optionSet = new Set([filter.defaultLabel || 'All']);
      if (items && items.length > 0) {
        items.forEach(item => {
          const value = filter.getValue ? filter.getValue(item) : item[filter.field];
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => optionSet.add(String(v)));
            } else {
              optionSet.add(String(value));
      }
           }
         });
       }
      options[filter.field] = Array.from(optionSet).sort(filter.sortFn || ((a, b) => a.localeCompare(b)));
    });
    return options;
  }, [items, filters]);

  // Filter items based on search, filters, and showOnlySelected
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    let results = [...items];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(item =>
        item.name?.toLowerCase().includes(query) ||
         (item.index && item.index.toLowerCase().includes(query))
       );
     }

    // Apply type filters
    filters.forEach(filter => {
      const selectedValue = filterStates[filter.field];
      if (selectedValue && selectedValue !== (filter.defaultLabel || 'All')) {
        results = results.filter(item => {
          const value = filter.getValue ? filter.getValue(item) : item[filter.field];
          if (Array.isArray(value)) {
            return value.includes(selectedValue);
          }
          return String(value) === selectedValue;
    });
       }
     });

    // Apply showOnlySelected filter
    if (showOnlySelected) {
      const selectedNames = getNestedValue(formData, fieldName) || [];
      results = results.filter(item => selectedNames.includes(item.name));
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, searchQuery, filterStates, showOnlySelected, formData, fieldName, filters]);

  // Handle item toggle
  const handleItemToggle = (itemName) => {
    const currentItems = getNestedValue(formData, fieldName) || [];
    const isPreSelected = preSelectedItems.includes(itemName);
    const isRepeatable = repeatableItems.includes(itemName);

    if (isPreSelected && !isRepeatable) {
      return;
    }

    const newItems = isRepeatable
       ? currentItems.includes(itemName)
         ? currentItems.filter(i => i !== itemName)
         : [...currentItems, itemName]
       : currentItems.includes(itemName)
         ? currentItems.filter(i => i !== itemName)
         : [...currentItems, itemName];
    onArrayFieldChange(fieldName, newItems);
  };

  // Handle removing one instance of a repeatable item
  const handleRemoveItem = (itemName) => {
    const currentItems = getNestedValue(formData, fieldName) || [];
    const isPreSelected = preSelectedItems.includes(itemName);
    const isRepeatable = repeatableItems.includes(itemName);

    if (!isRepeatable) {
      return;
    }

    const count = currentItems.filter(i => i === itemName).length;
    if (isPreSelected && count <= 1) {
      return;
    }

    const lastIndexOf = (arr, name) => {
      let idx = -1;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] === name) {
          idx = i;
          break;
        }
      }
      return idx;
    };

    const removeIdx = lastIndexOf(currentItems, itemName);
    if (removeIdx === -1) {
      return;
    }

    const newItems = [...currentItems];
    newItems.splice(removeIdx, 1);
    onArrayFieldChange(fieldName, newItems);
  };

  // Check if item is selected
  const itemIsSelected = (itemName) => {
    return (getNestedValue(formData, fieldName) || []).includes(itemName);
  };

  // Count how many times an item appears in the selection
  const getItemCount = (itemName) => {
    const currentItems = getNestedValue(formData, fieldName) || [];
    return currentItems.filter(i => i === itemName).length;
  };

  // Check if item is pre-selected
  const itemIsPreSelected = (itemName) => {
    return preSelectedItems.includes(itemName);
  };

  // Toggle full details for an item
  const toggleFullDetails = (itemIndex) => {
    setShowFullDetails(prev => ({
       ...prev,
       [itemIndex]: !prev[itemIndex]
     }));
   };

  // Handle filter change
  const handleFilterChange = (filterField, value) => {
    setFilterStates(prev => ({
       ...prev,
       [filterField]: value
     }));
   };

  // Render loading/empty state
  if (!items || items.length === 0) {
    return (
       <div className={`wizard-step ${className}`}>
         <h2>{title}</h2>
         <div className="no-results-found">
           {loadingMessage || 'Data not yet loaded. Please try again.'}
         </div>
       </div>
     );
   }

  // Render the main UI
  return (
     <div className={`wizard-step ${className}`}>
       <h2>{title}</h2>

       {/* Optional summary section */}
       {renderSummary && renderSummary()}

       {/* Optional warnings section */}
       {renderWarnings && renderWarnings()}

       {/* Filter controls */}
       <div className="list-filter-container">
         <div className="filter-group">
           <label htmlFor={`${fieldName}-search`}>Search {title}</label>
           <input
            type="text"
            id={`${fieldName}-search`}
            className={`${fieldName}-search-input`}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
           />
         </div>

         {/* Render filter dropdowns */}
         {filters.map(filter => (
           <div key={filter.field} className="filter-group">
             <label htmlFor={`${fieldName}-${filter.field}-filter`}>{filter.label}</label>
             <select
              id={`${fieldName}-${filter.field}-filter`}
              className={`${filter.className || `${filter.field}-filter`}`}
              value={filterStates[filter.field]}
              onChange={(e) => handleFilterChange(filter.field, e.target.value)}
             >
               {(filterOptions[filter.field] || []).map(option => (
                 <option key={option} value={option}>
                   {filter.renderOption ? filter.renderOption(option) : option}
                 </option>
               ))}
             </select>
           </div>
         ))}

         {/* Show Only Selected checkbox */}
         <div className="filter-group">
           <label className="filter-checkbox-label">
             <input
              type="checkbox"
              checked={showOnlySelected}
              onChange={(e) => setShowOnlySelected(e.target.checked)}
            />
            Show Only Selected&nbsp;(
           </label>
           <span className="filter-checkbox-count">
              {(getNestedValue(formData, fieldName) || []).length} selected)
           </span>
         </div>
       </div>

       {/* Results container */}
       <div className={`list-results-container ${className}-results-container`}>
         <div className={`list-results-header ${className}-results-header`}>
           <span className="result-count">
            Showing {filteredItems.length} {resultLabel || 'item'}{filteredItems.length !== 1 ? 's' : ''}
           </span>
         </div>

         <div className={`list-results-list ${className}-results-list`}>
           {filteredItems.length === 0 ? (
             <div className="no-results-found">
               {searchQuery || filters.some(f => filterStates[f.field] !== (f.defaultLabel || 'All'))
                 ? `No ${resultLabel || 'items'} found matching your criteria.`
                 : `No ${resultLabel || 'items'} available.`}
             </div>
           ) : (
              filteredItems.map((item, index) =>
                renderItem(item, index, {
                  isSelected: itemIsSelected(item.name),
                  isPreSelected: itemIsPreSelected(item.name),
                  isExpanded: showFullDetails[index],
                  onToggle: () => handleItemToggle(item.name),
                  onRemove: () => handleRemoveItem(item.name),
                  onToggleExpand: () => toggleFullDetails(index),
                  itemCount: getItemCount(item.name),
                 })
               )
           )}
         </div>
       </div>
     </div>
   );
}

export default SelectableList;