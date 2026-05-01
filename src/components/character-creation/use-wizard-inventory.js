import { useState, useEffect, useCallback } from 'react';

function useWizardInventory(formData) {
  const [tempInventory, setTempInventory] = useState({ backpack: [], equipped: [] });

  useEffect(() => {
    setTempInventory({
      backpack: formData.inventory?.backpack || [],
      equipped: formData.inventory?.equipped || [],
       });
      }, [formData.inventory]);

  const updateTempInventory = useCallback((field, value) => {
    setTempInventory(prev => ({ ...prev, [field]: value }));
     }, []);

  return {
    tempInventory,
    updateTempInventory,
      };
}

export default useWizardInventory;