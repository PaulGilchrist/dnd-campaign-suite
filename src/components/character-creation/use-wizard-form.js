import { useState, useCallback } from 'react';
import merge from 'lodash/merge';
import { DEFAULT_FORM_DATA } from '../../config/constants.js';

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

function useWizardForm(characterData, isEditing) {
  const [formData, setFormData] = useState(() => {
    if (isEditing && characterData) {
      return merge({}, DEFAULT_FORM_DATA, characterData);
    }
    return DEFAULT_FORM_DATA;
  });
  const [errors, setErrors] = useState({});

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  const updateArrayField = useCallback((field, value) => {
    setFormData(prev => {
      const next = { ...prev };
      if (field.includes('.')) {
        setNestedValue(next, field, value);
      } else {
        next[field] = value;
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  const updateAbility = useCallback((index, field, value) => {
    setFormData(prev => {
      const newAbilities = [...prev.abilities];
      newAbilities[index] = { ...newAbilities[index], [field]: value };
      return { ...prev, abilities: newAbilities };
    });
  }, []);

  const updateInventory = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      inventory: { ...prev.inventory, [field]: value }
    }));
  }, []);

  const updateClass = useCallback((updates) => {
    setFormData(prev => ({
      ...prev,
      class: { ...prev.class, ...updates }
    }));
  }, []);

  const resetErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    formData,
    errors,
    setFormData,
    setErrors,
    updateField,
    updateArrayField,
    updateAbility,
    updateInventory,
    updateClass,
    resetErrors,
  };
}

export default useWizardForm;