import { useState, useEffect, useRef, useCallback } from 'react';
import { DiceTray, DicePopup } from './DiceTray.jsx';
import { addEntry } from '../../services/ui/logService.js';
import { CAMPAIGN_TYPE_BADGES } from '../../services/campaign/campaignMetaService.js';
import { useSmallScreen } from '../../hooks/ui/useSmallScreen.js';
import './Sidebar.css';

const VIEW_LABELS = {
    charSheet: { label: 'Character', icon: 'fa-user' },
    encounter: { label: 'Encounters', icon: 'fa-dragon' },
    factions: { label: 'Factions', icon: 'fa-handshake' },
    gmScreen: { label: 'GM Screen', icon: 'fa-eye' },
    initiative: { label: 'Initiative', icon: 'fa-shield-alt' },
    partyInventory: { label: 'Inventory', icon: 'fa-boxes-stacked' },
    campaignLog: { label: 'Log', icon: 'fa-book-journal-whills' },
    mapsManager: { label: 'Maps', icon: 'fa-map' },
    music: { label: 'Music', icon: 'fa-music' },
    notes: { label: 'Notes', icon: 'fa-book' },
    npcs: { label: 'NPCs', icon: 'fa-users' },
    quests: { label: 'Quests', icon: 'fa-scroll' },
    questBoard: { label: 'Quest Board', icon: 'fa-list-check' },
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
    // Pure-read GM lookup panel — localhost-only like the other GM views. NOT
    // arenaHidden: it is an in-combat lookup (party saves/status/quick ref),
    // not a campaign planning view, so an arena battle keeps it.
    { view: 'gmScreen', onClick: 'onGMScreenClick', localhostOnly: true },
    // In-app help drawer (learnability plan Phase 3): opens an overlay, not a
    // view. Slotted gmScreen→initiative so the nav stays alphabetical (pinned
    // by Sidebar.test 'renders nav buttons in alphabetical order by label').
    { help: true, icon: 'fa-circle-question', label: 'Help' },
    { view: 'initiative', onClick: 'onInitiativeClick' },
    { view: 'partyInventory', onClick: 'onInventoryClick', arenaHidden: true },
    { view: 'campaignLog', onClick: 'onLogClick' },
    { view: 'mapsManager', onClick: 'onMapsClick', playerLabel: 'Map' },
    // Ambience duty is delegable, so the music panel is open to players too
    // (main content area, activeView 'music').
    { view: 'music', onClick: 'onMusicClick' },
    { view: 'notes', onClick: 'onNotesClick', localhostOnly: true, arenaHidden: true },
    { view: 'npcs', onClick: 'onNPCsClick', localhostOnly: true },
    // Player chrome (Item 9): the read-only quest board is open to visitors —
    // it renders only the field-whitelisted /quests/board + /factions/standings
    // lanes. localhost sees it too (same shared table — the GM's authoring
    // stays in the separate GM-only "Quests" planner). arenaHidden like the
    // planner: campaign-progress theatre, not part of an arena fight sandbox.
    { view: 'questBoard', onClick: 'onQuestBoardClick', arenaHidden: true },
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

function NavButton({ item, activeView, handlers, isLocalhost, rulesToast, showRulesToast, onNavigate }) {
    if (item.localhostOnly && !isLocalhost) return null;

    const { label, icon } = VIEW_LABELS[item.view] || item;
    const displayLabel = !isLocalhost && item.playerLabel ? item.playerLabel : label;

    if (item.external) {
        return (
            <>
                {/* onNavigate lets the small-screen drawer close on this pick too —
                    the Rules popup opens in a new tab, so the drawer would
                    otherwise linger over the unchanged view. */}
                <button className="sidebar-section-header" onClick={() => { openRules(showRulesToast); onNavigate(); }}>
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

    // In-app help drawer opener (Phase 3): an overlay, not a view — no
    // activeView highlight applies.
    if (item.help) {
        return (
            <button className="sidebar-section-header" onClick={handlers.onHelpClick}>
                <i className={`fa-solid ${icon}`}></i> {displayLabel}
            </button>
        );
    }

    return (
        <button className={activeClass(activeView, item.view)} onClick={handlers[item.onClick]}>
            <i className={`fa-solid ${icon}`}></i> {displayLabel}
        </button>
    );
}

function CharacterList({ characters, activeView, activeCharacter, onAddCharacter, onCharacterClick, isLocalhost, deleteErrorName, onDismissDeleteError }) {
    // Roster collapse is per-client display state (no localStorage lane — the
    // header is a keyboard-focusable disclosure button, same tag tier as every
    // other sidebar-section-header; defaults to expanded, matching the
    // always-expanded mount behaviour of commit 9c3f99481).
    const [rosterExpanded, setRosterExpanded] = useState(true);
    return (
        <div className="sidebar-section">
            <button
                className="sidebar-section-header"
                onClick={() => setRosterExpanded((prev) => !prev)}
            >
                Characters
            </button>
            {rosterExpanded && (
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
            )}
        </div>
    );
}

function Sidebar({ campaignName, characters, activeCharacter, onBackToCampaigns, onAddCharacter, onCharacterClick, onInitiativeClick, onEncounterClick, onFactionsClick, onGMScreenClick, onMapsClick, onMusicClick, onNotesClick, onQuestsClick, onQuestBoardClick, onNPCsClick, onSessionsClick, onInventoryClick, onSettlementsClick, onCampaignBuilderClick, onLogClick, onRepairClick, onHelpClick, onRenameCampaign: _onRenameCampaign, onDeleteCampaign: _onDeleteCampaign, isLocalhost, activeView, deleteErrorName, onDismissDeleteError, campaignType = 'standard' }) {
    const [diceResult, setDiceResult] = useState(null);
    // Collapsible small-screen nav (backlog 2026-11-23 collapsible-sidebar):
    // below SMALL_SCREEN_MAX_PX the fixed sidebar docks off-canvas (Sidebar.css
    // 768px media block) behind a toggle, and .app-body releases its 180px
    // gutter to a slim toggle column. `navOpen` is per-client local UI state
    // (plain useState — never the runtime store), default collapsed; two tabs
    // collapse independently. Desktop never renders the toggle and keeps the
    // always-visible sidebar (the drawer classes/attr stay off at ≥ breakpoint).
    const smallScreen = useSmallScreen();
    const [navOpen, setNavOpen] = useState(false);
    const drawerOpen = smallScreen && navOpen;
    const navRef = useRef(null);
    const toggleRef = useRef(null);
    const closeNav = useCallback(() => {
        setNavOpen(false);
        // Close-restore twin of the app's modal law (useModalDismiss/Popup
        // precedent): focus returns to the toggle, which unmounts nothing it
        // still needs — on desktop the toggle ref is simply null (no-op).
        toggleRef.current?.focus();
    }, []);
    // Escape closes, matching the HelpDrawer/app-wide modal idiom.
    useEffect(() => {
        if (!drawerOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') closeNav(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawerOpen, closeNav]);
    // Opening the drawer focuses the nav (the toggle "opens/focuses
    // navigation"); tabIndex={-1} makes the container programmable-focusable
    // so screen readers announce the region and Tab continues into the links.
    useEffect(() => {
        if (drawerOpen) navRef.current?.focus();
    }, [drawerOpen]);
    // Crossing back to desktop must not leave a latent open flag behind — a
    // later resize down would otherwise pop the drawer open unbidden.
    useEffect(() => {
        if (!smallScreen) setNavOpen(false);
    }, [smallScreen]);
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
    // Every destination pick (nav header, roster link, Add Character, Rules,
    // Help, Campaigns exit, Admin) also closes the small-screen drawer, so
    // selecting a view returns the content area to full width. On desktop
    // closeNav is an observable no-op (no toggle mounted, navOpen already
    // false), so one wrapper covers both tiers.
    const selectAndClose = (fn) => (...args) => { fn(...args); closeNav(); };
    const navHandlers = {
        onEncounterClick, onFactionsClick, onGMScreenClick, onInitiativeClick, onLogClick,
        onMapsClick, onMusicClick, onNPCsClick, onNotesClick, onQuestsClick, onQuestBoardClick,
        onSessionsClick, onInventoryClick, onSettlementsClick, onCampaignBuilderClick, onHelpClick,
    };
    for (const key of Object.keys(navHandlers)) navHandlers[key] = selectAndClose(navHandlers[key]);
    const typeBadge = CAMPAIGN_TYPE_BADGES[campaignType];
    const navItems = campaignType === 'arena'
        ? NAV_ITEMS.filter(item => !item.arenaHidden)
        : NAV_ITEMS;

    return (
        <>
            {/* Small-screen-only toggle (never rendered at desktop widths —
                the sidebar is permanent there). Doubles as the drawer's close
                (×) while open: it outranks the backdrop/drawer z-tiers so it
                stays clickable; keyboard-native (Enter/Space on a button). */}
            {smallScreen && (
                <button
                    ref={toggleRef}
                    className="sidebar-nav-toggle"
                    onClick={() => (navOpen ? closeNav() : setNavOpen(true))}
                    aria-expanded={navOpen}
                    aria-controls="sidebar-nav"
                    aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
                >
                    <i className={`fa-solid ${navOpen ? 'fa-xmark' : 'fa-bars'}`} aria-hidden="true"></i>
                </button>
            )}
            {/* Backdrop mirrors HelpDrawer: pure-click dismiss over the
                dimmed page while the nav drawer is open. */}
            {drawerOpen && <div className="sidebar-nav-backdrop" onClick={closeNav}></div>}
            <nav
                id="sidebar-nav"
                ref={navRef}
                tabIndex={-1}
                inert={smallScreen && !navOpen}
                className={`sidebar no-print${drawerOpen ? ' sidebar--drawer-open' : ''}`}
            >
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

                <button className="sidebar-section-header" onClick={selectAndClose(onBackToCampaigns)}>
                    <i className="fa-solid fa-arrow-left"></i> Campaigns
                </button>

                <CharacterList
                    characters={characters}
                    activeView={activeView}
                    activeCharacter={activeCharacter}
                    onAddCharacter={selectAndClose(onAddCharacter)}
                    onCharacterClick={selectAndClose(onCharacterClick)}
                    isLocalhost={isLocalhost}
                    deleteErrorName={deleteErrorName}
                    onDismissDeleteError={onDismissDeleteError}
                />

                {navItems.map((item) => (
                    <NavButton
                        key={item.view || (item.help ? 'help' : 'rules')}
                        item={item}
                        activeView={activeView}
                        handlers={navHandlers}
                        isLocalhost={isLocalhost}
                        rulesToast={rulesToast}
                        showRulesToast={showRulesToast}
                        onNavigate={closeNav}
                    />
                ))}
                {isLocalhost && (
                    <div className="sidebar-footer">
                        <button
                            className={activeClass(activeView, 'campaignRepair')}
                            onClick={selectAndClose(onRepairClick)}
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
