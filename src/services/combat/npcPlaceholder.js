// Bare "+NPC" placeholder classification for the initiative board.
//
// Lives in its own module (NOT initiativeService) per the creaturePresence.js
// doctrine: many component tests factory-mock initiativeService, and consumers
// of this predicate (victory-bank math, TV-banner gating, the Clear seam) must
// always get the REAL predicate.
//
// A bare placeholder is the GM's bookkeeping slot spawned via the "+ NPC"
// affordance: auto-named "NPC <n>" with NO bestiary binding. EB-joined monsters
// and summons stamp monsterIndex (encounterToInitiative), and a renamed
// placeholder loses the auto-name shape and becomes a genuine custom NPC —
// neither is bare. Bare rows are not combatants: they never count toward the
// victory bank's foes/defeated/fled math, never gate the victory banner, and
// never survive a Clear (backlog 2026-11-18: a placeholder silently killed a
// real 6-kill celebration and later faked a "1 drove off" line).
export function isBareNpcPlaceholder(creature) {
    return creature.type === 'npc' && !creature.monsterIndex && /^NPC \d+$/.test(creature.name || '')
}
