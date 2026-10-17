// @maintained-by-ai
import { describe, it, expect } from 'vitest'

import { coreHandlers } from './core-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// Lane split with core-handlers-more.test.js (#2101/#2102): this file owns
// tranche 1 (cantrip_spellcasting_ability … stroke_of_luck) plus the
// previously-unowned gap handlers moonlight_step_rider, shadow_step_rider,
// defensive_tactics, superior_hunter_prey, bewitching_magic, memorize_spell,
// shadow_arts, illusory_reality, remove_curse, spare_the_dying,
// protection_from_poison. Tranche 2 (modify_d20_roll … sentinel) lives in
// core-handlers-more.test.js. No double-pinned handlers between the two files.
//
// Unit home for envelope VALUES only. Facade dispatch and registry liveness are
// pinned by automationInfoBuilder.test.js (misc.js re-aggregates core-handlers.js).
// Every custom value is deliberately distinct from its default so a silently
// hardcoded field fails (input-equals-default blindness audit, #2099). Poison
// inputs (automation.type/name) are folded into each custom row: builders must
// hardcode type and read name from feature.name (#2098). Rows carrying extra
// disk keys (casting_time on the step riders, duration/maxTargets on Turn
// Undead) pin envelope DROPS via toEqual.
//
// Inputs are verbatim disk anchors (public/data/2024/*.json, public/data/*.json,
// cited inline) or explicitly labelled synthetic discriminating feeds — real
// features never carry those exact shapes; they exist to separate read-vs-
// hardcoded arms. Rows where disk values mirror the builder defaults amend the
// colliding fields to synthetic non-defaults so the read arm stays load-bearing.
//
// Per-export liveness audit (#1916): all tranche-1 + gap keys dispatch live on
// disk EXCEPT survive_and_heal — no automation.type 'survive_and_heal' exists
// on disk or in test-campaign; disk Last Stand (public/data/feats.json) routes
// the same behavior through auto_effect with effect 'survive_and_heal'. Its
// rows are flagged dead dispatch and kept as registry insurance because the
// handler owns the only healAmount resolution arms in this file.
// shadow_arts and illusory_reality are LIVE: 2024/classes.json carries both as
// automation.type (Shadow Arts, Illusory Reality). Envelope effect tokens
// (illusory_reality, shadow_arts, feats_of_chaos_active …) are builder-envelope
// fields, not targetEffects — absent from targetEffectDefinitions.js by design.

// ── exact envelopes: discriminating custom feeds with poison input ───

const CUSTOM_CASES = [
    {
        handler: 'cantrip_spellcasting_ability',
        // Verbatim public/data/2024/races.json LightBearer + poison: both
        // fields discriminate vs the '' defaults.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            cantripName: 'Light',
            spellcastingAbility: 'Charisma'
        },
        expected: {
            type: 'cantrip_spellcasting_ability',
            name: 'Real Name',
            cantripName: 'Light',
            spellcastingAbility: 'Charisma',
            hasAutomation: true
        }
    },
    {
        handler: 'auto_effect',
        // public/data/feats.json Last Stand anchor + poison: minHp and
        // healExpression are DROPPED by this envelope (the survive_and_heal
        // builder consumes them; disk routes Last Stand here as auto_effect).
        // uses/value/recharge amended (absent-or-default on disk) so every
        // read arm discriminates; duration absent falls to '' in this row.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healExpression: 'half_max_hp',
            recharge: 'short_rest',
            casting_time: '1 action',
            uses: 2,
            value: 5
        },
        expected: {
            type: 'auto_effect',
            name: 'Real Name',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            value: 5,
            uses: 2,
            recharge: 'short_rest',
            duration: '',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        // ⚠ DEAD dispatch (#1916): no automation.type 'survive_and_heal' on
        // disk — Last Stand routes via auto_effect. Registry insurance; the
        // healAmount arms below are the only coverage of this builder.
        handler: 'survive_and_heal',
        // Synthetic (disk-shape dead): explicit 'half_max_hp' arm; odd max 21
        // pins Math.floor (10, not 10.5/11); all text fields discriminate vs
        // defaults.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'when_brought_to_0',
            effect: 'stand_and_heal',
            minHp: 2,
            healExpression: 'half_max_hp',
            recharge: 'short_rest'
        },
        stats: { ...BASE_STATS, hitPoints: { max: 21 } },
        expected: {
            type: 'survive_and_heal',
            name: 'Real Name',
            trigger: 'when_brought_to_0',
            effect: 'stand_and_heal',
            minHp: 2,
            healAmount: 10,
            recharge: 'short_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'survive_and_heal',
        // Synthetic: numeric-string arm; max 21 (floor 10) vs parseInt('17')
        // = 17 proves the parseInt arm, not a mis-wired half-max default.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            healExpression: '17'
        },
        stats: { ...BASE_STATS, hitPoints: { max: 21 } },
        expected: {
            type: 'survive_and_heal',
            name: 'Real Name',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healAmount: 17,
            recharge: 'long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'survive_and_heal',
        // Synthetic: no-expression arm with hitPoints present → floor(30/2)=15.
        automation: { type: 'poison_type', name: 'poison_name' },
        stats: { ...BASE_STATS, hitPoints: { max: 30 } },
        expected: {
            type: 'survive_and_heal',
            name: 'Real Name',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healAmount: 15,
            recharge: 'long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'auto_reroll',
        // public/data/2024/classes.json Fanatical Focus anchor + poison:
        // target/condition/trigger/bonusExpression/oncePerRage/casting_time
        // verbatim; effect amended (absent on disk → would hit 'reroll'
        // default); bonus:0 pins the ?? arm (|| would collapse to null);
        // oncePerTurn:true and oncePer discriminate vs defaults; description
        // is read from feature.description, not automation.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'failed_save_while_raging',
            target: 'saving_throw',
            condition: 'raging',
            effect: 'reroll_with_bonus',
            bonus: 0,
            range: 'Self',
            resourceCost: 'rage',
            bonusExpression: 'rage_damage',
            oncePerRage: true,
            oncePerTurn: true,
            oncePer: 'long_rest',
            casting_time: 'passive'
        },
        description: 'Real description',
        expected: {
            type: 'auto_reroll',
            name: 'Real Name',
            description: 'Real description',
            target: 'saving_throw',
            condition: 'raging',
            effect: 'reroll_with_bonus',
            trigger: 'failed_save_while_raging',
            bonus: 0,
            range: 'Self',
            resourceCost: 'rage',
            casting_time: 'passive',
            bonusExpression: 'rage_damage',
            oncePerRage: true,
            oncePerTurn: true,
            oncePer: 'long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'restore_balance',
        // public/data/2024/classes.json Restore Balance anchor: disk values
        // mirror the defaults, so both are amended; casting_time is DROPPED
        // by the envelope (disk carries '1 reaction').
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            target: 'saving_throw',
            range: '30_ft',
            casting_time: '1 reaction'
        },
        expected: {
            type: 'restore_balance',
            name: 'Real Name',
            target: 'saving_throw',
            range: '30_ft',
            hasAutomation: true
        }
    },
    {
        handler: 'countercharm',
        // public/data/2024/classes.json Countercharm anchor + poison: trigger/
        // range/conditions/effect verbatim; uses/recharge/casting_time
        // amended (disk mirrors the defaults there).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'failed_save_charmed_or_frightened',
            range: '30 ft',
            conditions: ['charmed', 'frightened'],
            effect: 'reroll_with_advantage',
            uses: 2,
            recharge: 'short_rest',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'countercharm',
            name: 'Real Name',
            trigger: 'failed_save_charmed_or_frightened',
            range: '30 ft',
            conditions: ['charmed', 'frightened'],
            effect: 'reroll_with_advantage',
            uses: 2,
            recharge: 'short_rest',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'misty_wanderer',
        // public/data/2024/classes.json Misty Wanderer anchor: disk carries
        // uses_expression/recharge which the envelope DROPS; trigger synthetic
        // (absent on disk → would hit '' default); range/casting_time amended
        // (disk mirrors the defaults there).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'after_misty_step',
            range: '10_ft',
            casting_time: '1 reaction',
            uses_expression: 'WIS modifier_min_1',
            recharge: 'long_rest'
        },
        expected: {
            type: 'misty_wanderer',
            name: 'Real Name',
            trigger: 'after_misty_step',
            range: '10_ft',
            casting_time: '1 reaction',
            hasAutomation: true
        }
    },
    {
        handler: 'misty_escape',
        // public/data/2024/classes.json Misty Escape anchor + poison: damage
        // pair verbatim ('2d10'/'Psychic' vs '' defaults); spell/saveType/
        // saveDc/saveAbility/condition/casting_time amended (disk mirrors the
        // defaults there).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            spell: 'Thunder Step',
            saveType: 'CON',
            saveDc: 'flat',
            saveAbility: 'CON',
            damageExpression: '2d10',
            damageType: 'Psychic',
            condition: 'hidden',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'misty_escape',
            name: 'Real Name',
            spell: 'Thunder Step',
            saveType: 'CON',
            saveDc: 'flat',
            saveAbility: 'CON',
            damageExpression: '2d10',
            damageType: 'Psychic',
            condition: 'hidden',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'steps_of_the_fey',
        // public/data/2024/classes.json Steps of the Fey shape; disk
        // uses_expression 'CHA modifier_min_1' replaced with
        // 'proficiency_bonus' which resolves through the REAL
        // evaluateAutoExpression against BASE_STATS.proficiency=3; remaining
        // fields amended to discriminate their reads vs defaults.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            spell: 'Thunder Step',
            uses: 2,
            uses_expression: 'proficiency_bonus',
            recharge: 'short_rest',
            casting_time: 'passive',
            saveAbility: 'CON',
            saveDc: 'flat'
        },
        expected: {
            type: 'steps_of_the_fey',
            name: 'Real Name',
            spell: 'Thunder Step',
            uses: 2,
            uses_expression: 'proficiency_bonus',
            usesMax: 3,
            recharge: 'short_rest',
            casting_time: 'passive',
            saveAbility: 'CON',
            saveDc: 'flat',
            hasAutomation: true
        }
    },
    {
        handler: 'moonlight_step_rider',
        // public/data/2024/classes.json Moonlight Step nest: envelope is a
        // bare type/name marker — disk casting_time is DROPPED (amended here
        // to prove the drop is not an accidental default match).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 action'
        },
        expected: {
            type: 'moonlight_step_rider',
            name: 'Real Name',
            hasAutomation: true
        }
    },
    {
        handler: 'shadow_step_rider',
        // public/data/2024/classes.json Improved Shadow Step nest: bare
        // marker; disk casting_time 'passive' amended to prove the drop.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 action'
        },
        expected: {
            type: 'shadow_step_rider',
            name: 'Real Name',
            hasAutomation: true
        }
    },
    {
        handler: 'post_cast_rider',
        // Synthetic (no disk automation.type anchor found): every read field
        // set to a distinct non-default.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            saveType: 'INT',
            saveDc: 'flat',
            saveAbility: 'INT',
            condition: 'restrained',
            duration: '1_hour',
            range: '30 ft',
            spellSchools: ['Enchantment', 'Illusion'],
            recharge: 'short_rest'
        },
        expected: {
            type: 'post_cast_rider',
            name: 'Real Name',
            saveType: 'INT',
            saveDc: 'flat',
            saveAbility: 'INT',
            condition: 'restrained',
            duration: '1_hour',
            range: '30 ft',
            spellSchools: ['Enchantment', 'Illusion'],
            recharge: 'short_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'post_cast_smite_cover',
        // public/data/2024/classes.json Smite of Protection anchor: disk
        // casting_time 'passive' mirrors the default; amended to discriminate.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 reaction'
        },
        expected: {
            type: 'post_cast_smite_cover',
            name: 'Real Name',
            casting_time: '1 reaction',
            hasAutomation: true
        }
    },
    {
        handler: 'post_cast_inspiring_smite',
        // public/data/2024/classes.json Inspiring Smite anchor: disk values
        // mirror the defaults; both amended to discriminate.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            range: '60 ft',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'post_cast_inspiring_smite',
            name: 'Real Name',
            range: '60 ft',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'resistance',
        // Verbatim public/data/2024/classes.json Avatar of Battle + poison:
        // damageTypes verbatim ('Poison'-free real list vs [] default);
        // casting_time DROPPED by the envelope.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            casting_time: 'passive'
        },
        expected: {
            type: 'resistance',
            name: 'Real Name',
            damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            hasAutomation: true
        }
    },
    {
        handler: 'land_resistance',
        // Verbatim public/data/2024/classes.json Nature's Ward + poison:
        // immunity and full land mapping verbatim vs ''/{} defaults.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            conditionImmunity: 'poisoned',
            landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
            casting_time: 'passive'
        },
        expected: {
            type: 'land_resistance',
            name: 'Real Name',
            conditionImmunity: 'poisoned',
            landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
            hasAutomation: true
        }
    },
    {
        handler: 'set_condition',
        // Verbatim public/data/2024/classes.json Turn Undead + poison:
        // saveAbility/duration/maxTargets/resourceCost/casting_time are
        // DROPPED by the envelope; cost is amended (disk carries resourceCost
        // under a different key, so the envelope's cost read needs its own
        // discriminating feed).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            saveType: 'WIS',
            saveAbility: 'WIS',
            condition: 'frightened',
            additionalCondition: 'incapacitated',
            range: '30 ft',
            duration: '1_minute',
            target: 'undead_in_range',
            effect: 'add_condition',
            maxTargets: 'all',
            resourceCost: 'channel_divinity',
            casting_time: '1 action',
            cost: '2 channel uses'
        },
        expected: {
            type: 'set_condition',
            name: 'Real Name',
            target: 'undead_in_range',
            condition: 'frightened',
            additionalCondition: 'incapacitated',
            cost: '2 channel uses',
            range: '30 ft',
            saveType: 'WIS',
            effect: 'add_condition',
            hasAutomation: true
        }
    },
    {
        handler: 'relentless_avenger',
        // public/data/2024/classes.json Relentless Avenger anchor: disk
        // duration mirrors the default and carries no trigger; both amended;
        // casting_time DROPPED.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'after_opportunity_attack_by_marked',
            duration: 'until_end_of_next_turn',
            casting_time: '1 action'
        },
        expected: {
            type: 'relentless_avenger',
            name: 'Real Name',
            trigger: 'after_opportunity_attack_by_marked',
            duration: 'until_end_of_next_turn',
            hasAutomation: true
        }
    },
    {
        handler: 'soul_of_vengeance',
        // public/data/2024/classes.json Soul of Vengeance anchor: disk
        // trigger mirrors the default; amended; casting_time DROPPED.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            trigger: 'after_vow_target_damages_ally',
            casting_time: '1 reaction'
        },
        expected: {
            type: 'soul_of_vengeance',
            name: 'Real Name',
            trigger: 'after_vow_target_damages_ally',
            hasAutomation: true
        }
    },
    {
        handler: 'hunter_prey',
        // public/data/2024/classes.json Hunter's Prey anchor: disk
        // casting_time 'passive' mirrors the default; amended.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 action'
        },
        expected: {
            type: 'hunter_prey',
            name: 'Real Name',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'defensive_tactics',
        // public/data/2024/classes.json Defensive Tactics anchor: disk
        // casting_time 'passive' mirrors the default; amended.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 reaction'
        },
        expected: {
            type: 'defensive_tactics',
            name: 'Real Name',
            casting_time: '1 reaction',
            hasAutomation: true
        }
    },
    {
        handler: 'superior_hunter_prey',
        // public/data/2024/classes.json Superior Hunter's Prey anchor: disk
        // casting_time 'passive' mirrors the default; amended.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'superior_hunter_prey',
            name: 'Real Name',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'superior_hunter_defense',
        // public/data/2024/classes.json Superior Hunter's Defense anchor:
        // disk casting_time '1 reaction' mirrors the default; amended.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'superior_hunter_defense',
            name: 'Real Name',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'bonus_action_choice',
        // Synthetic microcosm of public/data/2024/classes.json Cunning
        // Action (disk carries 3 full option objects and casting_time equal
        // to the default): shape, not bulk, is the contract — every field
        // discriminates vs default.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            options: [{ name: 'Feint', description: 'Synthetic option.' }],
            action: 'action',
            casting_time: '1 action'
        },
        expected: {
            type: 'bonus_action_choice',
            name: 'Real Name',
            options: [{ name: 'Feint', description: 'Synthetic option.' }],
            action: 'action',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'steady_aim',
        // public/data/2024/classes.json Steady Aim anchor: disk values mirror
        // the defaults; both amended to discriminate.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            duration: 'until_end_of_next_turn',
            casting_time: '1 action'
        },
        expected: {
            type: 'steady_aim',
            name: 'Real Name',
            duration: 'until_end_of_next_turn',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'mage_hand_control',
        // public/data/2024/classes.json Mage Hand Legerdemain anchor: disk
        // values mirror the defaults; all three amended to discriminate.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            range: '60_ft',
            action: 'action',
            casting_time: '1 action'
        },
        expected: {
            type: 'mage_hand_control',
            name: 'Real Name',
            range: '60_ft',
            action: 'action',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'stroke_of_luck',
        // public/data/2024/classes.json Stroke of Luck anchor + poison: disk
        // target/recharge mirror the defaults; both amended; casting_time
        // 'passive' verbatim and DROPPED by the envelope.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            target: 'saving_throw',
            recharge: 'long_rest',
            casting_time: 'passive'
        },
        expected: {
            type: 'stroke_of_luck',
            name: 'Real Name',
            target: 'saving_throw',
            recharge: 'long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'bewitching_magic',
        // public/data/2024/classes.json Bewitching Magic anchor: disk
        // casting_time 'passive' mirrors the default; amended.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 action'
        },
        expected: {
            type: 'bewitching_magic',
            name: 'Real Name',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'memorize_spell',
        // public/data/2024/classes.json Memorize Spell anchor: disk
        // casting_time 'passive' mirrors the default; amended.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'memorize_spell',
            name: 'Real Name',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'shadow_arts',
        // public/data/2024/classes.json Shadow Arts anchor + poison: effect
        // is hardcoded — poison proves un-overridable (#2098); freeCastSpells
        // verbatim; usesMax/recharge/saveAbility amended (disk mirrors the
        // defaults there); casting_time amended (disk 'passive' = default).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            effect: 'poison_effect',
            casting_time: '1 action',
            freeCastSpells: ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence'],
            usesMax: 2,
            recharge: 'short_rest',
            saveAbility: 'CHA'
        },
        expected: {
            type: 'shadow_arts',
            name: 'Real Name',
            effect: 'shadow_arts',
            casting_time: '1 action',
            hasAutomation: true,
            freeCastSpells: ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence'],
            usesMax: 2,
            recharge: 'short_rest',
            saveAbility: 'CHA'
        }
    },
    {
        handler: 'illusory_reality',
        // public/data/2024/classes.json Illusory Reality anchor + poison:
        // effect hardcoded (disk mirrors it) — poison proves un-overridable;
        // casting_time/objectDuration amended (disk mirrors the defaults).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            effect: 'poison_effect',
            casting_time: '1 action',
            objectDuration: '1 hour'
        },
        expected: {
            type: 'illusory_reality',
            name: 'Real Name',
            effect: 'illusory_reality',
            casting_time: '1 action',
            objectDuration: '1 hour',
            hasAutomation: true
        }
    },
    {
        handler: 'remove_curse',
        // public/data/2024/spells.json Remove Curse anchor: disk values
        // (Touch / 1 action) mirror the defaults; both amended to discriminate.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            range: '30 ft',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'remove_curse',
            name: 'Real Name',
            range: '30 ft',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'spare_the_dying',
        // public/data/2024/spells.json Spare the Dying anchor + poison:
        // casting_time '1 action' verbatim discriminates vs the 'action'
        // default; range amended (disk '15 feet' = default).
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            range: '5 feet',
            casting_time: '1 action'
        },
        expected: {
            type: 'spare_the_dying',
            name: 'Real Name',
            range: '5 feet',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'protection_from_poison',
        // public/data/2024/spells.json Protection from Poison anchor: disk
        // values (Touch / 1 hour / 1 action) all mirror the defaults; every
        // field amended to discriminate its read.
        automation: {
            type: 'poison_type',
            name: 'poison_name',
            range: '30 ft',
            duration: '1 minute',
            casting_time: '1 bonus action'
        },
        expected: {
            type: 'protection_from_poison',
            name: 'Real Name',
            range: '30 ft',
            duration: '1 minute',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    }
]

// ── exact envelopes: empty-automation defaults arm ────────────────────

const DEFAULTS_CASES = [
    {
        handler: 'cantrip_spellcasting_ability',
        expected: {
            type: 'cantrip_spellcasting_ability',
            name: 'Test Feature',
            cantripName: '',
            spellcastingAbility: '',
            hasAutomation: true
        }
    },
    {
        handler: 'auto_effect',
        expected: {
            type: 'auto_effect',
            name: 'Test Feature',
            trigger: '',
            effect: '',
            value: null,
            uses: null,
            recharge: 'long_rest',
            duration: '',
            casting_time: '',
            hasAutomation: true
        }
    },
    {
        // ⚠ DEAD dispatch (#1916), see custom rows. BASE_STATS carries no
        // hitPoints, so this row doubles as the maxHp → level fallback probe:
        // healAmount = floor(level 5 / 2) = 2.
        handler: 'survive_and_heal',
        expected: {
            type: 'survive_and_heal',
            name: 'Test Feature',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healAmount: 2,
            recharge: 'long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'auto_reroll',
        expected: {
            type: 'auto_reroll',
            name: 'Test Feature',
            description: '',
            target: 'd20',
            condition: '',
            effect: 'reroll',
            trigger: '',
            bonus: null,
            range: '',
            resourceCost: '',
            casting_time: '',
            bonusExpression: '',
            oncePerRage: false,
            oncePerTurn: false,
            oncePer: '',
            hasAutomation: true
        }
    },
    {
        handler: 'restore_balance',
        expected: {
            type: 'restore_balance',
            name: 'Test Feature',
            target: 'd20',
            range: '60_ft',
            hasAutomation: true
        }
    },
    {
        handler: 'countercharm',
        expected: {
            type: 'countercharm',
            name: 'Test Feature',
            trigger: '',
            range: '',
            conditions: [],
            effect: '',
            uses: 1,
            recharge: 'long_rest',
            casting_time: '1 reaction',
            hasAutomation: true
        }
    },
    {
        handler: 'misty_wanderer',
        expected: {
            type: 'misty_wanderer',
            name: 'Test Feature',
            trigger: '',
            range: '5_ft',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'misty_escape',
        expected: {
            type: 'misty_escape',
            name: 'Test Feature',
            spell: 'Misty Step',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            damageExpression: '',
            damageType: '',
            condition: 'invisible',
            casting_time: '1 reaction',
            hasAutomation: true
        }
    },
    {
        handler: 'steps_of_the_fey',
        expected: {
            type: 'steps_of_the_fey',
            name: 'Test Feature',
            spell: 'Misty Step',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            saveAbility: 'CHA',
            saveDc: 'ability',
            hasAutomation: true
        }
    },
    {
        handler: 'moonlight_step_rider',
        expected: {
            type: 'moonlight_step_rider',
            name: 'Test Feature',
            hasAutomation: true
        }
    },
    {
        handler: 'shadow_step_rider',
        expected: {
            type: 'shadow_step_rider',
            name: 'Test Feature',
            hasAutomation: true
        }
    },
    {
        handler: 'post_cast_rider',
        expected: {
            type: 'post_cast_rider',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            condition: '',
            duration: '1_minute',
            range: '60 ft',
            spellSchools: [],
            recharge: 'long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'post_cast_smite_cover',
        expected: {
            type: 'post_cast_smite_cover',
            name: 'Test Feature',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'post_cast_inspiring_smite',
        expected: {
            type: 'post_cast_inspiring_smite',
            name: 'Test Feature',
            range: '30 ft',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'resistance',
        expected: {
            type: 'resistance',
            name: 'Test Feature',
            damageTypes: [],
            hasAutomation: true
        }
    },
    {
        handler: 'land_resistance',
        expected: {
            type: 'land_resistance',
            name: 'Test Feature',
            conditionImmunity: '',
            landMappings: {},
            hasAutomation: true
        }
    },
    {
        // target/condition are transparent pass-throughs (auto.target /
        // auto.condition, no || default) — undefined is the pinned contract.
        handler: 'set_condition',
        expected: {
            type: 'set_condition',
            name: 'Test Feature',
            target: undefined,
            condition: undefined,
            additionalCondition: null,
            cost: '',
            range: '60 ft',
            saveType: 'STR',
            effect: '',
            hasAutomation: true
        }
    },
    {
        handler: 'relentless_avenger',
        expected: {
            type: 'relentless_avenger',
            name: 'Test Feature',
            trigger: 'after_opportunity_attack_hit',
            duration: 'until_end_of_current_turn',
            hasAutomation: true
        }
    },
    {
        handler: 'soul_of_vengeance',
        expected: {
            type: 'soul_of_vengeance',
            name: 'Test Feature',
            trigger: 'after_vow_of_enmity_target_attacks',
            hasAutomation: true
        }
    },
    {
        handler: 'hunter_prey',
        expected: {
            type: 'hunter_prey',
            name: 'Test Feature',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'defensive_tactics',
        expected: {
            type: 'defensive_tactics',
            name: 'Test Feature',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'superior_hunter_prey',
        expected: {
            type: 'superior_hunter_prey',
            name: 'Test Feature',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'superior_hunter_defense',
        expected: {
            type: 'superior_hunter_defense',
            name: 'Test Feature',
            casting_time: '1 reaction',
            hasAutomation: true
        }
    },
    {
        handler: 'bonus_action_choice',
        expected: {
            type: 'bonus_action_choice',
            name: 'Test Feature',
            options: [],
            action: 'bonus_action',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'steady_aim',
        expected: {
            type: 'steady_aim',
            name: 'Test Feature',
            duration: 'until_end_of_turn',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'mage_hand_control',
        expected: {
            type: 'mage_hand_control',
            name: 'Test Feature',
            range: '30_ft',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            hasAutomation: true
        }
    },
    {
        handler: 'stroke_of_luck',
        expected: {
            type: 'stroke_of_luck',
            name: 'Test Feature',
            target: 'd20',
            recharge: 'short_or_long_rest',
            hasAutomation: true
        }
    },
    {
        handler: 'bewitching_magic',
        expected: {
            type: 'bewitching_magic',
            name: 'Test Feature',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'memorize_spell',
        expected: {
            type: 'memorize_spell',
            name: 'Test Feature',
            casting_time: 'passive',
            hasAutomation: true
        }
    },
    {
        handler: 'shadow_arts',
        expected: {
            type: 'shadow_arts',
            name: 'Test Feature',
            effect: 'shadow_arts',
            casting_time: 'passive',
            hasAutomation: true,
            freeCastSpells: [],
            usesMax: 1,
            recharge: 'long_rest',
            saveAbility: 'WIS'
        }
    },
    {
        handler: 'illusory_reality',
        expected: {
            type: 'illusory_reality',
            name: 'Test Feature',
            effect: 'illusory_reality',
            casting_time: '1 bonus action',
            objectDuration: '1 minute',
            hasAutomation: true
        }
    },
    {
        handler: 'remove_curse',
        expected: {
            type: 'remove_curse',
            name: 'Test Feature',
            range: 'Touch',
            casting_time: '1 action',
            hasAutomation: true
        }
    },
    {
        handler: 'spare_the_dying',
        expected: {
            type: 'spare_the_dying',
            name: 'Test Feature',
            range: '15 feet',
            casting_time: 'action',
            hasAutomation: true
        }
    },
    {
        handler: 'protection_from_poison',
        expected: {
            type: 'protection_from_poison',
            name: 'Test Feature',
            range: 'Touch',
            duration: '1 hour',
            casting_time: '1 action',
            hasAutomation: true
        }
    }
]

describe('coreHandlers tranche 1 – custom feeds, exact envelope + poison type/name', () => {
    it.each(CUSTOM_CASES)('$handler reads every field, hardcodes type/name', ({ handler, automation, expected, stats, description }) => {
        const feature = description
            ? { ...makeFeature(automation, 'Real Name'), description }
            : makeFeature(automation, 'Real Name')
        expect(coreHandlers[handler](feature, stats || BASE_STATS)).toEqual(expected)
    })
})

describe('coreHandlers tranche 1 – empty automation, exact defaults envelope', () => {
    it.each(DEFAULTS_CASES)('$handler', ({ handler, expected }) => {
        expect(coreHandlers[handler](makeFeature({}), BASE_STATS)).toEqual(expected)
    })
})
