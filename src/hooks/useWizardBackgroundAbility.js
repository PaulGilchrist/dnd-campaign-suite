import { useState, useEffect, useCallback } from 'react';
import { fetchBackgroundData } from '../services/ui/dataLoader.js';

function parseBackgroundAbilityScores(abilityScoresStr) {
  if (!abilityScoresStr) return [];
  return abilityScoresStr.split(/,?\s+and\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function getPreSelectedBgAbilities(formData) {
  if (!formData.background || formData.rules !== '2024') return null;

  const abilityKey = `_bg_abilities_${formData.background}`;
  const stored = localStorage.getItem(abilityKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function setPreSelectedBgAbilities(formData, abilitiesMap) {
  if (!formData.background || formData.rules !== '2024') return;

  const abilityKey = `_bg_abilities_${formData.background}`;
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
  const [bgAbilityNames, setBgAbilityNames] = useState([]);
  const [bgAbilityAssignments, setBgAbilityAssignments] = useState({});

  useEffect(() => {
    const loadBgAbilities = async () => {
      if (formData.rules !== '2024' || !formData.background) {
        setBgAbilityNames([]);
        setBgAbilityAssignments({});
        return;
      }
      try {
        const bgData = await fetchBackgroundData(formData.background, '2024');
        if (bgData?.ability_scores) {
          const names = parseBackgroundAbilityScores(bgData.ability_scores);
          setBgAbilityNames(names);
          const stored = getPreSelectedBgAbilities(formData);
          if (stored) {
            setBgAbilityAssignments(stored);
          } else {
            setBgAbilityAssignments(getDefaultBgAbilityAssignments(names));
          }
        } else {
          setBgAbilityNames([]);
          setBgAbilityAssignments({});
        }
      } catch (error) {
        console.error('Error loading background ability scores:', error);
        setBgAbilityNames([]);
        setBgAbilityAssignments({});
      }
    };
    loadBgAbilities();
  }, [formData]);

  const updateBgAbilityBonus = useCallback((abilityName, bonus) => {
    const validBonus = Math.max(0, Math.min(2, parseInt(bonus) || 0));
    setBgAbilityAssignments(prev => {
      const newAssignments = { ...prev, [abilityName]: validBonus };
      setPreSelectedBgAbilities(formData, newAssignments);
      return newAssignments;
    });
    
    setFormData(prev => {
      const abilities = (prev.abilities || []).map(ability => {
        if (ability.name === abilityName) {
          const currentBonus = ability.miscBonus || 0;
          const oldBonus = bgAbilityAssignments[abilityName] || 0;
          return { ...ability, miscBonus: currentBonus - oldBonus + validBonus };
        }
        return ability;
      });
      return { ...prev, abilities };
    });
  }, [formData, setFormData, bgAbilityAssignments]);

  const totalAssigned = Object.values(bgAbilityAssignments).reduce((sum, val) => sum + val, 0);
  const isValid = totalAssigned === 3;
  const maxSingleBonus = Math.max(...Object.values(bgAbilityAssignments), 0);
  const hasMaxSingleBonus = maxSingleBonus > 2;

  return {
    bgAbilityNames,
    bgAbilityAssignments,
    updateBgAbilityBonus,
    totalAssigned,
    isValid,
    hasMaxSingleBonus,
  };
}

export default useWizardBackgroundAbility;
