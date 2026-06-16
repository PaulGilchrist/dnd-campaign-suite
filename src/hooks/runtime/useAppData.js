import { useEffect, useState } from 'react';
import {
  loadAbilityScores,
  loadClassData,
  loadEquipment,
  loadMagicItems,
  loadRaceData,
  loadSpells
} from '../../services/ui/dataLoader.js';

function useAppData() {
  const [abilityScores, setAbilityScores] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classes2024, setClasses2024] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [magicItems, setMagicItems] = useState([]);
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
          racesData,
          races2024Data,
          spellsData,
          spells2024Data,
        ] = await Promise.all([
          loadAbilityScores(),
          loadClassData('5e'),
          loadClassData('2024'),
          loadEquipment(),
          loadMagicItems(),
          loadRaceData('5e'),
          loadRaceData('2024'),
          loadSpells('5e'),
          loadSpells('2024'),
        ]);

        setAbilityScores(abilityScoresData);
        setClasses(classesData);
        setClasses2024(classes2024Data);
        setEquipment(equipmentData);
        setMagicItems(magicItemsData);
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
    races,
    races2024,
    spells,
    spells2024,
    showButton: classes.length > 0 && equipment.length > 0 && spells.length > 0 && spells2024.length > 0,
    isLoading,
  };
}

export default useAppData;
