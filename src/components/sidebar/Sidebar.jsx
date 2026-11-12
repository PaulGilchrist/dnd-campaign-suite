import { useState, useEffect } from 'react';
import { DiceTray, DicePopup } from './DiceTray.jsx';
import { addEntry } from '../../services/ui/logService.js';
import { CAMPAIGN_TYPE_BADGES } from '../../services/campaign/campaignMetaService.js';
import './Sidebar.css';

const VIEW_LABELS = {
    charSheet: { label: 'Character', icon: 'fa-user' },
    encounter: { label: 'Encounters', icon: 'fa-dragon' },
    factions: { label: 'Factions', icon: 'fa-handshake' },
    initiative: { label: 'Initiative', icon: 'fa-shield-alt' },
    partyInventory: { label: 'Inventory', icon: 'fa-boxes-stacked' },
    campaignLog: { label: 'Log', icon: 'fa-book-journal-whills' },
    mapsManager: { label: 'Maps', icon: 'fa-map' },
    music: { label: 'Music', icon: 'fa-music' },
    notes: { label: 'Notes', icon: 'fa-book' },
    npcs: { label: 'NPCs', icon: 'fa-users' },
    quests: { label: 'Quests', icon: 'fa-scroll' },
    sessions: { label: 'Sessions', icon: 'fa-calendar-check' },
    settlements: { label: 'Settlements', icon: 'fa-city' },
    campaignBuilder: { label: 'Drafts', icon: 'fa-wand-magic-sparkles' },
    campaignRepair: { label: 'Admin', icon: 'fa-gears' },
};

const RULES_URL = 'https://paulgilchrist.github.io/dnd-tools/rules/general';

// Popup-blocked feedback for the Rules launchpad (backlog 2026-11-12 TE):
// window.open returns null when the browser blocks the popup, leaving the
// click otherwise silent. One short sentence naming the failure and the fix.
const RULES_POPUP_BLOCKED_MESSAGE =
    'Popup blocked — allow popups for this site to open the Rules reference';
// Mirrors the .sessions-toast/.encounter-toast/.music-toast auto-hide window.
const RULES_TOAST_AUTO_HIDE_MS = 2500;

// Dice popup is pure UI feedback — auto-hide so its full-page overlay never
// intercepts clicks (mirrors the .music-toast auto-hide idiom).
const DICE_POPUP_AUTO_HIDE_MS = 4000;

const NAV_ITEMS = [
    // NAV_ITEMS render verbatim — the nav-order test pins alphabetical-by-label,
    // so a new view slots by its label, not by insertion time.
    // arenaHidden: an arena battle is a one-off fight sandbox, so campaign-only
    // planning views drop out of the nav while one is open (campaignType gate).
    { view: 'campaignBuilder', onClick: 'onCampaignBuilderClick', localhostOnly: true, arenaHidden: true },
    { view: 'encounter', onClick: 'onEncounterClick', localhostOnly: true },
    { view: 'factions', onClick: 'onFactionsClick', localhostOnly: true, arenaHidden: true },
    { view: 'initiative', onClick: 'onInitiativeClick' },
    { view: 'partyInventory', onClick: 'onInventoryClick', arenaHidden: true },
    { view: 'campaignLog', onClick: 'onLogClick' },
    { view: 'mapsManager', onClick: 'onMapsClick', playerLabel: 'Map' },
    // Ambience duty is delegable, so the music panel is open to players too
    // (main content area, activeView 'music').
    { view: 'music', onClick: 'onMusicClick' },
    { view: 'notes', onClick: 'onNotesClick', localhostOnly: true, arenaHidden: true },
    { view: 'npcs', onClick: 'onNPCsClick', localhostOnly: true },
    { view: 'quests', onClick: 'onQuestsClick', localhostOnly: true, arenaHidden: true },
    { external: true, icon: 'fa-book', label: 'Rules' },
    { view: 'sessions', onClick: 'onSessionsClick', localhostOnly: true, arenaHidden: true },
    { view: 'settlements', onClick: 'onSettlementsClick', localhostOnly: true, arenaHidden: true },
];

function openRules(showBlockedToast) {
    const popup = window.open(RULES_URL, '_blank');
    // Blocked popups return falsy — without this the click looked dead
    // (no toast, no view change; live-simulated with window.open→null).
    if (!popup) showBlockedToast(RULES_POPUP_BLOCKED_MESSAGE);
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

function NavButton({ item, activeView, handlers, isLocalhost, rulesToast, showRulesToast }) {
    if (item.localhostOnly && !isLocalhost) return null;

    const { label, icon } = VIEW_LABELS[item.view] || item;
    const displayLabel = !isLocalhost && item.playerLabel ? item.playerLabel : label;

    if (item.external) {
        return (
            <>
                <button className="sidebar-section-header" onClick={() => openRules(showRulesToast)}>
                    <i className={`fa-solid ${icon}`}></i> {displayLabel} <i className="fa-solid fa-external-link-alt fa-xs"></i>
                </button>
                {/* Popup-blocked feedback rides the app's toast lane (role=status,
                    local state + auto-hide — mirrors MusicToast/SessionsToast). */}
                {rulesToast && (
                    <div className="sidebar-toast" role="status">
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        <span className="sidebar-toast-text">{rulesToast}</span>
                    </div>
                )}
            </>
        );
    }

    return (
        <button className={activeClass(activeView, item.view)} onClick={handlers[item.onClick]}>
            <i className={`fa-solid ${icon}`}></i> {displayLabel}
        </button>
    );
}

function CharacterList({ characters, activeView, activeCharacter, onAddCharacter, onCharacterClick, isLocalhost, deleteErrorName, onDismissDeleteError }) {
    return (
        <div className="sidebar-section">
            <div className="sidebar-section-header sidebar-section-header-static">
                Characters
            </div>
            <div className="sidebar-submenu">
                {/* GM-only (mirrors the CampaignSelection Add gate): creating
                    characters is a localhost write; players see the roster only. */}
                {isLocalhost && (
                    <button className="sidebar-link add-character" onClick={onAddCharacter}>
                        <i className="fa-solid fa-plus"></i> Add Character
                    </button>
                )}
                {characters.map((char, index) => (
                    <button
                        key={`${char.name}-${index}`}
                        className={`sidebar-link${activeView === 'charSheet' && activeCharacter && activeCharacter.name === char.name ? ' active' : ''}`}
                        onClick={() => onCharacterClick(char)}
                    >
                        {char.name}
                    </button>
                ))}
                {/* Persistent counterpart to the transient delete-failure alert:
                    a failed DELETE never broadcasts SSE, so nothing else heals
                    the view — surface it here until dismissed or a later delete
                    succeeds. The roster link itself stays live (char NOT deleted). */}
                {deleteErrorName && (
                    <div className="sidebar-delete-error" role="alert">
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        <span className="sidebar-delete-error-text">
                            Delete failed: {deleteErrorName} — server error; the character is still in the roster.
                        </span>
                        <button
                            className="sidebar-delete-error-dismiss"
                            aria-label={`Dismiss delete error for "${deleteErrorName}"`}
                            onClick={onDismissDeleteError}
                        >
                            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Sidebar({ campaignName, characters, activeCharacter, onBackToCampaigns, onAddCharacter, onCharacterClick, onInitiativeClick, onEncounterClick, onFactionsClick, onMapsClick, onMusicClick, onNotesClick, onQuestsClick, onNPCsClick, onSessionsClick, onInventoryClick, onSettlementsClick, onCampaignBuilderClick, onLogClick, onRepairClick, onRenameCampaign: _onRenameCampaign, onDeleteCampaign: _onDeleteCampaign, isLocalhost, activeView, deleteErrorName, onDismissDeleteError, campaignType = 'standard' }) {
    const [diceResult, setDiceResult] = useState(null);
    // Display-only Rules-launchpad feedback (popup blocked) — mirrors the
    // sessions/encounter/music toast idiom (auto-hide timer is a benign UI
    // category, display only, no game state).
    const [rulesToast, setRulesToast] = useState(null);
    const showRulesToast = (message) => {
        setRulesToast(message);
        setTimeout(() => setRulesToast(null), RULES_TOAST_AUTO_HIDE_MS); // toast auto-hide (display only, no game state)
    };

    // Auto-hide timer (display only, no game state). A re-roll replaces
    // diceResult, restarting the countdown on the new result; early close
    // (× / Escape) and unmount run the cleanup and clear the timer.
    useEffect(() => {
        if (!diceResult) return undefined;
        const timer = setTimeout(() => setDiceResult(null), DICE_POPUP_AUTO_HIDE_MS);
        return () => clearTimeout(timer);
    }, [diceResult]);

    const handleDiceRoll = (result) => {
        setDiceResult(result);
        addEntry(campaignName, {
            type: 'roll',
            rollType: 'dice',
            characterName: 'GM',
            name: `Dice Tray ${result.label}`,
            rolls: [result.value],
            total: result.value,
            formula: result.label,
        }).catch((e) => { console.error('[Sidebar] Failed to log dice tray roll:', e); });
      };

    const { label: activeLabel, icon: activeIcon } = getActiveInfo(activeView, activeCharacter);
    const navHandlers = { onEncounterClick, onFactionsClick, onInitiativeClick, onLogClick, onMapsClick, onMusicClick, onNPCsClick, onNotesClick, onQuestsClick, onSessionsClick, onInventoryClick, onSettlementsClick, onCampaignBuilderClick };
    const typeBadge = CAMPAIGN_TYPE_BADGES[campaignType];
    const navItems = campaignType === 'arena'
        ? NAV_ITEMS.filter(item => !item.arenaHidden)
        : NAV_ITEMS;

    return (
        <>
            <nav className="sidebar no-print">
                <div className="sidebar-header">
                    <div className="campaign-name">{campaignName}</div>
                    {typeBadge && (
                        <div className={`sidebar-campaign-badge sidebar-campaign-badge--${typeBadge.cls}`}>
                            <i className={typeBadge.icon}></i> {typeBadge.label}
                        </div>
                    )}
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
                    isLocalhost={isLocalhost}
                    deleteErrorName={deleteErrorName}
                    onDismissDeleteError={onDismissDeleteError}
                />

                {navItems.map((item) => (
                    <NavButton
                        key={item.view || 'rules'}
                        item={item}
                        activeView={activeView}
                        handlers={navHandlers}
                        isLocalhost={isLocalhost}
                        rulesToast={rulesToast}
                        showRulesToast={showRulesToast}
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
                <DiceTray onRoll={handleDiceRoll} />
            </nav>
            {diceResult && <DicePopup result={diceResult} onClose={() => setDiceResult(null)} />}
        </>
    );
}

export default Sidebar;
