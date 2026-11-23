import React from 'react'
import { parseCurrencyFromLootText } from '../../services/items/lootGenerator.js'

// TV display tier (owner decision 2026-11-23 — Paul verbatim: "nor
// generate loot, prev, next, etc. All that is done in initiative tracker
// only"): Generate/Award/Clear Loot are tracker authoring writes (XP +
// party-inventory), so the whole panel is absent on the table-mounted TV
// face. The gate rides a thin wrapper because the panel body sits AT the
// eslint complexity ceiling (PlayerLocalhostHpRow precedent), and the
// Initiative call site stays branch-free (AlliesButton self-gate law).
export default function InitiativeLoot({ tvMode = false, ...panelProps }) {
    if (tvMode) return null
    return <LootPanel {...panelProps} />
}

function LootPanel({
    lootData,
    generatingLoot,
    lootTextValue,
    setLootTextValue,
    showAwardLoot,
    setShowAwardLoot,
    awardingLoot,
    handleGenerateLoot,
    handleAwardLoot,
    handleClearLoot,
    characters,
}) {
    const hasLoot = lootData.lootEntries.length > 0 || lootTextValue.length > 0
    const xpPerCharacter = Math.floor(lootData.totalEncounterXp / (characters && characters.length > 0 ? characters.length : 1))
    const depositParts = Object.entries(parseCurrencyFromLootText(lootTextValue)).filter(([, amount]) => amount > 0)
    const depositNote = depositParts.map(([key, amount]) => `${amount} ${key}`).join(', ')
    return (
        <div className='initiative-loot-section'>
            <div className='initiative-loot-header'>
                <i className="fa-solid fa-gem"></i>&nbsp; Loot
                {hasLoot && (
                  <button
                    className='ct-btn ct-btn-sm ct-btn-danger'
                    onClick={handleClearLoot}
                    title="Clear loot suggestions"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
            </div>
            <button
              className='ct-generate-btn'
              onClick={handleGenerateLoot}
              disabled={generatingLoot}
              title="Generate loot from defeated monsters in combat"
            >
              <i className="fa-solid fa-coins"></i>&nbsp; {generatingLoot ? 'Generating...' : 'Generate Loot'}
            </button>
            {hasLoot && (
              <>
                <textarea
                  className='initiative-loot-textarea'
                  value={lootTextValue || lootData.lootEntries.join('\n')}
                  onChange={(e) => setLootTextValue(e.target.value)}
                  placeholder="Loot will appear here..."
                  rows={6}
                />
                {lootData.totalEncounterXp > 0 && (
                  <div className='initiative-xp-summary'>
                    <span className='initiative-xp-label'>
                      <i className="fa-solid fa-star"></i>&nbsp; Encounter XP: {lootData.totalEncounterXp.toLocaleString()} total &middot; {xpPerCharacter} per character
                    </span>
                    {showAwardLoot && (
                      <div className='initiative-award-loot-actions'>
                        {depositNote && (
                          <span
                            className='initiative-loot-deposit-note'
                            title="Currency from the loot lines will be credited to party inventory"
                          >
                            <i className="fa-solid fa-sack-dollar"></i>&nbsp;+{depositNote} to party inventory
                          </span>
                        )}
                        <button
                          className='ct-btn ct-btn-primary'
                          onClick={handleAwardLoot}
                          disabled={awardingLoot}
                          title="Award loot and XP to party"
                        >
                          <i className="fa-solid fa-trophy"></i>{awardingLoot ? 'Awarding...' : 'Award Loot'}
                        </button>
                        <button
                          className='ct-btn'
                          onClick={() => setShowAwardLoot(false)}
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {!showAwardLoot && lootTextValue.length > 0 && (
                      <button
                        className='ct-btn ct-btn-primary'
                        onClick={() => setShowAwardLoot(true)}
                        title="Award loot and XP to party"
                      >
                        <i className="fa-solid fa-trophy"></i>Award Loot
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
        </div>
    )
}
