import { useState, useEffect, useCallback, useRef } from 'react';
import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';
import { resetFeatIncreases } from '../../services/shared/buffApplier.js';

function getAbilityIndexByName(abilities, abilityName) {
  if (!abilities || !abilityName) return -1;
  return abilities.findIndex(a => a.name.toLowerCase() === abilityName.toLowerCase());
}

function useWizardFeatAbilityChoices(formData, allFeats, setFormData) {
  const [featAbilityChoices, setFeatAbilityChoices] = useState([]);
  const [featAbilityAssignments, setFeatAbilityAssignments] = useState({});
  const allFeatsRef = useRef(allFeats);
  const formDataRef = useRef(formData);

  useEffect(() => {
    allFeatsRef.current = allFeats;
  }, [allFeats]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    if (!allFeats || allFeats.length === 0 || !formData.feats || formData.feats.length === 0) {
      setFeatAbilityChoices([]);
      setFeatAbilityAssignments({});
      return;
    }

    const buffs = computeAllFeatBuffs(formData, allFeats);
    const choices = buffs.abilityScoreIncreases.filter(inc => inc.isChoice && inc.name === 'any');

    if (choices.length === 0) {
      setFeatAbilityChoices([]);
      setFeatAbilityAssignments({});
      return;
    }

    const expandedChoices = [];
    choices.forEach(choice => {
      const base = { ...choice };
      const amounts = Array.isArray(choice.amount) ? choice.amount : [choice.amount];
      amounts.forEach(amount => {
        let abilityNames = [];

        const chooseFromMatch = base.description?.match(/Choose (?:one|any)(?: of the following)?\s*(?:ability\s*score)?\s*from:\s*(.+)$/i);
        if (chooseFromMatch) {
          const abilityName = chooseFromMatch[1].trim();
          abilityNames = abilityName.split(/,\s+| and /i).map(s => s.trim()).filter(s => s.length > 0);
        } else {
          const increaseMatch = base.description?.match(/Increase your (.+?) score/i);
          if (increaseMatch) {
            const abilityName = increaseMatch[1];
            const normalized = abilityName.replace(/,\s*or\s+/i, ', ').replace(/\s+or\s+/g, ', ');
            abilityNames = normalized.split(', ').map(s => s.trim()).filter(s => s.length > 0);
          }
        }

        if (abilityNames.length === 0 && base.scores) {
          abilityNames = base.scores;
        }

        if (abilityNames.length === 0) {
          abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
        }

        expandedChoices.push({ ...base, amount, abilityNames });
      });
    });
    const choicesWithAbilities = expandedChoices;

    setFeatAbilityChoices(choicesWithAbilities);

    const stored = {};
    choicesWithAbilities.forEach((choice, idx) => {
      const key = `${idx}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          stored[key] = JSON.parse(saved);
        } catch (e) {
          stored[key] = choice.abilityNames[0];
        }
      } else {
        stored[key] = choice.abilityNames[0];
      }
    });
    setFeatAbilityAssignments(stored);
  }, [formData, formData.feats, formData.rules, allFeats]);

  const handleFeatAbilityChoice = useCallback((choiceIdx, abilityName) => {
    const currentFormData = formDataRef.current;
    const currentAllFeats = allFeatsRef.current;

    setFeatAbilityAssignments(prev => {
      const newAssignments = { ...prev, [choiceIdx]: abilityName };
      const key = `${choiceIdx}`;
      localStorage.setItem(key, JSON.stringify(abilityName));

      const abilities = (currentFormData.abilities || []).map(a => ({ ...a, featIncrease: 0 }));
      resetFeatIncreases(abilities);

      const buffs = computeAllFeatBuffs(currentFormData, currentAllFeats);
      const nonChoiceIncreases = buffs.abilityScoreIncreases.filter(inc => inc.name && inc.name !== 'any');

      nonChoiceIncreases.forEach(inc => {
        const idx = getAbilityIndexByName(abilities, inc.name);
        if (idx !== -1) {
          abilities[idx].featIncrease = (abilities[idx].featIncrease || 0) + inc.amount;
        }
      });

      Object.entries(newAssignments).forEach(([idx, chosenAbility]) => {
        const choice = featAbilityChoices[parseInt(idx)];
        if (choice) {
          const abIdx = getAbilityIndexByName(abilities, chosenAbility);
          if (abIdx !== -1) {
            abilities[abIdx].featIncrease = (abilities[abIdx].featIncrease || 0) + choice.amount;
          }
        }
      });

      setFormData(prev => ({ ...prev, abilities }));
      return newAssignments;
    });
  }, [featAbilityChoices, setFormData]);

  return {
    featAbilityChoices,
    featAbilityAssignments,
    handleFeatAbilityChoice,
  };
}

export default useWizardFeatAbilityChoices;
