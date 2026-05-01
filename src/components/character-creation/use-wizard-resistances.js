import { useState, useEffect } from 'react';
import { getPreSelectedResistances, validateResistances } from '../../services/resistances-validation.js';

function useWizardResistances(formData, setFormData) {
  const [resistanceWarnings, setResistanceWarnings] = useState([]);
  const [preSelectedResistancesList, setPreSelectedResistancesList] = useState({ resistances: [], immunities: [] });

  useEffect(() => {
    const validate = async () => {
      try {
        const warnings = await validateResistances(formData);
        setResistanceWarnings(warnings);
          } catch (error) {
        console.error('Error validating resistances:', error);
          }
         };

    validate();
      }, [formData.resistances, formData.immunities, formData.class?.name, formData.race?.name, formData.race?.subrace?.name, formData.background, formData.rules, formData.level]);

  useEffect(() => {
    const preSelect = async () => {
      try {
        const preSelected = await getPreSelectedResistances(formData);
        setPreSelectedResistancesList(preSelected);

         if (preSelected.resistances.length > 0 || preSelected.immunities.length > 0) {
          setFormData(prev => {
            const currentResistances = prev.resistances || [];
            const currentImmunities = prev.immunities || [];

            const missingResistances = preSelected.resistances.filter(r => !currentResistances.includes(r));
            const missingImmunities = preSelected.immunities.filter(i => !currentImmunities.includes(i));

            if (missingResistances.length > 0 || missingImmunities.length > 0) {
              return {
                  ...prev,
                resistances: [...currentResistances, ...missingResistances],
                immunities: [...currentImmunities, ...missingImmunities]
                 };
               }
            return prev;
             });
           }
          } catch (error) {
        console.error('Error pre-selecting resistances:', error);
          }
       };

    preSelect();
      }, [formData.race?.name, formData.race?.subrace?.name, formData.class?.name, formData.rules, setFormData]);

  return {
    resistanceWarnings,
    preSelectedResistancesList,
    setResistanceWarnings,
      };
}

export default useWizardResistances;