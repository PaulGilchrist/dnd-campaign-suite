import { useState, useMemo, useCallback } from 'react';

export function useCrudList(items, searchFields = ['name']) {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items || [];
    const q = searchQuery.toLowerCase();
    return (items || []).filter(item =>
      searchFields.some(field => String(item[field] || '').toLowerCase().includes(q))
    );
  }, [items, searchQuery, searchFields]);

  const openNew = useCallback((defaultData) => {
    setFormData(defaultData || {});
    setEditingItem(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item) => {
    setFormData({ ...item });
    setEditingItem(item);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setFormData(null);
    setEditingItem(null);
  }, []);

  const updateFormField = useCallback((field, value) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : prev);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    modalOpen,
    editingItem,
    formData,
    setFormData,
    saving,
    setSaving,
    openNew,
    openEdit,
    closeModal,
    updateFormField,
  };
}
