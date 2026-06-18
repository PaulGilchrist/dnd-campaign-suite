import { useState, useEffect, useCallback } from 'react';
import { fetchBackgroundData } from '../../services/ui/dataLoader.js';

function parseBackgroundAbilityScores(abilityScoresStr) {
  if (!abilityScoresStr) return [];
  return abilityScoresStr.split(/[,;]|\s+and\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function getPreSelectedBgAbilities(formData) {
  if (!formData.background || formData.rules !== '2024') return null;

  const abilityKey = `_background_abilities_${formData.background}`;
  const stored = localStorage.getItem(abilityKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (_e) {
      return null;
    }
  }
  return null;
}

function setPreSelectedBgAbilities(formData, abilitiesMap) {
  if (!formData.background || formData.rules !== '2024') return;

  const abilityKey = `_background_abilities_${formData.background}`;
  if (abilitiesMap && Object.keys(abilitiesMap).length > 0) {
    localStorage.setItem(abilityKey, JSON.stringify(abilitiesMap));
  } else {
    localStorage.removeItem(abilityKey);
  }
}

function getDefaultBgAbilityAssignments(bgAbilityNames) {
  if (!bgAbilityNames || bgAbilityNames.length === 0) return {};
  const defaults = {};
  bgAbilityNames.forEach(name => {
    defaults[name] = 1;
  });
  return defaults;
}

function useWizardBackgroundAbility(formData, setFormData) {
  const [backgroundAbilityNames, setBackgroundAbilityNames] = useState([]);
  const [backgroundAbilityAssignments, setBackgroundAbilityAssignments] = useState({});

  useEffect(() => {
    const loadBgAbilities = async () => {
      if (formData.rules !== '2024' || !formData.background) {
        setBackgroundAbilityNames([]);
        setBackgroundAbilityAssignments({});
        return;
      }
      try {
        const bgData = await fetchBackgroundData(formData.background, '2024');
        if (bgData?.ability_scores) {
          const names = parseBackgroundAbilityScores(bgData.ability_scores);
          setBackgroundAbilityNames(names);
          const stored = getPreSelectedBgAbilities(formData);
          if (stored) {
            setBackgroundAbilityAssignments(stored);
          } else {
            setBackgroundAbilityAssignments(getDefaultBgAbilityAssignments(names));
          }
        } else {
          setBackgroundAbilityNames([]);
          setBackgroundAbilityAssignments({});
        }
      } catch (error) {
        console.error('Error loading background ability scores:', error);
        setBackgroundAbilityNames([]);
        setBackgroundAbilityAssignments({});
      }
    };
    loadBgAbilities();
  }, [formData]);

  useEffect(() => {
    if (!formData.background || formData.rules !== '2024' || Object.keys(backgroundAbilityAssignments).length === 0) {
      return;
    }
    let needsUpdate = false;
    const abilities = (formData.abilities || []).map(ability => {
      const newIncrease = backgroundAbilityAssignments[ability.name];
      if (newIncrease !== undefined && ability.backgroundIncrease !== newIncrease) {
        needsUpdate = true;
        return { ...ability, backgroundIncrease: newIncrease };
      }
      return ability;
    });
    if (needsUpdate) {
      setFormData(p => ({ ...p, abilities }));
    }
  }, [backgroundAbilityAssignments, formData.background, formData.rules, setFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateBackgroundIncrease = useCallback((abilityName, newIncrease) => {
    const validIncrease = Math.max(0, Math.min(2, parseInt(newIncrease) || 0));
    setBackgroundAbilityAssignments(prev => {
      const newAssignments = { ...prev, [abilityName]: validIncrease };
      setPreSelectedBgAbilities({ rules: formData.rules, background: formData.background }, newAssignments);
      return newAssignments;
    });
    setFormData(p => {
      const abilities = (p.abilities || []).map(ability => {
        if (ability.name === abilityName) {
          return { ...ability, backgroundIncrease: validIncrease };
        }
        return ability;
      });
      return { ...p, abilities };
    });
  }, [setFormData, formData]);

  const totalAssigned = Object.values(backgroundAbilityAssignments).reduce((sum, val) => sum + val, 0);
  const isValid = totalAssigned === 3;
  const maxSingleBonus = Math.max(...Object.values(backgroundAbilityAssignments), 0);
  const hasMaxSingleBonus = maxSingleBonus > 2;

  return {
    backgroundAbilityNames,
    backgroundAbilityAssignments,
    updateBackgroundIncrease,
    totalAssigned,
    isValid,
    hasMaxSingleBonus,
  };
}

export default useWizardBackgroundAbility;
