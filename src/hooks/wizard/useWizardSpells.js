import { useState, useEffect, useRef } from 'react';
import { getPreSelectedSpells } from '../../services/character/getPreSelectedSpells.js';

function useWizardSpells(formData) {
  const [preSelectedSpells, setPreSelectedSpells] = useState([]);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const items = await getPreSelectedSpells(formDataRef.current);
      if (!cancelled) {
        setPreSelectedSpells(items);
      }
    };

    fetch();

    return () => {
      cancelled = true;
    };
  }, [
    formData.class?.subclass?.name,
    formData.race?.name,
    formData.race?.subrace?.name,
    formData.feats,
    formData.rules,
    formData.level,
  ]);

  return { preSelectedSpells };
}

export default useWizardSpells;
