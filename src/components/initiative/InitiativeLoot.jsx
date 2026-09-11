import React from 'react'

export default function InitiativeLoot({
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
    return (
        <div className='initiative-loot-section'>
            <div className='initiative-loot-header'>
                <i className="fa-solid fa-gem"></i>&nbsp; Loot
                {hasLoot && (
                  <button
                    className='initiative-btn initiative-btn-secondary'
                    onClick={handleClearLoot}
                    title="Clear loot suggestions"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
            </div>
            <button
              className='initiative-btn initiative-btn-loot'
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
                        <button
                          className='initiative-btn initiative-btn-complete'
                          onClick={handleAwardLoot}
                          disabled={awardingLoot}
                          title="Award loot and XP to party"
                        >
                          <i className="fa-solid fa-trophy"></i>{awardingLoot ? 'Awarding...' : 'Award Loot'}
                        </button>
                        <button
                          className='initiative-btn initiative-btn-secondary'
                          onClick={() => setShowAwardLoot(false)}
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {!showAwardLoot && lootTextValue.length > 0 && (
                      <button
                        className='initiative-btn initiative-btn-loot'
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
