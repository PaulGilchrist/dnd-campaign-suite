/**
 * Sidebar navigation data + the personalized-toolbelt logic
 * (learnability backlog Item 1).
 *
 * Extracted from Sidebar.jsx so the toolbelt dialog (and the App-level
 * hidden-view guard) can enumerate the same view set the sidebar renders —
 * one canonical source, no parallel list. Sidebar.jsx remains a pure
 * component module (react-refresh law: shared data lives in services).
 *
 * The toolbelt stores ONLY the per-campaign hidden-view set
 * (`toolbelt: { hiddenViews: [...] }` in the campaign-meta lane). Presets
 * are one-click BATCH SETS of the checkboxes — conveniences, never modes:
 * nothing preset-shaped is ever stored, and the active chip is DERIVED by
 * matching the current hidden set (mirrors the EnforcementSection preset
 * doctrine). Every checkbox stays editable before and after a preset click.
 */

export const VIEW_LABELS = {
    charSheet: { label: 'Character', icon: 'fa-user' },
    chronicle: { label: 'Chronicle', icon: 'fa-book-open' },
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

// The Admin footer button lives outside NAV_ITEMS (Sidebar renders it in the
// GM-only footer) but is a sidebar view like any other, so it rides the
// toolbelt set too.
const FOOTER_VIEW = 'campaignRepair';

export const NAV_ITEMS = [
    // NAV_ITEMS render verbatim — the nav-order test pins alphabetical-by-label,
    // so a new view slots by its label, not by insertion time.
    // arenaHidden: an arena battle is a one-off fight sandbox, so campaign-only
    // planning views drop out of the nav while one is open (campaignType gate).
    // Chronicle (backlog Item 2): the shared story read — player-visible like
    // the quest board (no localhostOnly gate), arenaHidden like the campaign
    // story surfaces (an arena fight is disposable, not a chronicle). Kept
    // VISIBLE by every toolbelt preset: the payoff view belongs at the table
    // whether or not battle maps run, and its export/print face is exactly
    // what a paper-night table wants to keep.
    { view: 'chronicle', onClick: 'onChronicleClick', arenaHidden: true },
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

// Views the toolbelt dialog offers a checkbox for: every sidebar destination
// (nav items + the Admin footer), alphabetically by label like the nav itself.
// Help and Rules are openers, not views; the character roster is the sheet
// lane, not a hideable destination.
export const TOOLBELT_VIEWS = [
    ...NAV_ITEMS.filter((item) => item.view).map(({ view }) => view),
    FOOTER_VIEW,
]
    .map((view) => ({ view, label: VIEW_LABELS[view].label }))
    .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Starting points: one click sets the whole checkbox list. These are
 * convenience batch-sets ONLY — nothing here is a stored mode, every
 * checkbox remains editable afterwards, and a preset locks nothing.
 * `hidden` is the set of views the preset HIDES (everything else shows).
 */
export const TOOLBELT_PRESETS = [
    {
        id: 'everything',
        label: 'Everything',
        hint: 'Show every sidebar view.',
        hidden: [],
    },
    {
        id: 'print-dice',
        label: 'Print & real dice',
        hint: 'Sheets on paper, dice in hand — the app stays your reference bench: prep, maps and monster lookups, without the live-table surfaces.',
        hidden: ['initiative', 'campaignLog', 'partyInventory', 'music'],
    },
    {
        id: 'theater',
        label: 'Theater of the mind',
        hint: 'Playing digitally, just no battle maps — the Maps surface steps aside.',
        hidden: ['mapsManager'],
    },
    {
        id: 'full-digital',
        label: 'Full digital',
        hint: 'Everything the table plays with, none of the between-session prep chrome.',
        hidden: ['campaignBuilder', 'factions', 'notes', 'quests', 'sessions', 'settlements'],
    },
];

/** Canonicalize a hidden set: dedupe, order by the checkbox list's order. */
export const normalizeHiddenViews = (views) => {
    const known = new Set(views);
    return TOOLBELT_VIEWS.map(({ view }) => view).filter((view) => known.has(view));
};

/**
 * DERIVED active preset (never stored): the preset whose hidden set exactly
 * equals the current selection, else null → the UI shows a "Custom" chip.
 * Mirrors enforcement matchPreset — moving any checkbox after a preset click
 * reads Custom the instant it happens.
 */
export const matchToolbeltPreset = (hiddenViews) => {
    const hidden = new Set(hiddenViews);
    return TOOLBELT_PRESETS.find(
        (p) => p.hidden.length === hidden.size && p.hidden.every((view) => hidden.has(view)),
    ) || null;
};

/**
 * Route guard for the toolbelt: a view that has been hidden (live SSE or a
 * fresh load) must not stay mounted — resolve it back to the neutral stage
 * (null). localhostOnly gating is NOT this function's job: visitors never
 * render GM nav regardless of the hidden set.
 */
export const resolveVisibleView = (activeView, hiddenViews) =>
    (activeView && hiddenViews.includes(activeView) ? null : activeView);

/**
 * F13 (Item 7): the one label a view answers to on a given origin. Visitors
 * renamed by a NAV_ITEMS playerLabel ("Map") must see that SAME word in the
 * view's own header — the visitor "Map" nav opening a "Maps" header was the
 * last drift of the deleted SIDEBAR_BUTTONS era. GM labels ride VIEW_LABELS.
 */
export const getViewLabel = (view, isLocalhost) => {
    if (!isLocalhost) {
        const item = NAV_ITEMS.find(n => n.view === view);
        if (item && item.playerLabel) return item.playerLabel;
    }
    return (VIEW_LABELS[view] && VIEW_LABELS[view].label) || '';
};
