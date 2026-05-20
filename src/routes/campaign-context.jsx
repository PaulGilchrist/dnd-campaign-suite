import { createContext, useContext, useState, useEffect } from 'react';

const CampaignContext = createContext(null);

export function CampaignProvider({ campaignName, children }) {
  const [characters, setCharacters] = useState([]);
  const [npcs, setNpcs] = useState([]);

  // TODO: Load characters from API when campaignName changes
  useEffect(() => {
    // Placeholder — will be implemented in migration step
  }, [campaignName]);

  return (
    <CampaignContext.Provider value={{ campaignName, characters, setCharacters, npcs, setNpcs }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
}

export { CampaignContext };
