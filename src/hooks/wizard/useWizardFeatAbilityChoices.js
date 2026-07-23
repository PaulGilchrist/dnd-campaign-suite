import { useState, useEffect, useCallback, useRef } from 'react';
import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

function getAbilityIndexByName(abilities, abilityName) {
  if (!abilities || !abilityName) return -1;
  return abilities.findIndex(a => a.name.toLowerCase() === abilityName.toLowerCase());
}

function normalizeAbilityNames(description) {
  let abilityNames = [];

  const chooseFromMatch = description?.match(/Choose (?:one|any)(?: of the following)?\s*(?:ability\s*score)?\s*from:\s*(.+)$/i);
  if (chooseFromMatch) {
    const abilityName = chooseFromMatch[1].trim();
    abilityNames = abilityName.split(/,\s+| and /i).map(s => s.trim()).filter(s => s.length > 0);
  } else {
    const increaseMatch = description?.match(/Increase your (.+?) score/i);
    if (increaseMatch) {
      const abilityName = increaseMatch[1];
      const normalized = abilityName.replace(/,\s*or\s+/i, ', ').replace(/\s+or\s+/g, ', ');
      abilityNames = normalized.split(', ').map(s => s.trim()).filter(s => s.length > 0);
    }
  }

  if (abilityNames.length === 0) {
    abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
  }

  return abilityNames;
}

function buildGroupedChoices(choices) {
  const grouped = [];

  choices.forEach((choice, idx) => {
    const amounts = Array.isArray(choice.amount) ? choice.amount : [choice.amount];
    const abilityNames = normalizeAbilityNames(choice.description);
    const featName = choice.featName || 'Unknown';
    const id = `${featName}-${idx}`;

    if (amounts.length === 2 && amounts[0] === 1 && amounts[1] === 2) {
      grouped.push({
        id,
        featName,
        type: 'choice',
        mode: 'single',
        featDescription: choice.featDescription || '',
        options: {
          single: { amount: 2, abilityNames, assignment: null },
          dual: { amount: 1, count: 2, abilityNames, assignments: [null, null] },
        },
      });
    } else if (amounts.length === 1) {
      grouped.push({
        id,
        featName,
        type: 'fixed',
        amount: amounts[0],
        featDescription: choice.featDescription || '',
        abilityNames,
        assignment: null,
      });
    } else {
      grouped.push({
        id,
        featName,
        type: 'fixed',
        amount: amounts[0],
        featDescription: choice.featDescription || '',
        abilityNames,
        assignment: null,
      });
    }
  });

  return grouped;
}

function useWizardFeatAbilityChoices(formData, allFeats, setFormData) {
  const [featAbilityChoices, setFeatAbilityChoices] = useState([]);
  const allFeatsRef = useRef(allFeats);
  const formDataRef = useRef(formData);
  const lastProcessedKey = useRef('');

  useEffect(() => {
    allFeatsRef.current = allFeats;
  }, [allFeats]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    if (!allFeats || allFeats.length === 0 || !formData.feats || formData.feats.length === 0) {
      setFeatAbilityChoices([]);
      return;
    }

    const key = `${formData.rules}|${formData.feats.map(f => typeof f === 'string' ? f : f.name).join(',')}`;
    if (key === lastProcessedKey.current) return;
    lastProcessedKey.current = key;

    const buffs = computeAllFeatBuffs(formData, allFeats);
    const choices = buffs.abilityScoreIncreases.filter(inc => inc.isChoice && inc.name === 'any');

    if (choices.length === 0) {
      setFeatAbilityChoices([]);
      return;
    }

    const grouped = buildGroupedChoices(choices);
    setFeatAbilityChoices(grouped);

    const selectedFeatNames = new Set(formData.feats.map(f => typeof f === 'string' ? f : f.name).filter(Boolean));

    const savedChoices = formData.featAbilityChoices || {};

    const filteredChoices = {};
    Object.keys(savedChoices).forEach(key => {
      const featName = key.split('-').slice(0, -1).join('-');
      if (selectedFeatNames.has(featName)) {
        filteredChoices[key] = savedChoices[key];
      }
    });

    const migratedChoices = {};
    Object.keys(savedChoices).forEach(oldKey => {
      if (!isNaN(oldKey.split('-').pop())) return;
      const baseName = oldKey;
      const existing = savedChoices[oldKey];
      const matchingGroup = grouped.find(g => g.featName === baseName);
      if (matchingGroup) {
        migratedChoices[matchingGroup.id] = existing;
      }
    });
    const mergedChoices = { ...filteredChoices, ...migratedChoices };

    const needsInit = grouped.some(group => {
      const saved = mergedChoices[group.id];
      if (!saved) return true;
      if (group.type === 'choice') return !saved.mode;
      return !saved.assignment;
    });

    if (needsInit) {
      const initChoices = { ...mergedChoices };
      grouped.forEach(group => {
        const saved = mergedChoices[group.id];
        if (group.type === 'choice') {
          const mode = saved?.mode || 'single';
          initChoices[group.id] = {
            mode,
            assignments: {
              single: saved?.assignments?.single || group.options.single.abilityNames[0],
              dual: saved?.assignments?.dual || [group.options.dual.abilityNames[0], ''],
            },
          };
        } else {
          initChoices[group.id] = {
            assignment: saved?.assignment || group.abilityNames[0],
          };
        }
      });
      setFormData(prev => ({ ...prev, featAbilityChoices: initChoices }));
    }
  }, [allFeats, formData.feats, formData.rules, formData, setFormData]);

  const recomputeFeatIncreases = useCallback((abilities, savedChoices, grouped) => {
    abilities.forEach(a => { a.featIncrease = 0; });

    const currentFormData = formDataRef.current;
    const currentAllFeats = allFeatsRef.current;
    const buffs = computeAllFeatBuffs(currentFormData, currentAllFeats);
    const nonChoiceIncreases = buffs.abilityScoreIncreases.filter(inc => inc.name && inc.name !== 'any');

    nonChoiceIncreases.forEach(inc => {
      const idx = getAbilityIndexByName(abilities, inc.name);
      if (idx !== -1) {
        abilities[idx].featIncrease = (abilities[idx].featIncrease || 0) + inc.amount;
      }
    });

    grouped.forEach(group => {
      const saved = savedChoices[group.id];
      if (!saved) return;

      if (group.type === 'choice') {
        const mode = saved.mode || 'single';
        const assignments = saved.assignments;
        if (mode === 'single') {
          const abIdx = getAbilityIndexByName(abilities, assignments.single);
          if (abIdx !== -1) {
            abilities[abIdx].featIncrease = (abilities[abIdx].featIncrease || 0) + group.options.single.amount;
          }
        } else {
          assignments.dual.forEach((ability) => {
            if (ability) {
              const abIdx = getAbilityIndexByName(abilities, ability);
              if (abIdx !== -1) {
                abilities[abIdx].featIncrease = (abilities[abIdx].featIncrease || 0) + group.options.dual.amount;
              }
            }
          });
        }
      } else if (group.type === 'fixed') {
        const abIdx = getAbilityIndexByName(abilities, saved.assignment);
        if (abIdx !== -1) {
          abilities[abIdx].featIncrease = (abilities[abIdx].featIncrease || 0) + group.amount;
        }
      }
    });

    return abilities;
  }, []);

  const handleFeatAbilityChoice = useCallback((id, slotIndex, abilityName) => {
    const currentFormData = formDataRef.current;
    const currentGrouped = featAbilityChoices;

    const savedChoices = { ...(currentFormData.featAbilityChoices || {}) };
    const saved = savedChoices[id] || {};
    const group = currentGrouped.find(g => g.id === id);

    if (!group) return;

    if (group.type === 'fixed') {
      saved.assignment = abilityName;
    } else if (group.type === 'choice') {
      const mode = saved.mode || 'single';
      if (!saved.assignments) saved.assignments = {};
      if (mode === 'single') {
        saved.assignments.single = abilityName;
      } else {
        if (!saved.assignments.dual) saved.assignments.dual = ['', ''];
        saved.assignments.dual[slotIndex] = abilityName;
      }
    }
    savedChoices[id] = saved;

    const abilities = (currentFormData.abilities || []).map(a => ({ ...a }));
    recomputeFeatIncreases(abilities, savedChoices, currentGrouped);

    setFormData(prev => ({ ...prev, abilities, featAbilityChoices: savedChoices }));
  }, [featAbilityChoices, recomputeFeatIncreases, setFormData]);

  const handleFeatAbilityModeChange = useCallback((id, mode) => {
    const currentFormData = formDataRef.current;
    const currentGrouped = featAbilityChoices;

    const savedChoices = { ...(currentFormData.featAbilityChoices || {}) };
    const saved = savedChoices[id] || {};
    const group = currentGrouped.find(g => g.id === id);

    saved.mode = mode;

    if (mode === 'single') {
      saved.assignments = {
        single: saved.assignments?.single || group?.options?.single?.abilityNames[0] || 'Strength',
        dual: saved.assignments?.dual || ['', ''],
      };
    } else {
      saved.assignments = {
        single: saved.assignments?.single || group?.options?.single?.abilityNames[0] || 'Strength',
        dual: saved.assignments?.dual || [group?.options?.dual?.abilityNames[0] || '', ''],
      };
    }

    savedChoices[id] = saved;

    const abilities = (currentFormData.abilities || []).map(a => ({ ...a }));
    recomputeFeatIncreases(abilities, savedChoices, currentGrouped);

    setFormData(prev => ({ ...prev, abilities, featAbilityChoices: savedChoices }));
  }, [featAbilityChoices, recomputeFeatIncreases, setFormData]);

  return {
    featAbilityChoices,
    handleFeatAbilityChoice,
    handleFeatAbilityModeChange,
  };
}

export default useWizardFeatAbilityChoices;
