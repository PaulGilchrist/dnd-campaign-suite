// Shared AC computation for attack rolls (hit resolution and roll logging).

export function computeTargetAc(context, target, characters) {
    if (context?.rollType !== 'attack' || !target) {
        return undefined;
    }
    let targetAc;
    if (target.type === 'player') {
        const playerChar = (characters || []).find(c => c.name === target.name);
        const playerComputed = playerChar?.computedStats || playerChar;
        targetAc = playerComputed?.armorClass ?? playerChar?.armorClass;
    } else {
        targetAc = target.ac;
    }
    if (typeof targetAc !== 'number') {
        throw new Error(`[AC] Target "${target.name}" has no AC defined.`);
    }
    return targetAc;
}
