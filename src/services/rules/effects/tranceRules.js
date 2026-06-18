export function hasTranceTrait(playerStats) {
    const storedTraits = playerStats.race?.traits;
    if (storedTraits == null) {
        console.error(`[tranceRules] race.traits missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    const traits = storedTraits || []
    return traits.some(trait => trait.name === 'Trance')
}
