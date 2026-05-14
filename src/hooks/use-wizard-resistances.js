import useWizardConfig from './useWizardConfig.js';
import { getPreSelectedResistances, validateResistances } from '../services/resistances-validation.js';

function useWizardResistances(formData, setFormData) {
  const result = useWizardConfig({
    formData,
    setFormData,
    validateFn: validateResistances,
    slots: [
      {
        get: getPreSelectedResistances,
        state: {
          initial: { resistances: [], immunities: [] },
          key: 'preSelectedResistancesList'
        },
        isLimit: false
      }
    ],
    getDeps: (f) => [
      f.resistances,
      f.immunities,
      f.class?.name,
      f.race?.name,
      f.race?.subrace?.name,
      f.background,
      f.rules,
      f.level
    ],
    preSelect: {
      getFn: getPreSelectedResistances,
      merge: (prev, items) => ({
        ...prev,
        resistances: [
          ...(prev.resistances || []),
          ...items.resistances.filter(r => !(prev.resistances || []).includes(r))
        ],
        immunities: [
          ...(prev.immunities || []),
          ...items.immunities.filter(i => !(prev.immunities || []).includes(i))
        ]
      }),
      hasItems: (items) =>
        (items.resistances?.length > 0 || items.immunities?.length > 0),
      deps: (f) => [
        f.race?.name,
        f.race?.subrace?.name,
        f.class?.name,
        f.rules
      ],
      stateKey: 'preSelectedResistancesList',
       stateInitial: { resistances: [], immunities: [] }
     }
  });

  return {
    preSelectedResistancesList: result.preSelectedResistancesList,
    resistanceWarnings: result.warnings,
    setResistanceWarnings: result.setWarnings
  };
}

export default useWizardResistances;
