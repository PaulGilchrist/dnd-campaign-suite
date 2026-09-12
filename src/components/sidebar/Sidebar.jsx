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

const RULES_URL = 'https://paulgilchrist.github.io/dnd-tools/rules/general';

const NAV_ITEMS = [
    { view: 'encounter', onClick: 'onEncounterClick', localhostOnly: true },
    { view: 'factions', onClick: 'onFactionsClick', localhostOnly: true },
    { view: 'initiative', onClick: 'onInitiativeClick' },
    { view: 'campaignLog', onClick: 'onLogClick' },
    { view: 'mapsManager', onClick: 'onMapsClick', playerLabel: 'Map' },
    { view: 'npcs', onClick: 'onNPCsClick', localhostOnly: true },
    { view: 'notes', onClick: 'onNotesClick' },
    { view: 'quests', onClick: 'onQuestsClick', localhostOnly: true },
    { external: true, icon: 'fa-book', label: 'Rules' },
    { view: 'settlements', onClick: 'onSettlementsClick', localhostOnly: true },
];

function openRules() {
    window.open(RULES_URL, '_blank');
}

function activeClass(activeView, view) {
    return `sidebar-section-header${activeView === view ? ' active' : ''}`;
}

function getActiveInfo(activeView, activeCharacter) {
    if (activeView === 'charSheet' && activeCharacter) {
        return { label: activeCharacter.name, icon: 'fa-user' };
    }
    const viewInfo = VIEW_LABELS[activeView];
    return { label: viewInfo?.label || '', icon: viewInfo?.icon || '' };
}

function NavButton({ item, activeView, handlers, isLocalhost }) {
    if (item.localhostOnly && !isLocalhost) return null;

    const { label, icon } = VIEW_LABELS[item.view] || item;
    const displayLabel = !isLocalhost && item.playerLabel ? item.playerLabel : label;

    if (item.external) {
        return (
            <button className="sidebar-section-header" onClick={openRules}>
                <i className={`fa-solid ${icon}`}></i> {displayLabel} <i className="fa-solid fa-external-link-alt fa-xs"></i>
            </button>
        );
    }

    return (
        <button className={activeClass(activeView, item.view)} onClick={handlers[item.onClick]}>
            <i className={`fa-solid ${icon}`}></i> {displayLabel}
        </button>
    );
}

function CharacterList({ characters, activeView, activeCharacter, onAddCharacter, onCharacterClick }) {
    return (
        <div className="sidebar-section">
            <div className="sidebar-section-header sidebar-section-header-static">
                Characters
            </div>
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
        </div>
    );
}

function Sidebar({ campaignName, characters, activeCharacter, onBackToCampaigns, onAddCharacter, onCharacterClick, onInitiativeClick, onEncounterClick, onFactionsClick, onMapsClick, onNotesClick, onQuestsClick, onNPCsClick, onSettlementsClick, onLogClick, onRepairClick, onRenameCampaign: _onRenameCampaign, onDeleteCampaign: _onDeleteCampaign, isLocalhost, activeView }) {
    const [diceResult, setDiceResult] = useState(null);

    const { label: activeLabel, icon: activeIcon } = getActiveInfo(activeView, activeCharacter);
    const navHandlers = { onEncounterClick, onFactionsClick, onInitiativeClick, onLogClick, onMapsClick, onNPCsClick, onNotesClick, onQuestsClick, onSettlementsClick };

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

                <CharacterList
                    characters={characters}
                    activeView={activeView}
                    activeCharacter={activeCharacter}
                    onAddCharacter={onAddCharacter}
                    onCharacterClick={onCharacterClick}
                />

                {NAV_ITEMS.map((item) => (
                    <NavButton
                        key={item.view || 'rules'}
                        item={item}
                        activeView={activeView}
                        handlers={navHandlers}
                        isLocalhost={isLocalhost}
                    />
                ))}
                {isLocalhost && (
                    <div className="sidebar-footer">
                        <button
                            className={activeClass(activeView, 'campaignRepair')}
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
