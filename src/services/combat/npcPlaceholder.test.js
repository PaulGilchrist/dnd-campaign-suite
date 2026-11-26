// @maintained-by-ai 2026-11-18
// Lane: isBareNpcPlaceholder — the bare "+NPC" placeholder classifier
// (services/combat/npcPlaceholder.js, doctrine twin of creaturePresence.js:
// component tests factory-mock initiativeService, so the predicate lives on
// its own leaf and consumers always get the real one).
// Law (backlog 2026-11-18): bare placeholders are bookkeeping slots, not
// combatants — excluded from the victory bank, the trackerHasFoes banner gate,
// and the Clear rebuild. Classification is by ROW SHAPE (auto-name + no
// bestiary binding), never by combat history: an attacked/armed placeholder is
// still a placeholder (criterion 4 — the row behaves normally during combat,
// it just stops counting as a foe).
import { describe, it, expect } from 'vitest';
import { isBareNpcPlaceholder } from './npcPlaceholder.js';

describe('isBareNpcPlaceholder', () => {
    it('matches untouched +NPC placeholder rows', () => {
        expect(isBareNpcPlaceholder({ name: 'NPC 1', type: 'npc', ac: 10, maxHp: 10, currentHp: 10 })).toBe(true);
        expect(isBareNpcPlaceholder({ name: 'NPC 12', type: 'npc' })).toBe(true);
    });

    it('rejects EB-joined monsters, summons, renamed placeholders, players, and nameless rows', () => {
        expect(isBareNpcPlaceholder({ name: 'Goblin', type: 'npc', monsterIndex: 'goblin' })).toBe(false);
        expect(isBareNpcPlaceholder({ name: 'Goblin 2', type: 'npc', monsterIndex: 'goblin' })).toBe(false);
        expect(isBareNpcPlaceholder({ name: 'Bear', type: 'npc', monsterIndex: 'bear', summonedBy: 'Wild_Sage_Druid' })).toBe(false);
        expect(isBareNpcPlaceholder({ name: 'Goblin', type: 'npc' })).toBe(false); // renamed NPC / index-less monster
        expect(isBareNpcPlaceholder({ name: 'npc 1', type: 'npc' })).toBe(false); // case-exact name shape
        expect(isBareNpcPlaceholder({ name: 'NPC 1', type: 'elemental' })).toBe(false);
        expect(isBareNpcPlaceholder({ name: 'Alice', type: 'player' })).toBe(false);
        expect(isBareNpcPlaceholder({ type: 'npc' })).toBe(false); // nameless row never matches
    });

    it('custom-named NPCs are REAL foes (renaming leaves the auto-name class)', () => {
        expect(isBareNpcPlaceholder({ name: 'Steve', type: 'npc' })).toBe(false);
        expect(isBareNpcPlaceholder({ name: 'NPC 1 Guard', type: 'npc' })).toBe(false); // suffixed rename
        expect(isBareNpcPlaceholder({ name: 'NPC ', type: 'npc' })).toBe(false); // no number
    });

    it('classification is by row shape only — combat history never un-bares a slot', () => {
        // Damaged, initiative-stamped and armed placeholders stay bare: the
        // victory-bank/gate exclusion keys on the CLASS, not on whether the
        // row ever spoke in the ledger (attacking the bookkeeping slot is a
        // GM override, not a bestiary combat).
        expect(isBareNpcPlaceholder({ name: 'NPC 1', type: 'npc', currentHp: 0, maxHp: 10 })).toBe(true);
        expect(isBareNpcPlaceholder({ name: 'NPC 1', type: 'npc', initiative: '14', targetName: 'Alice' })).toBe(true);
        // But a bestiary binding (monsterIndex) is decisive even on an auto-shaped name.
        expect(isBareNpcPlaceholder({ name: 'NPC 1', type: 'npc', monsterIndex: 'goblin' })).toBe(false);
    });
});
