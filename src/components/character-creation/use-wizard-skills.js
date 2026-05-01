import { useState, useEffect } from 'react';
import { validateSkills, getSkillLimits, getExpertiseLimits, getPreSelectedSkills } from '../../services/skill-validation.js';

function useWizardSkills(formData, setFormData) {
  const [skillLimits, setSkillLimits] = useState(null);
  const [expertiseLimits, setExpertiseLimits] = useState(null);
  const [skillWarnings, setSkillWarnings] = useState([]);
  const [preSelectedSkills, setPreSelectedSkills] = useState([]);

  useEffect(() => {
    const validate = async () => {
      try {
        const limits = await getSkillLimits(formData);
        const expertise = await getExpertiseLimits(formData);
        const warnings = await validateSkills(formData);

        setSkillLimits(limits);
        setExpertiseLimits(expertise);
        setSkillWarnings(warnings);
         } catch (error) {
        console.error('Error validating skills:', error);
          }
        };

    validate();
     }, [formData.skillProficiencies, formData.expertSkills, formData.class?.name, formData.race?.name, formData.background, formData.rules, formData.level]);

  useEffect(() => {
    const preSelectSkills = async () => {
      try {
        const preSelected = await getPreSelectedSkills(formData);
        setPreSelectedSkills(preSelected);

         if (preSelected.length > 0) {
          setFormData(prev => {
            const currentSkills = prev.skillProficiencies || [];
            const missingSkills = preSelected.filter(skill => !currentSkills.includes(skill));

            if (missingSkills.length > 0) {
              return {
                  ...prev,
                skillProficiencies: [...currentSkills, ...missingSkills]
                };
              }
            return prev;
              });
            }
          } catch (error) {
        console.error('Error pre-selecting skills:', error);
          }
      };

    preSelectSkills();
       }, [formData.background, formData.race?.name, formData.class?.name, formData.rules, setFormData]);

  return {
    skillLimits,
    expertiseLimits,
    skillWarnings,
    preSelectedSkills,
    };
}

export default useWizardSkills;