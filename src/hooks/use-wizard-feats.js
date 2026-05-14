import useWizardConfig from './useWizardConfig.js';
import { getPreSelectedFeats } from '../services/feat-validation.js';

function useWizardFeats(formData, setFormData) {
  const { preSelectedFeats } = useWizardConfig({
    formData,
    setFormData,
    validateFn: () => [],
    slots: [],
    getDeps: (f) => [f.background, f.rules],
    preSelect: {
      getFn: getPreSelectedFeats,
      merge: (prev, items) => ({
        ...prev,
        feats: [...(prev.feats || []), ...items.filter(feat => !(prev.feats || []).includes(feat))]
      }),
      deps: (f) => [f.background, f.rules],
      stateKey: 'preSelectedFeats'
    }
  });

  return { preSelectedFeats };
}

export default useWizardFeats;
