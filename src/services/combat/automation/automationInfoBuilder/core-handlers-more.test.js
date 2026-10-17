// @maintained-by-ai
import { describe, it, expect } from 'vitest'

import { coreHandlers } from './core-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// Lane split with core-handlers.test.js (#2102): that file owns tranche 1
// (cantrip_spellcasting_ability, auto_effect, survive_and_heal, auto_reroll,
// restore_balance, countercharm, misty_wanderer, misty_escape, steps_of_the_fey,
// post_cast_rider, post_cast_smite_cover, post_cast_inspiring_smite, resistance,
// land_resistance, set_condition, relentless_avenger, soul_of_vengeance,
// hunter_prey, superior_hunter_defense, bonus_action_choice, steady_aim,
// mage_hand_control, stroke_of_luck) plus moonlight_step_rider,
// shadow_step_rider, defensive_tactics, superior_hunter_prey if it honors the
// reciprocal split. This file owns the remaining coreHandlers tranche 2:
// modify_d20_roll … sentinel. No double-pinned handlers between the two files.
//
// Unit home for envelope VALUES only. Facade dispatch and registry liveness are
// pinned by automationInfoBuilder.test.js (misc.js re-aggregates core-handlers.js).
// Every custom value is deliberately distinct from its default so a silently
// hardcoded field fails (input-equals-default blindness audit, #2099). Poison
// inputs (automation.type/name) are folded into each custom row: builders must
// hardcode type and read name from feature.name (#2098).
//
// Inputs are verbatim disk anchors (public/data/2024/*.json, cited inline) or
// explicitly labelled synthetic discriminating feeds — real features never carry
// those exact shapes; they exist to separate read-vs-hardcoded arms.
//
// Per-export liveness audit (#1916): multi_target_spread, spell_breaker and
// sentinel are DEAD builder dispatch keys — no feature on disk or in
// test-campaign carries automation.type with these values. Disk routes them via
// passive_rule instead (2024/classes.json Words of Creation nests
// multi_target_spread inside a passive_rule; Spell Breaker disk effect is
// passive_rule/'spell_breaker'; feats.json Sentinel is passive_rule). Their
// builders are flagged dead at source; defaults rows retained as registry
// insurance, custom feeds skipped until a live feature dispatches them.
// Envelope effect tokens (feats_of_chaos_active, speed_0_on_oa_hit, …) are
// builder-envelope fields, not targetEffects — absent from
// targetEffectDefinitions.js by design.

// ── exact envelopes: discriminating custom feeds with poison input ───

const CUSTOM_CASES = [
    {
        handler: 'modify_d20_roll',
        // public/data/2024/feats.json Improve Fate anchor: trigger and
        // canBeBonusOrPenalty verbatim; numeric/string fields amended to
        // synthetic non-defaults (disk mirrors the builder defaults, so the
        // verbatim feed alone would be default-blind). Exact toEqual pins the
        // dropped trigger field.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'd20_test_by_self_or_ally_in_60ft',
            modifier: '3d6',
            range: '30 ft',
            canBeBonusOrPenalty: true,
            recharge: 'short_rest',
            casting_time: '1 action'
        },
        expected: {
            type: 'modify_d20_roll',
            name: 'Real Name',
            modifier: '3d6',
            range: '30 ft',
            canBeBonusOrPenalty: true,
            recharge: 'short_rest',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'fast_hands',
        // Synthetic: disk Fast Hands (2024/classes.json) carries 3 options and
        // casting_time equal to the default; this feed discriminates both fields.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            options: [{ name: 'Feint', description: 'Synthetic option.' }],
            casting_time: '1 action'
        },
        expected: {
            type: 'fast_hands',
            name: 'Real Name',
            options: [{ name: 'Feint', description: 'Synthetic option.' }],
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'use_magic_device',
        // Synthetic amendments of public/data/2024/classes.json Use Magic
        // Device: disk values equal the builder defaults except
        // scrollDisintegratesOnFail:true, so numeric fields are amended to
        // discriminate read-vs-hardcode; the true flag is disk-faithful and
        // pins the !! arm to true.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            attunementLimit: 3,
            chargeReroll: '1d8',
            chargeRerollSuccess: 5,
            scrollAbility: 'CHA',
            scrollCheckDC: '8 + spell_level',
            scrollDisintegratesOnFail: true,
            casting_time: '1 action'
        },
        expected: {
            type: 'use_magic_device',
            name: 'Real Name',
            attunementLimit: 3,
            chargeReroll: '1d8',
            chargeRerollSuccess: 5,
            scrollAbility: 'CHA',
            scrollCheckDC: '8 + spell_level',
            scrollDisintegratesOnFail: true,
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'wild_magic_surge',
        // Verbatim public/data/2024/classes.json Wild Magic Surge + poison.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'after_sorcerer_spell_slot',
            oncePerTurn: true
        },
        expected: {
            type: 'wild_magic_surge',
            name: 'Real Name',
            trigger: 'after_sorcerer_spell_slot',
            oncePerTurn: true,
            hasAutomation: true
        }
    },
    {
        handler: 'wild_magic_tamed',
        // Disk Tamed Surge anchor (trigger verbatim); recharge/uses amended to
        // synthetic non-defaults — disk mirrors the defaults there.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'after_sorcerer_spell_slot',
            recharge: 'short_rest',
            uses: 2
        },
        expected: {
            type: 'wild_magic_tamed',
            name: 'Real Name',
            trigger: 'after_sorcerer_spell_slot',
            recharge: 'short_rest',
            uses: 2,
            hasAutomation: true
        }
    },
    {
        handler: 'feats_of_chaos',
        // Synthetic in the disk Feats of Chaos truncation shape: disk carries
        // casting_time/uses/recharge which the envelope drops. effect is
        // hardcoded 'advantage' — the 'disadvantage' poison proves it is not
        // overridable (#2098).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            target: 'attack_roll',
            condition: 'chaos_brewing',
            effect: 'disadvantage',
            abilities: ['CHA'],
            casting_time: '1 action',
            uses: 2,
            recharge: 'short_rest'
        },
        expected: {
            type: 'feats_of_chaos',
            name: 'Real Name',
            target: 'attack_roll',
            condition: 'chaos_brewing',
            effect: 'advantage',
            abilities: ['CHA'],
            hasAutomation: true
        }
    },
    {
        handler: 'radiant_soul',
        // Verbatim public/data/2024/classes.json Radiant Soul + poison:
        // non-numeric tokens ('CHA modifier') pass through verbatim, never
        // evaluated; casting_time (disk 'passive' = default) is dropped.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            damageTypes: ['Radiant', 'Fire'],
            damageExpression: 'CHA modifier',
            oncePerTurn: true,
            casting_time: '1 action'
        },
        expected: {
            type: 'radiant_soul',
            name: 'Real Name',
            damageTypes: ['Radiant', 'Fire'],
            damageExpression: 'CHA modifier',
            oncePerTurn: true,
            hasAutomation: true
        }
    },
    {
        handler: 'celestial_resilience',
        // public/data/2024/classes.json Celestial Resilience anchor: HP
        // expressions verbatim (tokens, not evaluated); maxAllies/range/
        // casting_time amended to synthetic non-defaults (disk mirrors
        // defaults there).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            tempHpExpression: 'warlock level + CHA modifier',
            allyTempHpExpression: 'floor(warlock level / 2) + CHA modifier',
            maxAllies: 3,
            range: '30_ft',
            casting_time: '1 action'
        },
        expected: {
            type: 'celestial_resilience',
            name: 'Real Name',
            tempHpExpression: 'warlock level + CHA modifier',
            allyTempHpExpression: 'floor(warlock level / 2) + CHA modifier',
            maxAllies: 3,
            range: '30_ft',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'dark_ones_luck',
        // Synthetic: disk Dark One's Own Luck carries only '1d10' (the default),
        // so this feed uses '1d12' to discriminate the read.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            diceExpression: '1d12',
            casting_time: '1 action'
        },
        expected: {
            type: 'dark_ones_luck',
            name: 'Real Name',
            diceExpression: '1d12',
            hasAutomation: true
        }
    },
    {
        handler: 'hurl_through_hell',
        // Verbatim public/data/2024/classes.json Hurl Through Hell + poison:
        // discriminates damage pair, saveType, oncePerTurn and
        // pactMagicRecharge against defaults; casting_time stays disk value
        // which happens to equal the default (defaults arm pins it).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            damageExpression: '8d10',
            damageType: 'Psychic',
            saveType: 'CHA',
            saveDc: 'ability',
            saveAbility: 'CHA',
            oncePerTurn: true,
            uses: 1,
            pactMagicRecharge: true,
            casting_time: 'passive'
        },
        expected: {
            type: 'hurl_through_hell',
            name: 'Real Name',
            damageExpression: '8d10',
            damageType: 'Psychic',
            saveType: 'CHA',
            saveDc: 'ability',
            saveAbility: 'CHA',
            oncePerTurn: true,
            uses: 1,
            pactMagicRecharge: true,
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'clairvoyant_combatant',
        // Verbatim public/data/2024/classes.json Clairvoyant Combatant +
        // poison: casting_time 'passive' discriminates against the
        // '1 bonus action' default; pactMagicRecharge true discriminates !!.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            duration: '1_minute',
            casting_time: 'passive',
            pactMagicRecharge: true,
            uses: 1
        },
        expected: {
            type: 'clairvoyant_combatant',
            name: 'Real Name',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            duration: '1_minute',
            uses: 1,
            pactMagicRecharge: true,
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'create_thrall',
        // public/data/2024/classes.json Create Thrall anchor (spell + dropped
        // tempHpExpression verbatim; also live on test-campaign HexWarlock).
        // uses_expression 'proficiency_bonus' resolves through the REAL
        // evaluateAutoExpression against BASE_STATS.proficiency=3; uses/recharge/
        // action/casting_time amended to discriminate their reads.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            spell: 'Summon Aberration',
            uses: 2,
            uses_expression: 'proficiency_bonus',
            recharge: 'short_rest',
            action: 'bonus_action',
            casting_time: 'passive',
            tempHpExpression: 'warlock level + CHA modifier'
        },
        expected: {
            type: 'create_thrall',
            name: 'Real Name',
            spell: 'Summon Aberration',
            uses: 2,
            uses_expression: 'proficiency_bonus',
            usesMax: 3,
            recharge: 'short_rest',
            action: 'bonus_action',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'portent',
        // Verbatim public/data/2024/classes.json Portent + poison: the
        // envelope DROPS casting_time despite disk carrying 'passive';
        // effect 'portent' verbatim discriminates vs default ''.
        // maxDice pinned at BASE_STATS level 5; boundary tested separately.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            effect: 'portent',
            casting_time: 'passive'
        },
        expected: {
            type: 'portent',
            name: 'Real Name',
            effect: 'portent',
            maxDice: 2,
            hasAutomation: true
        }
    },
    {
        handler: 'third_eye',
        // options/action/casting_time are hardcoded canonicals (disk The Third
        // Eye carries no options at all) — poison feed proves they cannot be
        // overridden (#2098); duration is the only read field besides name.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            options: ['poison_option'],
            action: 'poison_action',
            casting_time: 'poison_time',
            duration: 'long_rest'
        },
        expected: {
            type: 'bonus_action_choice',
            name: 'Real Name',
            options: [
                { name: 'Darkvision (120 feet)', description: 'You gain Darkvision out to a range of 120 feet.' },
                { name: 'Greater Comprehension', description: 'You can read any language.' },
                { name: 'See Invisibility', description: 'You can see invisible creatures and objects within 10 feet of you that are within line of sight.' }
            ],
            action: 'bonus_action',
            casting_time: '1 bonus action',
            duration: 'long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'improved_illusions',
        // effect is hardcoded (disk Improved Illusions mirrors it) — poison
        // proves un-overridable; casting_time discriminates vs default
        // 'passive' (disk value happens to be 'passive').
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            effect: 'poison_effect',
            casting_time: '1 action'
        },
        expected: {
            type: 'improved_illusions',
            name: 'Real Name',
            effect: 'improved_illusions',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'phantasmal_creatures',
        // Verbatim public/data/2024/classes.json Phantasmal Creatures + poison:
        // spell lists and halvesHp:true discriminate; effect is hardcoded.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            effect: 'poison_effect',
            alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'],
            freeCastSpells: ['Summon Beast', 'Summon Fey'],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: true
        },
        expected: {
            type: 'phantasmal_creatures',
            name: 'Real Name',
            effect: 'phantasmal_creatures',
            casting_time: 'passive',
            hasAutomation: true,
            alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'],
            freeCastSpells: ['Summon Beast', 'Summon Fey'],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: true
        }
    },
    {
        handler: 'celestial_revelation',
        // Verbatim public/data/2024/races.json Celestial Revelation + poison:
        // options array and chooseOne:true discriminate; duration absent on
        // disk falls to the '1_minute' default inside this same row.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            options: ['Heavenly Wings', 'Inner Radiance', 'Necrotic Shroud'],
            chooseOne: true,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            minLevel: 6
        },
        expected: {
            type: 'celestial_revelation',
            name: 'Real Name',
            options: ['Heavenly Wings', 'Inner Radiance', 'Necrotic Shroud'],
            chooseOne: true,
            duration: '1_minute',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            recharge: 'long_rest',
            minLevel: 6,
            hasAutomation: true
        }
    },
    {
        handler: 'elfish_lineage',
        // Synthetic microcosm of public/data/2024/races.json Elfish Lineage
        // (disk carries 3 full lineage option objects; shape, not bulk, is the
        // contract here — chooseOne:true discriminates vs default false).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            options: [{ name: 'Drow', spellcastingAbility: 'CHA', cantrip: 'Dancing Lights' }],
            chooseOne: true
        },
        expected: {
            type: 'elfish_lineage',
            name: 'Real Name',
            options: [{ name: 'Drow', spellcastingAbility: 'CHA', cantrip: 'Dancing Lights' }],
            chooseOne: true,
            hasAutomation: true
        }
    },
    {
        handler: 'gnomish_lineage',
        // Synthetic microcosm of disk Gnomish Lineage (see above).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            options: [{ name: 'Forest Gnome', spellcastingAbility: 'INT', cantrip: 'Minor Illusion' }],
            chooseOne: true
        },
        expected: {
            type: 'gnomish_lineage',
            name: 'Real Name',
            options: [{ name: 'Forest Gnome', spellcastingAbility: 'INT', cantrip: 'Minor Illusion' }],
            chooseOne: true,
            hasAutomation: true
        }
    },
    {
        handler: 'fiendish_legacy',
        // Synthetic microcosm of disk Fiendish Legacy (see above).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            options: [{ name: 'Abyssal', cantrip: 'Poison Spray' }],
            chooseOne: true
        },
        expected: {
            type: 'fiendish_legacy',
            name: 'Real Name',
            options: [{ name: 'Abyssal', cantrip: 'Poison Spray' }],
            chooseOne: true,
            hasAutomation: true
        }
    },
    {
        handler: 'lesser_restoration',
        // Synthetic: disk 2024/spells.json Lesser Restoration carries exactly
        // the builder defaults (Touch / 4-condition list / 1 bonus action), so
        // this feed amends every field to discriminate the reads.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            range: '30 ft',
            conditions: ['petrified'],
            casting_time: '1 action'
        },
        expected: {
            type: 'lesser_restoration',
            name: 'Real Name',
            range: '30 ft',
            conditions: ['petrified'],
            casting_time: '1 action',
            hasAutomation: true
        }
    }
]

// ── exact envelopes: empty-automation defaults arm ────────────────────

const DEFAULTS_CASES = [
    {
        handler: 'modify_d20_roll',
        expected: {
            type: 'modify_d20_roll',
            name: 'Test Feature',
            modifier: '2d4',
            range: '60 ft',
            canBeBonusOrPenalty: false,
            recharge: 'initiative_or_short_or_long_rest',
            casting_time: '1 reaction',
            hasAutomation: true
        }
    },
    {
        handler: 'fast_hands',
        expected: {
            type: 'fast_hands',
            name: 'Test Feature',
            options: [],
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'use_magic_device',
        expected: {
            type: 'use_magic_device',
            name: 'Test Feature',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: false,
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'wild_magic_surge',
        expected: {
            type: 'wild_magic_surge',
            name: 'Test Feature',
            trigger: '',
            oncePerTurn: false,
            hasAutomation: true
        }
    },
    {
        handler: 'wild_magic_tamed',
        expected: {
            type: 'wild_magic_tamed',
            name: 'Test Feature',
            trigger: '',
            recharge: 'long_rest',
            uses: 1,
            hasAutomation: true
        }
    },
    {
        handler: 'feats_of_chaos',
        expected: {
            type: 'feats_of_chaos',
            name: 'Test Feature',
            target: 'd20',
            condition: 'feats_of_chaos_active',
            effect: 'advantage',
            abilities: [],
            hasAutomation: true
        }
    },
    {
        // ⚠ DEAD builder (#1916): disk routes via nested key inside a
        // passive_rule (Words of Creation) — no automation.type dispatch
        // reaches this handler. Row kept as registry insurance.
        handler: 'multi_target_spread',
        expected: {
            type: 'multi_target_spread',
            name: 'Test Feature',
            spellFilter: [],
            range: '10 ft',
            hasAutomation: true
        }
    },
    {
        handler: 'radiant_soul',
        expected: {
            type: 'radiant_soul',
            name: 'Test Feature',
            damageTypes: [],
            damageExpression: '',
            oncePerTurn: false,
            hasAutomation: true
        }
    },
    {
        handler: 'celestial_resilience',
        expected: {
            type: 'celestial_resilience',
            name: 'Test Feature',
            tempHpExpression: '',
            allyTempHpExpression: '',
            maxAllies: 5,
            range: '60_ft',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'dark_ones_luck',
        expected: {
            type: 'dark_ones_luck',
            name: 'Test Feature',
            diceExpression: '1d10',
            hasAutomation: true
        }
    },
    {
        handler: 'hurl_through_hell',
        expected: {
            type: 'hurl_through_hell',
            name: 'Test Feature',
            damageExpression: '',
            damageType: '',
            saveType: 'CHA',
            saveDc: 'ability',
            saveAbility: 'CHA',
            oncePerTurn: false,
            uses: 1,
            pactMagicRecharge: false,
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'clairvoyant_combatant',
        expected: {
            type: 'clairvoyant_combatant',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            duration: '1_minute',
            uses: 1,
            pactMagicRecharge: false,
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        // ⚠ DEAD builder (#1916): disk Spell Breaker routes through
        // passive_rule (effect 'spell_breaker'), never automation.type
        // 'spell_breaker'. Row kept as registry insurance; note type is
        // 'passive_rule', not the handler key.
        handler: 'spell_breaker',
        expected: {
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'spell_breaker',
            alwaysPreparedSpells: [],
            bonusActionSpells: [],
            dispelAbilityCheckBonus: '',
            slotRetentionSpells: [],
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'create_thrall',
        expected: {
            type: 'create_thrall',
            name: 'Test Feature',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'portent',
        expected: {
            type: 'portent',
            name: 'Test Feature',
            effect: '',
            maxDice: 2,
            hasAutomation: true
        }
    },
    {
        handler: 'third_eye',
        expected: {
            type: 'bonus_action_choice',
            name: 'Test Feature',
            options: [
                { name: 'Darkvision (120 feet)', description: 'You gain Darkvision out to a range of 120 feet.' },
                { name: 'Greater Comprehension', description: 'You can read any language.' },
                { name: 'See Invisibility', description: 'You can see invisible creatures and objects within 10 feet of you that are within line of sight.' }
            ],
            action: 'bonus_action',
            casting_time: '1 bonus action',
            duration: 'short_or_long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'improved_illusions',
        expected: {
            type: 'improved_illusions',
            name: 'Test Feature',
            effect: 'improved_illusions',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'phantasmal_creatures',
        expected: {
            type: 'phantasmal_creatures',
            name: 'Test Feature',
            effect: 'phantasmal_creatures',
            casting_time: 'passive',
            hasAutomation: true,
            alwaysPreparedSpells: [],
            freeCastSpells: [],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: false
        }
    },
    {
        handler: 'celestial_revelation',
        expected: {
            type: 'celestial_revelation',
            name: 'Test Feature',
            options: [],
            chooseOne: false,
            duration: '1_minute',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            recharge: 'long_rest',
            minLevel: 3,
            hasAutomation: true
        }
    },
    {
        handler: 'elfish_lineage',
        expected: {
            type: 'elfish_lineage',
            name: 'Test Feature',
            options: [],
            chooseOne: false,
            hasAutomation: true
        }
    },
    {
        handler: 'gnomish_lineage',
        expected: {
            type: 'gnomish_lineage',
            name: 'Test Feature',
            options: [],
            chooseOne: false,
            hasAutomation: true
        }
    },
    {
        handler: 'fiendish_legacy',
        expected: {
            type: 'fiendish_legacy',
            name: 'Test Feature',
            options: [],
            chooseOne: false,
            hasAutomation: true
        }
    },
    {
        handler: 'lesser_restoration',
        expected: {
            type: 'lesser_restoration',
            name: 'Test Feature',
            range: 'Touch',
            conditions: ['blinded', 'deafened', 'paralyzed', 'poisoned'],
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        // ⚠ DEAD builder (#1916): disk Sentinel feats route through
        // passive_rule (effects 'speed_0_on_oa_hit' /
        // 'opportunity_attack_speed_zero'), never automation.type 'sentinel'.
        // Row kept as registry insurance.
        handler: 'sentinel',
        expected: {
            type: 'sentinel',
            name: 'Test Feature',
            effect: 'speed_0_on_oa_hit',
            duration: 'end_of_turn',
            casting_time: '1 action',
            hasAutomation: true
        }
    }
]

describe('coreHandlers tranche 2 – custom feeds, exact envelope + poison type/name', () => {
    it.each(CUSTOM_CASES)('$handler reads every field, hardcodes type/name', ({ handler, automation, expected }) => {
        expect(coreHandlers[handler](makeFeature(automation, 'Real Name'), BASE_STATS)).toEqual(expected)
    })
})

describe('coreHandlers tranche 2 – empty automation, exact defaults envelope', () => {
    it.each(DEFAULTS_CASES)('$handler', ({ handler, expected }) => {
        expect(coreHandlers[handler](makeFeature({}), BASE_STATS)).toEqual(expected)
    })
})

// ── portent – level boundary on maxDice (>= 14 → 3) ──────────────────

describe('portent – maxDice level boundary', () => {
    it('is 2 below level 14 and 3 at 14 and above', () => {
        const feature = makeFeature({ type: 'portent' })
        expect(coreHandlers.portent(feature, { ...BASE_STATS, level: 13 }).maxDice).toBe(2)
        expect(coreHandlers.portent(feature, { ...BASE_STATS, level: 14 }).maxDice).toBe(3)
        expect(coreHandlers.portent(feature, { ...BASE_STATS, level: 20 }).maxDice).toBe(3)
    })
})
