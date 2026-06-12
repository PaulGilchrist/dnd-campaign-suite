vi.mock('../rules/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((itemName) => {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
      return { baseName: itemName.substring(3), magicBonus: Number(itemName.charAt(1)) }
    }
    return { baseName: itemName, magicBonus: 0 }
  }),
}))

vi.mock('../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, abilityName) => {
    if (!abilities || !abilityName) return 0
    const lower = abilityName.toLowerCase().replace(/\s+/g, '')
    const canonicalMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
    const canonical = canonicalMap[lower] || abilityName.charAt(0).toUpperCase() + abilityName.slice(1)
     // resolveDiceExpression passes playerStats.abilities which defaults to {} not []
    if (!Array.isArray(abilities)) return 0
    return abilities.find(a => a.name === canonical)?.bonus ?? 0
   }),
}))

export function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCharacter',
    proficiency: 2,
    level: 3,
    class: { name: 'Barbarian', levels: 3 },
    abilities: [
      { name: 'Strength', bonus: 5 },
      { name: 'Dexterity', bonus: 2 },
      { name: 'Constitution', bonus: 3 },
      { name: 'Intelligence', bonus: -1 },
      { name: 'Wisdom', bonus: 0 },
      { name: 'Charisma', bonus: 1 },
    ],
    ...overrides,
  }
}

export function makeFeature(automation, name = 'Test Feature') {
  return { name, automation }
}
