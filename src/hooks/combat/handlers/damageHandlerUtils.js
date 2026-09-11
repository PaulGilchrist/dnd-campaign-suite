// Shared helpers for the damage handlers in this directory.

export function getHpThreshold({ oldHp, newHp, maxHp, deadHp = newHp }) {
    const wasAlive = oldHp > 0;
    const isDead = deadHp <= 0;
    const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
    const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);
    if (!wasAlive && isDead) return 'dead';
    if (!wasBloodied && isBloodied) return 'bloodied';
    if (wasBloodied && !isBloodied && newHp > 0) return 'recovering';
    return undefined;
}

export function assignSecondaryFields(dest, secondaryResult, suffixes) {
    if (!secondaryResult) return;
    for (const suffix of suffixes) {
        dest['secondary' + suffix] = secondaryResult[suffix[0].toLowerCase() + suffix.slice(1)];
    }
}

export function buildDamageBreakdownEntry(applyResult, damageType, amount) {
    return {
        damageType,
        amount,
        resisted: applyResult?.resistanceDetails?.some(rd => rd.status === 'resistant') ?? false,
        status: applyResult?.resistanceDetails?.[0]?.status || null,
    };
}
