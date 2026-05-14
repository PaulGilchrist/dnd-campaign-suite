import { useCallback } from 'react';

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();

  // Start with a shallow copy of the root
  let result = { ...obj };
  let current = result;

  // For each intermediate key, create a new object copy
  for (const key of keys) {
    current[key] = { ...(current[key] || {}) };
    current = current[key];
  }

  // Set the final value
  current[lastKey] = value;
  return result;
}

export default function useWizardArrayToggle(
  setFormData,
  setErrors,
  fieldName,
  preSelectedItems
) {
  const clearError = useCallback(() => {
    setErrors(prev => ({ ...prev, [fieldName]: null }));
  }, [setErrors, fieldName]);

  const toggleItem = useCallback(
    (item, opt) => {
      setFormData(prev => {
        const current = getNestedValue(prev, fieldName) || [];
        const copiedCurrent = [...current];

        if (typeof opt === 'boolean' && opt) {
          return prev;
        }

        if (typeof opt === 'object' && opt !== null && opt.isPreSelected) {
          return prev;
        }

        const index = copiedCurrent.indexOf(item);

        if (index !== -1 && preSelectedItems && preSelectedItems.includes(item)) {
          return prev;
        }

        if (index !== -1) {
          copiedCurrent.splice(index, 1);
        } else {
          copiedCurrent.push(item);
        }

        clearError();
        const result = { ...prev };
        return setNestedValue(result, fieldName, copiedCurrent);
      });
    },
    [setFormData, fieldName, preSelectedItems, clearError]
  );

  const setItem = useCallback(
    (item) => {
      setFormData(prev => {
        const current = getNestedValue(prev, fieldName) || [];
        const updated = current.includes(item)
          ? [...current]
          : [...current, item];
        clearError();
        const result = { ...prev };
        return setNestedValue(result, fieldName, updated);
      });
    },
    [setFormData, fieldName, clearError]
  );

  const removeItem = useCallback(
    (item) => {
      setFormData(prev => {
        const current = getNestedValue(prev, fieldName) || [];
        const updated = current.filter(i => i !== item);
        clearError();
        const result = { ...prev };
        return setNestedValue(result, fieldName, updated);
      });
    },
    [setFormData, fieldName, clearError]
  );

  return { toggleItem, setItem, removeItem };
}
