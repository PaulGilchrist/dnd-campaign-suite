export function hasTranceTrait(playerStats) {
    const traits = playerStats.race?.traits || []
    return traits.some(trait => trait.name === 'Trance')
}
