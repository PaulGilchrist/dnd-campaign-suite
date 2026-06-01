import { useEffect, useRef, useCallback } from 'react';
import { computeRaceBuffs, applyRaceBuffsToPlayerData } from '../services/raceBuffService.js';

function useWizardRaceBuffs(formData, allRaces, setFormData) {
  const prevRaceRef = useRef(null);
  const prevSubraceRef = useRef(null);

  const applyBuffs = useCallback(() => {
    const raceName = formData.race?.name;
    if (!raceName || allRaces.length === 0) return;

    const race = allRaces.find(r => r.name === raceName);
    if (!race) return;

    const ruleset = formData.rules || '5e';
    const buffs = computeRaceBuffs(race, formData, ruleset);

    setFormData(prev => {
      const next = { ...prev };
      next.abilities = (prev.abilities || []).map(a => ({ ...a }));
      next.languages = [...(prev.languages || [])];

      applyRaceBuffsToPlayerData(next, buffs);
      return next;
    });
  }, [formData, allRaces, setFormData]);

  const clearBuffs = useCallback(() => {
    setFormData(prev => {
      const next = { ...prev };
      if (next.abilities) {
        next.abilities = next.abilities.map(a => ({ ...a, miscBonus: 0 }));
      }
      return next;
    });
  }, [setFormData]);

  useEffect(() => {
    const raceName = formData.race?.name;
    const subraceName = formData.race?.subrace?.name;

    if (raceName !== prevRaceRef.current || subraceName !== prevSubraceRef.current) {
      if (raceName) {
        clearBuffs();
        applyBuffs();
      }
      prevRaceRef.current = raceName;
      prevSubraceRef.current = subraceName;
    }
  }, [formData.race?.name, formData.race?.subrace?.name, formData.rules, allRaces, applyBuffs, clearBuffs]);
}

export default useWizardRaceBuffs;
