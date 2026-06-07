import { useEffect, useRef, useState, useCallback } from 'react';
import { computeAllFeatBuffs } from '../services/character/featBuffService.js';

function buildFormDataWithBuffs(prev, buffs) {
  const next = { ...prev };
  next.abilities = (prev.abilities || []).map(a => ({ ...a, miscBonus: 0 }));

  buffs.abilityScoreIncreases.forEach(inc => {
    if (inc.name && inc.name !== 'any') {
      const ability = next.abilities.find(
        a => a.name.toLowerCase() === inc.name.toLowerCase()
      );
      if (ability) {
        ability.miscBonus = (ability.miscBonus || 0) + inc.amount;
      }
    }
  });

  if (buffs.resistances.length > 0) {
    const existing = new Set((prev.resistances || []).map(r => r.toLowerCase()));
    const newResists = buffs.resistances.filter(
      r => !existing.has(r.toLowerCase())
    );
    if (newResists.length > 0) {
      next.resistances = [...(prev.resistances || []), ...newResists];
    }
  }

  const existingActions = new Set(
    (prev.specialActions || []).map(a => (typeof a === 'string' ? a : a.name))
  );
  buffs.features.forEach(f => {
    if (!existingActions.has(f.name)) {
      next.specialActions = next.specialActions || [];
      next.specialActions.push({
        name: f.name,
        description: f.description,
        type: f.type || 'passive',
        source: 'feat',
      });
      existingActions.add(f.name);
    }
  });

  return next;
}

function useWizardFeatBuffs(formData, allFeats, setFormData) {
  const [computedBuffs, setComputedBuffs] = useState(null);
  const prevFeatsRef = useRef([]);

  const applyBuffs = useCallback((buffs) => {
    setFormData(prev => buildFormDataWithBuffs(prev, buffs));
  }, [setFormData]);

  const clearBuffs = useCallback(() => {
    setFormData(prev => {
      if (!prev.abilities) return prev;
      return {
        ...prev,
        abilities: prev.abilities.map(a => ({ ...a, miscBonus: 0 })),
      };
    });
  }, [setFormData]);

  useEffect(() => {
    const currentFeats = formData.feats || [];
    const prev = prevFeatsRef.current;

    const changed =
      currentFeats.length !== prev.length ||
      currentFeats.some(f => !prev.includes(f)) ||
      prev.some(f => !currentFeats.includes(f));

    if (!changed) return;

    prevFeatsRef.current = [...currentFeats];

    if (currentFeats.length > 0 && allFeats.length > 0) {
      const buffs = computeAllFeatBuffs(formData, allFeats);
      clearBuffs();
      applyBuffs(buffs);
      setComputedBuffs(buffs);
    } else {
      if (prevFeatsRef.current.length === 0) {
        clearBuffs();
      }
      setComputedBuffs(null);
    }
  }, [formData, allFeats, applyBuffs, clearBuffs]);

  return { computedBuffs };
}

export default useWizardFeatBuffs;
