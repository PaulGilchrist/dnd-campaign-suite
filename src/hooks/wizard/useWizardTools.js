import useWizardConfig from './useWizardConfig.js';
import { getToolLimits, validateTools } from '../../services/character/toolValidation.js';

function useWizardTools(formData, setFormData) {
  const {
    toolLimits,
    toolWarnings,
    preSelectedTools,
  } = useWizardConfig({
    formData,
    setFormData,
    validateFn: validateTools,
    slots: [
      { get: getToolLimits, state: { initial: null, key: 'toolLimits' }, isLimit: true },
    ],
    getDeps: (f) => [
      f.toolProficiencies,
      f.class?.name,
      f.race?.name,
      f.background,
      f.rules,
      f.feats,
      f.level,
    ],
    preSelect: {
      getFn: async (f) => {
        const limits = await getToolLimits(f);
        return limits.preSelected || [];
      },
      merge: (prev, items, _prevItems) => ({
        ...prev,
        toolProficiencies: [
          ...(prev.toolProficiencies || []),
          ...items.filter(t => !(prev.toolProficiencies || []).includes(t)),
        ],
      }),
      deps: (f) => [f.background, f.class?.name, f.feats, f.rules],
      stateKey: 'preSelectedTools',
    },
  });

  return { toolLimits, toolWarnings, preSelectedTools };
}

export default useWizardTools;
