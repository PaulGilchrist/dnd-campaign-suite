import { useState } from 'react';
import { DiceTray, DicePopup } from './DiceTray.jsx';
import './Sidebar.css';

const VIEW_LABELS = {
    charSheet: { label: 'Character', icon: 'fa-user' },
    encounter: { label: 'Encounters', icon: 'fa-dragon' },
    factions: { label: 'Factions', icon: 'fa-handshake' },
    initiative: { label: 'Initiative', icon: 'fa-shield-alt' },
    mapsManager: { label: 'Maps', icon: 'fa-map' },
    notes: { label: 'Notes', icon: 'fa-book' },
    quests: { label: 'Quests', icon: 'fa-scroll' },
    npcs: { label: 'NPCs', icon: 'fa-users' },
    settlements: { label: 'Settlements', icon: 'fa-city' },
    campaignLog: { label: 'Log', icon: 'fa-book-journal-whills' },
    campaignRepair: { label: 'Admin', icon: 'fa-gears' },
};

function Sidebar({ campaignName, characters, activeCharacter, onBackToCampaigns, onAddCharacter, onCharacterClick, onInitiativeClick, onEncounterClick, onFactionsClick, onMapsClick, onNotesClick, onQuestsClick, onNPCsClick, onSettlementsClick, onLogClick, onRepairClick, onRenameCampaign: _onRenameCampaign, onDeleteCampaign: _onDeleteCampaign, isLocalhost, activeView }) {
    const [isExpanded, setIsExpanded] = useState(() => {
        try {
            const stored = localStorage.getItem('sidebar-characters-expanded');
            return stored !== null ? JSON.parse(stored) : true;
        } catch {
            return true;
        }
    });

    const [diceResult, setDiceResult] = useState(null);

    const toggleCharactersExpanded = () => {
        setIsExpanded((prev) => {
            const newValue = !prev;
            localStorage.setItem('sidebar-characters-expanded', JSON.stringify(newValue));
            return newValue;
        });
    };

    const viewInfo = VIEW_LABELS[activeView];
    const activeLabel = activeView === 'charSheet' && activeCharacter
        ? activeCharacter.name
        : viewInfo?.label || '';
    const activeIcon = activeView === 'charSheet' && activeCharacter
        ? 'fa-user'
        : viewInfo?.icon || '';

    return (
        <>
            <nav className="sidebar no-print">
                <div className="sidebar-header">
                    <div className="campaign-name">{campaignName}</div>
                </div>
                {activeView && (
                    <div className="sidebar-active-indicator">
                        <i className={`fa-solid ${activeIcon}`}></i>
                        <span>{activeLabel}</span>
                    </div>
                )}

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
                                    className={`sidebar-link${activeView === 'charSheet' && activeCharacter && activeCharacter.name === char.name ? ' active' : ''}`}
                                    onClick={() => onCharacterClick(char)}
                                >
                                    {char.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {isLocalhost && (
                    <button
                        className={`sidebar-section-header${activeView === 'encounter' ? ' active' : ''}`}
                        onClick={onEncounterClick}
                    >
                        <i className="fa-solid fa-dragon"></i> Encounters
                    </button>
                )}

                {isLocalhost && (
                    <button
                        className={`sidebar-section-header${activeView === 'factions' ? ' active' : ''}`}
                        onClick={onFactionsClick}
                    >
                        <i className="fa-solid fa-handshake"></i> Factions
                    </button>
                )}

                <button
                    className={`sidebar-section-header${activeView === 'initiative' ? ' active' : ''}`}
                    onClick={onInitiativeClick}
                >
                    <i className="fa-solid fa-shield-alt"></i> Initiative
                </button>

                <button
                    className={`sidebar-section-header${activeView === 'campaignLog' ? ' active' : ''}`}
                    onClick={onLogClick}
                >
                    <i className="fa-solid fa-book-journal-whills"></i> Log
                </button>

                <button
                    className={`sidebar-section-header${activeView === 'mapsManager' ? ' active' : ''}`}
                    onClick={onMapsClick}
                >
                    <i className="fa-solid fa-map"></i> {isLocalhost ? 'Maps' : 'Map'}
                </button>

                {isLocalhost && (
                    <button
                        className={`sidebar-section-header${activeView === 'npcs' ? ' active' : ''}`}
                        onClick={onNPCsClick}
                    >
                        <i className="fa-solid fa-users"></i> NPCs
                    </button>
                )}

                <button
                    className={`sidebar-section-header${activeView === 'notes' ? ' active' : ''}`}
                    onClick={onNotesClick}
                >
                    <i className="fa-solid fa-book"></i> Notes
                </button>

                {isLocalhost && (
                    <button
                        className={`sidebar-section-header${activeView === 'quests' ? ' active' : ''}`}
                        onClick={onQuestsClick}
                    >
                        <i className="fa-solid fa-scroll"></i> Quests
                    </button>
                )}

                <button
                    className="sidebar-section-header"
                    onClick={() => window.open('https://paulgilchrist.github.io/dnd-tools/rules/general', '_blank')}
                >
                    <i className="fa-solid fa-book"></i> Rules <i className="fa-solid fa-external-link-alt fa-xs"></i>
                </button>

                {isLocalhost && (
                    <button
                        className={`sidebar-section-header${activeView === 'settlements' ? ' active' : ''}`}
                        onClick={onSettlementsClick}
                    >
                        <i className="fa-solid fa-city"></i> Settlements
                    </button>
                )}
                {isLocalhost && (
                    <div className="sidebar-footer">
                        <button
                            className={`sidebar-section-header${activeView === 'campaignRepair' ? ' active' : ''}`}
                            onClick={onRepairClick}
                        >
                            <i className="fa-solid fa-gears"></i> Admin
                        </button>
                    </div>
                )}
                <DiceTray onRoll={setDiceResult} />
            </nav>
            {diceResult && <DicePopup result={diceResult} onClose={() => setDiceResult(null)} />}
        </>
    );
}

export default Sidebar;
