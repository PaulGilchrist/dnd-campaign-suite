export function getCarryingCapacity(playerStats) {
    const str = playerStats.abilities.find((a) => a.name === 'Strength');
    const strScore = str?.totalScore || 10;
    let capacity = strScore * 15;
    const sizeMultiplier = playerStats.sizeMultiplier || 1;
    return capacity * sizeMultiplier;
}
