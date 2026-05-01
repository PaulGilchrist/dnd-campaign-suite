import { useState, useEffect } from 'react';
import { getPreSelectedFeats } from '../../services/feat-validation.js';

function useWizardFeats(formData, setFormData) {
  const [preSelectedFeats, setPreSelectedFeats] = useState([]);

  useEffect(() => {
    const preSelectFeats = async () => {
      try {
        const preSelected = await getPreSelectedFeats(formData);
        setPreSelectedFeats(preSelected);

         if (preSelected.length > 0) {
          setFormData(prev => {
            const currentFeats = prev.feats || [];
            const missingFeats = preSelected.filter(feat => !currentFeats.includes(feat));

            if (missingFeats.length > 0) {
              return {
                   ...prev,
                feats: [...currentFeats, ...missingFeats]
                 };
               }
            return prev;
              });
             }
           } catch (error) {
        console.error('Error pre-selecting feats:', error);
           }
       };

    preSelectFeats();
      }, [formData.background, formData.rules, setFormData]);

  return {
    preSelectedFeats,
     };
}

export default useWizardFeats;