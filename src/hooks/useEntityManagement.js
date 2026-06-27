import { useState, useCallback, useEffect } from 'react';

export function useEntityManagement(campaignName, { load: loadFn, save: saveFn, delete: deleteFn }, options = {}) {
  const {
    responseKey,
    loadOnMount = true,
    logError = true,
  } = options;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadItems = useCallback(async () => {
    if (!campaignName) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const response = await loadFn(campaignName);
      const data = responseKey ? (response?.[responseKey] ?? []) : response;
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      if (logError) console.error(`Failed to load ${responseKey || 'items'} list:`, error);
    } finally {
      setLoading(false);
    }
  }, [campaignName, loadFn, responseKey, logError]);

  const saveItems = useCallback(async (array) => {
    if (!campaignName) return;
    try {
      await saveFn(campaignName, array);
      await loadItems();
    } catch (error) {
      if (logError) console.error(`Failed to save ${responseKey || 'items'}:`, error);
      throw error;
    }
  }, [campaignName, saveFn, loadItems, responseKey, logError]);

  const deleteItem = useCallback(async (id) => {
    if (!campaignName) return;
    try {
      await deleteFn(campaignName, id);
      await loadItems();
    } catch (error) {
      if (logError) console.error(`Failed to delete ${responseKey || 'item'}:`, error);
      throw error;
    }
  }, [campaignName, deleteFn, loadItems, responseKey, logError]);

  useEffect(() => {
    if (loadOnMount && campaignName) loadItems();
  }, [campaignName, loadItems, loadOnMount]);

  return { items, loading, loadItems, saveItems, deleteItem };
}
