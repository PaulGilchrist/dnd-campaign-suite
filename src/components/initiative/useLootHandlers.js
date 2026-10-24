import { useState, useCallback } from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { generateLootFromCombatSummary, parseCurrencyFromLootText } from '../../services/items/lootGenerator.js'
import { depositCurrency } from '../../services/campaign/inventoryService.js'
import * as logService from '../../services/ui/logService.js'

/**
 * Hook for loot generation and awarding in the initiative component.
 */
export function useLootHandlers(campaignName, characters, combatSummary) {
    const [lootData, setLootData] = useState({ lootEntries: [], totalEncounterXp: 0 })
    const [generatingLoot, setGeneratingLoot] = useState(false)
    const [lootTextValue, setLootTextValue] = useState('')
    const [showAwardLoot, setShowAwardLoot] = useState(false)
    const [awardingLoot, setAwardingLoot] = useState(false)

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

            const lootItems = lootTextValue
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)

            if (lootItems.length > 0 && lootItems.some(item => item !== 'No loot for these monsters')) {
                await logService.addEntry(campaignName, {
                    type: 'loot',
                    encounterName: 'Combat',
                    lootItems: lootItems.filter(item => item !== 'No loot for these monsters'),
                    xpPerChar,
                    totalEncounterXp: lootData.totalEncounterXp,
                })
            }

            const logEntry = async (entry) => {
                try { await logService.addEntry(campaignName, entry) } catch { /* ignore */ }
            }
            await logEntry({
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar,
                totalEncounterXp: lootData.totalEncounterXp,
                lootItems,
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
        } catch (error) {
            console.error('Failed to award loot:', error)
        } finally {
            setAwardingLoot(false)
        }
    }, [awardingLoot, lootData, lootTextValue, campaignName, characters])

    const handleClearLoot = useCallback(() => {
        setLootData({ lootEntries: [], totalEncounterXp: 0 })
        setLootTextValue('')
        setShowAwardLoot(false)
    }, [])

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
