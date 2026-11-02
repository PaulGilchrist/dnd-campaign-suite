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
import { addEntry } from '../../services/ui/logService.js'

export function useAllyEditor({ campaignName, isLocalhost }) {
    // Ephemeral modal state (AGENTS "stays local: showModal") — never game state.
    const [target, setTarget] = React.useState(null)

    const openAllyEditor = React.useCallback((creature) => {
        if (!isLocalhost) return
        const combatSummary = getCombatSummary(campaignName)
        // Mirror the monster-card lane: list ALL creatures INCLUDING self — the
        // modal requires >=1 selection, and self-only is exactly "trusts no one".
        const creatures = (combatSummary?.creatures || [])
            .map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp }))
        setTarget({ name: creature.name, creatures })
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
        title: `Allies of ${target.name}`,
        icon: 'fa-handshake',
    } : null

    return { allyEditorOpen: !!target, modalProps, openAllyEditor, closeAllyEditor, confirmAllyEditor }
}
