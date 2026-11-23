/**
 * Per-view "About this screen" copy for the Help drawer (learnability plan
 * Phase 3). Keyed by the SAME view strings as SIDEBAR_VIEWS (routes/config.js)
 * plus the overlay 'map' view — one canonical home for the one-liners.
 * Copy is plain English, verb-first, and states what the screen is FOR,
 * not how it is mounted.
 */
export const VIEW_HELP = {
  charSheet: 'Your living character sheet. Click any number — ability, save, skill, attack, spell slot — to roll it through the shared engine; conditions you carry appear as badges and block exactly what the rules say they block. Short Rest and Long Rest run the full recovery workflow.',
  initiative: 'The shared initiative board. Join Encounter rolls initiative for everyone; the active creature is highlighted on every screen. Players act from their sheets; monsters act from their card — click a monster avatar to open its stat block and roll any action. The TV button dresses this board for an across-the-room screen.',
  mapsManager: 'Your map library: create, generate (dungeon or hex terrain), rename, describe, and activate maps. Activating is the moment a map goes live — every connected player tab switches to it instantly.',
  map: 'The live tactical map. Players drag their own tokens; you can move anyone’s. Fog of war lifts as lines of sight open, the wand tool drops spell area overlays for everyone to see, and the 3D button turns any indoor map into a real-time WebGL view.',
  encounter: 'The encounter builder: pick monsters, watch the XP budget and difficulty rate honestly, save and reuse fights, or Generate three balanced options for your party. Join Encounter expands everything onto the initiative board with initiative already rolled.',
  factions: 'The powers behind the throne: goals, influence (1–10 across four colour-coded tiers), and notes. Game-day reference for who wants what from the party.',
  notes: 'Markdown story notes with location, timestamps, party level, and private (GM-only) entries. Your searchable campaign scratchpad.',
  quests: 'The GM quest planner: hooks, status (active / completed / failed), rewards, and private notes. Players read the same quests on the Quest Board.',
  questBoard: 'The player-facing quest board — the same quests as the planner, presented as the table sees them: what’s active, done, or failed.',
  npcs: 'Your custom recurring characters — the innkeep, the cult leader, the rival knight — with appearance, personality, goals, and secrets. Add an AC and one click puts them on the initiative board. Pre-made monsters never live here; they join through the Encounter Builder with their real stats.',
  sessions: 'The GM planning notebook, one entry per game night: link the maps, encounters, NPCs, and quests you expect to use, tick a prep checklist, then Mark as Played and flow the recap into the log.',
  partyInventory: 'The shared party stash: loot lands unclaimed, then gets given, moved, and split between pack and stash — every transfer logged. Party currency lives here too. Everyone at the table sees the same numbers.',
  settlements: 'Towns, cities, and villages — hand-built or generated with services, named folk, rumours, government, and threats. Your game-day “who runs the shop?” reference.',
  campaignBuilder: 'The AI Campaign Designer (local model, localhost only): chat a brief, edit the build plan, and generate a whole interlinked adventure as drafts you approve one at a time. Players cannot see drafts until you approve them.',
  campaignLog: 'The campaign’s shared memory: every roll, hit, save, spell, rest, travel event, and audit entry, timestamped and filterable. If someone asks “what number came up?” — it’s in here.',
  gmScreen: 'The GM presentation screen for the table-facing view of the campaign.',
  music: 'Table ambience: five moods with auto-play, transport controls, and custom categories. The DJ role is delegable to a player, and every change syncs to all screens.',
  campaignRepair: 'Campaign admin: rename, snapshots and rollback, scoped clears, typed delete — plus the optional Enforcement & Referee console and the local AI settings. Everything here is confirmed and logged.',
};
