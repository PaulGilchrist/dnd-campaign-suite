/**
 * monsters.json IRV canonical schema: damage_immunities / damage_resistances /
 * damage_vulnerabilities / condition_immunities. The CLA-207 mixed-list shape
 * (damage types and condition names co-mingled inside `immunities`) was
 * migrated in-disk by the no-legacy sweep (2026-11-16) — every row now carries
 * the split keys, so this resolver is a plain read.
 * Shared by knowEnemyHandler, encounterToInitiative, initiativeService,
 * monsterSummon and MonsterCardBody (CLA-173).
 */
export function resolveMonsterIRV(monsterData) {
    return {
        immunities: monsterData.damage_immunities || [],
        resistances: monsterData.damage_resistances || [],
        vulnerabilities: monsterData.damage_vulnerabilities || [],
        conditionImmunities: monsterData.condition_immunities || [],
    };
}
