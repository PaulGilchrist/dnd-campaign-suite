import { useState, useEffect, useCallback } from 'react';

function useWizardData(ruleset) {
  const [backgrounds, setBackgrounds] = useState([]);
  const [racesData, setRacesData] = useState([]);
  const [allRacesData, setAllRacesData] = useState([]);
  const [classSubtypes, setClassSubtypes] = useState([]);
  const [allClassesData, setAllClassesData] = useState([]);
  const [feats, setFeats] = useState([]);
  const [magicItems, setMagicItems] = useState([]);

  const loadData = useCallback(async (url, setData) => {
    try {
      const response = await fetch(url);
      const data = await response.json();
      setData(data);
       } catch (error) {
      console.error(`Failed to load ${url}:`, error);
      setData([]);
       }
      }, []);

  useEffect(() => {
    if (ruleset === '2024') {
      loadData('/data/2024/backgrounds.json', setBackgrounds);
      loadData('/data/2024/races.json', setRacesData);
      loadData('/data/2024/races.json', setAllRacesData);
      loadData('/data/2024/classes.json', (data) => {
        setClassSubtypes(data.map(cls => ({
          className: cls.name,
          subtypes: cls.subclasses || cls.majors || []
          })));
        setAllClassesData(data);
       });
      loadData('/data/2024/feats.json', setFeats);
      loadData('/data/magic-items.json', setMagicItems);
      } else {
      setBackgrounds([]);
      loadData('/data/races.json', setRacesData);
      loadData('/data/races.json', setAllRacesData);
      loadData('/data/classes.json', (data) => {
        setClassSubtypes(data.map(cls => ({
          className: cls.name,
          subtypes: cls.subclasses || []
          })));
        setAllClassesData(data);
       });
      loadData('/data/feats.json', setFeats);
      loadData('/data/magic-items.json', setMagicItems);
      }
      }, [ruleset, loadData]);

  return {
    backgrounds,
    racesData,
    allRacesData,
    classSubtypes,
    allClassesData,
    feats,
    magicItems,
    isDataLoading: racesData.length === 0 && classSubtypes.length === 0,
   };
}

export default useWizardData;
