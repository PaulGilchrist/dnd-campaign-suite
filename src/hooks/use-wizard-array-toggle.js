import { useCallback } from 'react';

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
  return obj;
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
        return setNestedValue(prev, fieldName, copiedCurrent);
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
        return setNestedValue(prev, fieldName, updated);
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
        return setNestedValue(prev, fieldName, updated);
      });
    },
    [setFormData, fieldName, clearError]
  );

  return { toggleItem, setItem, removeItem };
}
