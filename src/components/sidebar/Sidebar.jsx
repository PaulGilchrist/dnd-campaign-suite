import { useState } from 'react';
import './Sidebar.css';

function Sidebar({ characters, activeCharacter, onBackToCampaigns, onAddCharacter, onCharacterClick, onInitiativeClick, onPositioningClick }) {
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
            {characters.map((char) => (
              <button
                key={char.name}
                className={`sidebar-link${activeCharacter && activeCharacter.name === char.name ? ' active' : ''}`}
                onClick={() => onCharacterClick(char)}
              >
                {char.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="sidebar-section-header" onClick={onInitiativeClick}>
        <i className="fa-solid fa-shield-alt"></i> Initiative
      </button>

      <button className="sidebar-section-header" onClick={onPositioningClick}>
        <i className="fa-solid fa-chess-board"></i> Positioning
      </button>
    </nav>
  );
}

export default Sidebar;
