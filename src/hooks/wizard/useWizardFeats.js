import useWizardConfig from './useWizardConfig.js';
import { getPreSelectedFeats } from '../../services/character/featValidation.js';

function useWizardFeats(formData, setFormData) {
  const { preSelectedFeats } = useWizardConfig({
    formData,
    setFormData,
    validateFn: () => [],
    slots: [],
    getDeps: (f) => [f.background, f.rules],
    preSelect: {
      getFn: getPreSelectedFeats,
      merge: (prev, items, prevItems) => {
        const existingFeats = prev.feats || [];
        const toRemove = prevItems || [];
        const keptFeats = existingFeats.filter(feat => !toRemove.includes(feat));
        const newItems = items.filter(item => !keptFeats.includes(item));
        return {
          ...prev,
          feats: [...keptFeats, ...newItems]
        };
      },
      deps: (f) => [f.background, f.rules],
      stateKey: 'preSelectedFeats'
    }
  });

  return { preSelectedFeats };
}

export default useWizardFeats;
