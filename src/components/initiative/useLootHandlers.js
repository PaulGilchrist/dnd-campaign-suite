import { useState, useCallback, useEffect, useRef } from 'react'
import { getRuntimeValue, setRuntimeValue, getStore, notify } from '../../hooks/runtime/useRuntimeState.js'
import { generateLootFromCombatSummary, parseCurrencyFromLootText, parsePureCurrencyLine, filterNoLootSentinel } from '../../services/items/lootGenerator.js'
import { depositCurrency } from '../../services/campaign/inventoryService.js'
import * as logService from '../../services/ui/logService.js'

// Improve 2026-10-29: the loot panel is GM scratch state — hand-typed drafts
// and generated loot must survive an Initiative → other view → Initiative
// switch. Persisted through the runtime store's campaign bucket (registered
// 'loot-draft' campaign key, sibling of the travel-* scratch keys). Shape:
// { text, lootEntries, totalEncounterXp }; an empty draft removes the key
// entirely via the per-key DELETE lane (a null-POST would only leave a
// `key: null` corpse in change-data — useTravelManagement.clearCompletedTripKeys
// doctrine).
export const LOOT_DRAFT_KEY = 'loot-draft'
const PERSIST_DEBOUNCE_MS = 400
const EMPTY_LOOT_DRAFT = { text: '', lootEntries: [], totalEncounterXp: 0 }

function draftJson(text, lootEntries, totalEncounterXp) {
    return JSON.stringify({ text, lootEntries, totalEncounterXp })
}

function readStoredLootDraft() {
    const draft = getRuntimeValue('campaign', LOOT_DRAFT_KEY)
    return {
        text: typeof draft?.text === 'string' ? draft.text : '',
        lootEntries: Array.isArray(draft?.lootEntries) ? draft.lootEntries : [],
        totalEncounterXp: typeof draft?.totalEncounterXp === 'number' ? draft.totalEncounterXp : 0,
    }
}

// Remove the key from the local campaign store (so an immediate remount
// hydrates empty, not the wiped draft) and DELETE it server-side. The null
// SSE echo mirrors the removal to every other client (App.jsx clear-key lane).
function removeLootDraftKey(campaignName) {
    const campaignStore = getStore('campaign')
    if (campaignStore.delete(LOOT_DRAFT_KEY)) notify('campaign')
    if (!campaignName) return
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(LOOT_DRAFT_KEY)}`, { method: 'DELETE' })
        .catch((e) => console.error('[useLootHandlers] Failed to delete loot draft key:', e))
}

/**
 * Hook for loot generation and awarding in the initiative component.
 */
export function useLootHandlers(campaignName, characters, combatSummary) {
    // Hydrate from the persisted draft so a view-switch remount re-displays
    // the panel exactly as the GM left it (criteria 1/2).
    const [lootData, setLootData] = useState(() => {
        const draft = readStoredLootDraft()
        return { lootEntries: draft.lootEntries, totalEncounterXp: draft.totalEncounterXp }
    })
    const [generatingLoot, setGeneratingLoot] = useState(false)
    const [lootTextValue, setLootTextValue] = useState(() => readStoredLootDraft().text)
    const [showAwardLoot, setShowAwardLoot] = useState(false)
    const [awardingLoot, setAwardingLoot] = useState(false)

    // draftRef mirrors the latest on-screen draft; lastWrittenRef is the last
    // draft committed to the store/DELETE lane. Their inequality means an
    // un-flushed edit is pending. Plain 3-field drafts — stringify compare.
    const initialDraftJson = draftJson(lootTextValue, lootData.lootEntries, lootData.totalEncounterXp)
    const draftRef = useRef(initialDraftJson)
    const lastWrittenRef = useRef(initialDraftJson)

    const commitDraft = useCallback((text, entries, totalXp) => {
        const json = draftJson(text, entries, totalXp)
        if (json === lastWrittenRef.current) return
        lastWrittenRef.current = json
        if (json === JSON.stringify(EMPTY_LOOT_DRAFT)) {
            removeLootDraftKey(campaignName)
            return
        }
        // Campaign-bucket write: setRuntimeValue dedupes equal values against
        // the local store, and the change-<campaign>-loot-draft SSE echo lands
        // in the store only (no listener re-POSTs it) — no ping-pong.
        setRuntimeValue('campaign', LOOT_DRAFT_KEY, { text, lootEntries: entries, totalEncounterXp: totalXp }, campaignName)
    }, [campaignName])

    // Write-through with a light save debounce (the textarea POSTs per pause,
    // not per keystroke). Timers here are network/save debounce only — they
    // never advance game state.
    useEffect(() => {
        const json = draftJson(lootTextValue, lootData.lootEntries, lootData.totalEncounterXp)
        draftRef.current = json
        if (json === lastWrittenRef.current) return
        const debounceTimer = setTimeout(() => {
            commitDraft(lootTextValue, lootData.lootEntries, lootData.totalEncounterXp)
        }, PERSIST_DEBOUNCE_MS)
        return () => clearTimeout(debounceTimer)
    }, [lootTextValue, lootData, commitDraft])

    // View-switch unmount must not drop an in-flight debounce window: flush
    // the pending draft synchronously (the store set lands before the next
    // mount hydrates from it). commitDraft no-ops when nothing is pending.
    useEffect(() => () => {
        const pending = draftRef.current
        if (!pending || pending === lastWrittenRef.current) return
        const draft = JSON.parse(pending)
        commitDraft(draft.text, draft.lootEntries, draft.totalEncounterXp)
    }, [commitDraft])

    const handleGenerateLoot = useCallback(async () => {
        setGeneratingLoot(true)
        try {
            const lootResult = await generateLootFromCombatSummary(
                combatSummary,
                characters,
                campaignName
            )
            // One guard, both readers (kills the old :24-/:25 asymmetry): the
            // producer contract always resolves { lootEntries, totalEncounterXp }
            // (lootGenerator.js:335/:361/:380) — [] and 0 are its own honest
            // zero-loot values, not fabrication (autoRewardService.js:48 idiom).
            // Consumers deref lootData.lootEntries unguarded (InitiativeLoot.jsx:16/:44),
            // so normalize once and store the complete shape.
            const lootEntries = lootResult?.lootEntries || []
            const totalEncounterXp = lootResult?.totalEncounterXp || 0
            setLootData({ lootEntries, totalEncounterXp })
            setLootTextValue(lootEntries.join('\n'))
        } catch (error) {
            // Lawful entry now means generator rejection only — null/partial
            // results resolve to honest zero-loot state instead of landing
            // here accidentally via an unguarded deref.
            console.error('Failed to generate loot:', error)
        } finally {
            setGeneratingLoot(false)
        }
    }, [campaignName, characters, combatSummary])

    const handleAwardLoot = useCallback(async () => {
        if (awardingLoot) return
        setAwardingLoot(true)
        try {
            const numChars = characters && characters.length > 0 ? characters.length : 1
            const xpPerChar = Math.floor(lootData.totalEncounterXp / numChars)

            // Raw split lines minus the sentinel (never persisted anywhere —
            // 2026-10-29-AC criterion 3).
            const realLootItems = filterNoLootSentinel(lootTextValue
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0))

            // Producer-side suppression (2026-10-29-AC): the 'loot' row owns the
            // per-line reward record; when it is written the paired loot_awarded
            // row drops its duplicate lootItems list and keeps only the xp
            // fields, so a currency award no longer triple-counts in the Log.
            // Currency-only awards skip the 'loot' row entirely — the currency
            // is owned by the inventory_transfer deposit below (criteria 2/6);
            // only a real item line earns the row.
            const lootRowWritten = realLootItems.some(line => !parsePureCurrencyLine(line))
            if (lootRowWritten) {
                await logService.addEntry(campaignName, {
                    type: 'loot',
                    encounterName: 'Combat',
                    lootItems: realLootItems,
                    xpPerChar,
                    totalEncounterXp: lootData.totalEncounterXp,
                })
            }

            const logEntry = async (entry) => {
                try { await logService.addEntry(campaignName, entry) } catch { /* ignore */ }
            }
            // Zero-item / no-loot-row awards still land here, so the Log keeps a
            // rewards record via xpPerChar/totalEncounterXp (criterion 2).
            await logEntry({
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar,
                totalEncounterXp: lootData.totalEncounterXp,
            })

            for (const charData of (characters || [])) {
                const currentXp = getRuntimeValue(charData.name, 'xp') || 0
                setRuntimeValue(charData.name, 'xp', currentXp + xpPerChar, campaignName)
            }

            // Credit pure-currency loot lines (e.g. "70 platinum pieces") to the
            // party ledger via the atomic server deposit route — server re-reads
            // the ledger so a stale client snapshot can never wipe items/balances.
            // Kept out of the award's main try/catch: a failed deposit must not
            // block XP/log completion, but is logged loudly for the GM to retry.
            const deposit = parseCurrencyFromLootText(lootTextValue)
            const depositParts = Object.entries(deposit).filter(([, amount]) => amount > 0)
            if (depositParts.length > 0) {
                try {
                    await depositCurrency(campaignName, deposit)
                    await logEntry({
                        type: 'inventory_transfer',
                        message: `Loot currency deposited to party inventory: ${depositParts.map(([key, amount]) => `${amount} ${key}`).join(', ')}`,
                        timestamp: Date.now(),
                    })
                } catch (error) {
                    console.error('Failed to deposit loot currency to party inventory:', error)
                }
            }

            setShowAwardLoot(false)
            setLootTextValue('')
            setLootData({ lootEntries: [], totalEncounterXp: 0 })
            // Award-complete wipes the persisted draft (criterion 4) — the durable
            // side effects landed, so the scratch key must not resurrect the panel.
            commitDraft('', [], 0)
        } catch (error) {
            console.error('Failed to award loot:', error)
        } finally {
            setAwardingLoot(false)
        }
    }, [awardingLoot, lootData, lootTextValue, campaignName, characters, commitDraft])

    const handleClearLoot = useCallback(() => {
        setLootData({ lootEntries: [], totalEncounterXp: 0 })
        setLootTextValue('')
        setShowAwardLoot(false)
        // Clear-× fully wipes the persisted draft (criterion 4), synchronously
        // so a fast view-switch cannot remount-hydrate the just-cleared draft.
        commitDraft('', [], 0)
    }, [commitDraft])

    return {
        lootData,
        setLootData,
        generatingLoot,
        lootTextValue,
        setLootTextValue,
        showAwardLoot,
        setShowAwardLoot,
        awardingLoot,
        handleGenerateLoot,
        handleAwardLoot,
        handleClearLoot,
    }
}
