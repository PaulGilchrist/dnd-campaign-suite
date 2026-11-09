// @maintained-by-ai
// Tracker ally editor (Phase 3.2 — in-campaign betrayal / split party / arena
// teams). Owns the ephemeral modal-open state and the write, reusing the exact
// `selectedAllies` key and AllySelectionModal the monster card already uses —
// allegiance has ONE model (owner decision D4). Editing at any time is the whole
// story (D4: no scripted restore switch): a defector is a two-click edit and the
// engine (auras, Redirect Attack, AoE auto-select) follows immediately because
// it already reads getAllyList. Writes are GM-authorship (bug-player-clients-can-
// hijack-initiative family) and every edit logs an audit row (repo log rule).

import React from 'react'
import { getAllyList, setAllyList } from '../../hooks/useAllySelection.js'
import { getCombatSummary } from '../../services/encounters/combatData.js'
import { isSecondTurnEntry } from '../../services/combat/thiefsReflexesService.js'
import { addEntry } from '../../services/ui/logService.js'

export function useAllyEditor({ campaignName, isLocalhost }) {
    // Ephemeral modal state (AGENTS "stays local: showModal") — never game state.
    const [target, setTarget] = React.useState(null)

    const openAllyEditor = React.useCallback((creature) => {
        if (!isLocalhost) return
        // CLA-360 law (mirrors openEffectAdder in Initiative.jsx, c5883e4a4):
        // structural (Second Turn) rows are synthetic transport — selectedAllies
        // keyed by the suffixed name is a phantom bucket (invisible, orphaned at
        // the round wrap) and the audit would name a creature with no character
        // file. Route GM intent to the holder's real, visible state. The
        // fromSecondTurn flag is display-only provenance for the modal header —
        // writes and the audit row still name the holder alone.
        const fromSecondTurn = isSecondTurnEntry(creature) && !!creature.holderName
        const subject = fromSecondTurn
            ? { ...creature, name: creature.holderName }
            : creature
        const combatSummary = getCombatSummary(campaignName)
        // Mirror the monster-card lane: list ALL creatures INCLUDING self — the
        // modal requires >=1 selection, and self-only is exactly "trusts no one".
        // Synthetic (Second Turn) rows are never allegiance candidates (the same
        // exclusion law as the CreatureCard target list / useTvPresentation).
        const creatures = (combatSummary?.creatures || [])
            .filter(c => !isSecondTurnEntry(c))
            .map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp }))
        setTarget({ name: subject.name, creatures, fromSecondTurn })
    }, [campaignName, isLocalhost])

    const closeAllyEditor = React.useCallback(() => setTarget(null), [])

    const confirmAllyEditor = React.useCallback((selectedAllies) => {
        if (!target) return
        setAllyList(target.name, selectedAllies, campaignName)
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: target.name,
            abilityName: 'Ally Selection',
            description: `${target.name}'s allies set to: ${selectedAllies.join(', ') || 'no one (hostile to all)'}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[useAllyEditor] ally-selection log failed:', e) })
        setTarget(null)
    }, [campaignName, target])

    const modalProps = target ? {
        creatures: target.creatures,
        currentAllies: getAllyList(target.name),
        // Header names the HOLDER (the write subject) plus a display-only hint
        // when opened from the twin's card, so the GM can tell WHICH card's
        // modal is open (holder/normal opens keep the old byte-exact title).
        title: `Allies of ${target.name}${target.fromSecondTurn ? ' (second turn)' : ''}`,
        icon: 'fa-handshake',
    } : null

    return { allyEditorOpen: !!target, modalProps, openAllyEditor, closeAllyEditor, confirmAllyEditor }
}
