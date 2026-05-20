import { useState } from 'react';
import './Sidebar.css';

function Sidebar({ campaignName, characters, activeCharacter, onBackToCampaigns, onAddCharacter, onCharacterClick, onInitiativeClick, onEncounterClick, onMapsClick, onRenameCampaign, onDeleteCampaign, theme, toggleTheme, isLocalhost }) {
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebar-characters-expanded');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const toggleCharactersExpanded = () => {
    setIsExpanded((prev) => {
      const newValue = !prev;
      localStorage.setItem('sidebar-characters-expanded', JSON.stringify(newValue));
      return newValue;
    });
  };

  return (
    <nav className="sidebar no-print">
      <div className="sidebar-header">
        <div className="campaign-name">{campaignName}</div>
        <div className="sidebar-header-buttons">
          <button className="icon-button rename-campaign-btn" onClick={onRenameCampaign} disabled={!isLocalhost} title="Rename Campaign"><i className="fas fa-pen"></i></button>
          <button className="icon-button delete-campaign-btn" onClick={onDeleteCampaign} disabled={characters.length > 0} title="Delete Campaign"><i className="fas fa-trash"></i></button>
          <button className="icon-button theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>
      </div>

      <button className="sidebar-section-header" onClick={onBackToCampaigns}>
        <i className="fa-solid fa-arrow-left"></i> Campaigns
      </button>

      <div className="sidebar-section">
        <button className="sidebar-section-header" onClick={toggleCharactersExpanded}>
          <span className="sidebar-toggle-icon">{isExpanded ? '\u25BC' : '\u25B6'}</span>
          Characters
        </button>
        {isExpanded && (
          <div className="sidebar-submenu">
            <button className="sidebar-link add-character" onClick={onAddCharacter}>
              <i className="fa-solid fa-plus"></i> Add Character
            </button>
            {characters.map((char, index) => (
              <button
                key={`${char.name}-${index}`}
                className={`sidebar-link${activeCharacter && activeCharacter.name === char.name ? ' active' : ''}`}
                onClick={() => onCharacterClick(char)}
              >
                {char.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="sidebar-section-header" onClick={onEncounterClick}>
        <i className="fa-solid fa-dragon"></i> Encounters
      </button>

      <button className="sidebar-section-header" onClick={onInitiativeClick}>
        <i className="fa-solid fa-shield-alt"></i> Initiative
      </button>

      <button className="sidebar-section-header" onClick={onMapsClick}>
        <i className="fa-solid fa-map"></i> {isLocalhost ? 'Maps' : 'Map'}
      </button>
    </nav>
  );
}

export default Sidebar;
