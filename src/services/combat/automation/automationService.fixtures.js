vi.mock('../../rules/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((itemName) => {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
      const magicBonus = Number(itemName.charAt(1))
      return {
        baseName: itemName.substring(3),
        magicBonus: isNaN(magicBonus) ? 0 : magicBonus,
      }
    }
    return { baseName: itemName, magicBonus: 0 }
  }),
}))

vi.mock('../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, abilityName) => {
    if (!abilities || !abilityName) return 0
    const lower = abilityName.toLowerCase().replace(/\s+/g, '')
    const canonicalMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
    let canonical = canonicalMap[lower]
    if (!canonical) {
      const ABILITY_NAMES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
      canonical = ABILITY_NAMES.find(n => n.toLowerCase() === lower)
      if (!canonical) return 0
    }
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
