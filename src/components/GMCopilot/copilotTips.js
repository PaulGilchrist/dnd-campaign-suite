/**
 * GM Copilot tip registry (learnability plan Phase 1).
 *
 * One canonical place for every copilot tip's copy. The tips are ADDITIVE
 * guidance only: they never hide, disable, or gate anything, and each is
 * one-time — settled (dismissed or taken) means it never shows again in that
 * campaign, on any device (state: useGmCopilot → `gmCopilot` change-data key).
 *
 * Mount sites own the trigger condition (`when`) and the optional action
 * button; this file owns WHAT the tip says. Starter-campaign step-by-step
 * guidance stays in FirstSessionChecklist (seed-named entities); copilot tips
 * are the campaign-agnostic "what happens where" layer.
 */
export const COPILOT_TIPS = {
  'initiative-flow': {
    icon: 'fa-dice-d20',
    title: 'Combat, start to finish',
    body: 'Build or generate an encounter, then Join Encounter — initiative rolls itself, the party arrives at their live HP and AC, and every attack, save, and condition resolves with a click. Clear the board whenever you want to go back to camp.',
  },
  'monster-avatars': {
    icon: 'fa-dragon',
    title: 'Running a monster',
    body: 'Click a monster’s avatar on the tracker to open its full stat block — attacks, saves, spellcasting, and legendary actions all roll from there. Want a player to run it? The 🎮 picker on the card hands over control.',
  },
  'map-activate': {
    icon: 'fa-map',
    title: 'The map is live',
    body: 'Activating pushed this map to every connected screen. Your edits autosave in about a second and every tab updates instantly — walls, doors, fog of war, tokens, and all.',
  },

  // ---- "Try next" invitations (learnability plan Phase 2) ----
  // Same card family, different contract: they fire only while a genuine
  // precondition holds (TryNextSection re-reads it on every Admin visit),
  // taking the action navigates WITHOUT settling the tip, and × settles it
  // forever server-first. Nothing is ever hidden by them — invitations only.
  'try-combat': {
    icon: 'fa-dragon',
    title: 'Try running combat in the app',
    flag: 'Try next',
    body: (vars) => `You've saved ${vars.encounters} encounter${vars.encounters === 1 ? '' : 's'} and the initiative board is empty — Join Encounter and the engine rolls initiative, resolves attacks, saves, and conditions for you. Clearing the board later returns everyone to camp; nothing is lost.`,
  },
  'try-maps': {
    icon: 'fa-map',
    title: 'Put a battlefield on every screen',
    flag: 'Try next',
    body: (vars) => `${vars.maps} map${vars.maps === 1 ? '' : 's'} built, none active right now — activate one in Maps and every player tab gets the battlefield instantly: fog of war, tokens, doors, and all. Deactivate returns everyone to the sheets.`,
  },
  'try-tv': {
    icon: 'fa-tv',
    title: 'Dress the board for the room',
    flag: 'Try next',
    body: 'The initiative board is alive — press TV on any screen for the across-the-room view: turn spotlight, up-next strip, big HP bars, and damage floaters.',
  },

  // ---- First-denial explainers (deferred plan A) ----
  // Fired by DenialExplainer the first time a specific enforcement rule
  // denies someone in this campaign (watched off the existing
  // `enforcement_denied` log lane — the `rule` stamp classifies). Same
  // one-time contract as every tip here: × settles forever via `gmCopilot`.
  // Copy names the rule, why it exists, and the exact off-switch location.
  'denial-turnlock': {
    icon: 'fa-hourglass-half',
    title: 'That was the turn lock',
    flag: 'First refusal',
    body: 'Turn lock refuses Actions and Bonus Actions outside a creature’s own turn — Reactions still fire off-turn, exactly as the rules intend. It keeps the order on screen honest. Want it back off? Admin → Enforcement → uncheck Turn lock (or flip the master switch off for the whole box).',
  },
  'denial-economy': {
    icon: 'fa-coins',
    title: 'That was the action economy',
    flag: 'First refusal',
    body: 'Action economy charges each creature 1 Action, 1 Bonus Action and 1 Reaction per turn — extra attempts are refused with “No action left.” Every tracker card shows the chips draining. It switches off in Admin → Enforcement → Action economy.',
  },
  'denial-movement': {
    icon: 'fa-shoe-prints',
    title: 'That was the movement budget',
    flag: 'First refusal',
    body: 'Movement budget clamps token drags to what the creature has left this turn — an over-reach snaps short and logs the honest partial spend. Difficult terrain costs double. Off-switch: Admin → Enforcement → Movement budget.',
  },
  'denial-los': {
    icon: 'fa-eye-slash',
    title: 'That was line of sight',
    flag: 'First refusal',
    body: 'Line of sight denies ranged attacks and spells whose path crosses a wall or a closed door — refused before the action slot is charged, so nothing is wasted. Off-switch: Admin → Enforcement → Line of sight.',
  },
};
