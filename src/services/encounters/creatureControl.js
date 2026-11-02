// Creature control resolution (Phase 2 — control delegation).
//
// The tracker's existing "player-summoned creatures open their card on the
// table's devices" lane is generalized here: a creature's CONTROLLER is the
// player-character name whose device runs it. Devices are identified purely by
// the characters they play (LAN-trust model — no accounts, owner decision D2),
// so one person running several characters controls everything those
// characters control, and a visitor handed a monster via the GM's
// "Assign control" selector plays it from their own device.
//
// Precedence (documented in the levels-1-4 plan, D3):
//   1. explicit `creature.controller` (GM-assigned, survives until released)
//   2. player-sourced `summoned` targetEffects (the historical summon lane)
//   3. wild-shape / shapechange form sources (the player IS that form)
//   4. `summonedBy` on the roster row when the caster is a player creature
//   5. nobody → GM only
//
// Everything derived here is a READ of existing combat UI state; the only
// writer of (1) is the initiative card's assign handler.

function isPlayerNamed(name, allCreatures) {
    if (!name) return null
    const found = (allCreatures || []).some(c => c.type === 'player' && c.name === name)
    return found ? name : null
}

// The historical lane: a `summoned` targetEffect whose source is a player on
// the tracker. Mirrors the old computePlayerSummoned guard exactly (form
// creatures included, plain player rows excluded).
function summonedTeOwner(creature, allCreatures, myTargetEffects) {
    const eligible = creature.type !== 'player' || creature.wildShapeSource || creature.shapechangeSource
    if (!eligible) return null
    for (const te of myTargetEffects || []) {
        if (te.effect === 'summoned') {
            const owner = isPlayerNamed(te.source, allCreatures)
            if (owner) return owner
        }
    }
    return null
}

const LANES = [
    (creature) => creature.controller || null,
    (creature, all, te) => summonedTeOwner(creature, all, te),
    (creature, all) => isPlayerNamed(creature.wildShapeSource, all),
    (creature, all) => isPlayerNamed(creature.shapechangeSource, all),
    (creature, all) => isPlayerNamed(creature.summonedBy, all),
]

export function getCreatureController(creature, allCreatures = [], myTargetEffects = []) {
    if (!creature) return null
    for (const lane of LANES) {
        const controller = lane(creature, allCreatures, myTargetEffects)
        if (controller) return controller
    }
    return null
}

export function isCreatureControlled(creature, allCreatures, myTargetEffects) {
    return getCreatureController(creature, allCreatures, myTargetEffects) !== null
}
