import React, { useEffect, useState } from 'react';

function useAppData() {
  const [abilityScores, setAbilityScores] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classes2024, setClasses2024] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [magicItems, setMagicItems] = useState([]);
  const [magicItems2024, setMagicItems2024] = useState([]);
  const [races, setRaces] = useState([]);
  const [races2024, setRaces2024] = useState([]);
  const [spells, setSpells] = useState([]);
  const [spells2024, setSpells2024] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          abilityScoresData,
          classesData,
          classes2024Data,
          equipmentData,
          magicItemsData,
          magicItems2024Data,
          racesData,
          races2024Data,
          spellsData,
          spells2024Data,
        ] = await Promise.all([
          fetch('/data/ability-scores.json').then(response => response.json()),
          fetch('/data/classes.json').then(response => response.json()),
          fetch('/data/2024/classes.json').then(response => response.json()),
          fetch('/data/equipment.json').then(response => response.json()),
          fetch('/data/magic-items.json').then(response => response.json()),
          fetch('/data/2024/magic-items.json').then(response => response.json()),
          fetch('/data/races.json').then(response => response.json()),
          fetch('/data/2024/races.json').then(response => response.json()),
          fetch('/data/spells.json').then(response => response.json()),
          fetch('/data/2024/spells.json').then(response => response.json()),
        ]);

        setAbilityScores(abilityScoresData);
        setClasses(classesData);
        setClasses2024(classes2024Data);
        setEquipment(equipmentData);
        setMagicItems(magicItemsData);
        setMagicItems2024(magicItems2024Data);
        setRaces(racesData);
        setRaces2024(races2024Data);
        setSpells(spellsData);
        setSpells2024(spells2024Data);
      } catch (error) {
        console.error('Failed to fetch app data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return {
    abilityScores,
    classes,
    classes2024,
    equipment,
    magicItems,
    magicItems2024,
    races,
    races2024,
    spells,
    spells2024,
    showButton: classes.length > 0 && equipment.length > 0 && spells.length > 0 && spells2024.length > 0,
    isLoading,
  };
}

export default useAppData;
