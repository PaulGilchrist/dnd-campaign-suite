import { useState, useEffect, useMemo } from 'react';

export function useEquipmentSearch(tempInventory, onTempInventoryChange, onInventoryChange) {
  const [equipmentData, setEquipmentData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEquipment, setFilteredEquipment] = useState([]);
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

    setSearchField(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleAddCustomItem(searchQuery.trim());
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const uniqueCategories = useMemo(
    () => ['All', ...new Set(equipmentData.map(item => item.equipment_category))],
    [equipmentData]
  );

  return {
    equipmentData,
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
    handleKeyDown,
    handleCategoryChange,
    handleSearchFieldFocus,
    uniqueCategories,
  };
}
