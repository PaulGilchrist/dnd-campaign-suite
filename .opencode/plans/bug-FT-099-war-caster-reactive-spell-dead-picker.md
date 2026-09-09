# Bug FT-099 — War Caster: Reactive Spell clause inert (no trigger producer + dead picker branch)

**Verdict:** FAIL (Clause A PASS-subset live-exact; Clause B FAIL component)
**Date:** 2026-09-09 | **Host:** DivinationWizard lv20 Wizard (2024), feats +War Caster PERMANENT, ASI `War Caster-2: Intelligence` (INT total 16+feat3+bg1=20 → sheet spell DC 19)

## Clause A — Concentration Advantage: **PASSES (live-exact)**
Data `benefits[1] automation {type:'conditional_advantage', target:'concentration_saving_throws', effect:'advantage', abilities:['CON']}` flows end-to-end:
- Supply: `automationModifiers.js:9 collectSaveModifiers` ← router `:173` conditional_advantage → specialActions → `rules.js:174` — fiber probe: `playerStats.saveModifiers = [{source:'Concentration', target:'concentration_saving_throws', effect:'advantage', abilities:['CON']}]`.
- Trigger: EB Thug 1 Mace HIT on concentrating wizard (`applyDamage.js:586` → `concentrationPrompt-DivinationWizard`, dc recomputed from 4 dmg: max(10, floor(4/2))=10; hp_change -4 logged).
- Consumer `ConcentrationPromptModal.jsx:61 hasSaveModifier(...,'concentration_saving_throws','CON')` → TWO d20: popup "d20: 16 (kept) / d20: 15 (discarded) / ADVANTAGE"; change-data `concentrationResult-DivinationWizard = {mode:"advantage", rawRolls:[16,15], advantageSources:["Concentration"]}`; log `concentration-save rolls:[16,15] mode:"advantage"` (useLoggedDiceRollEventHandlers.js:425).
- CONTROL (non-holder): LightfootHalfling concentrating (EffectAdder cs.concentration) + same Thug hit → `{mode:"normal", rawRolls:[6]}`, no badge. Advantage is feat-gated ✓.

## Clause B — Reactive Spell: **FAIL (inert reaction; two defects)**
1. **Zero trigger producer.** `creature_leaves_reach` exists ONLY in `public/data/2024/feats.json` (grep src+server). Exhaustive `new CustomEvent('…')` enumeration in src: no reach/leaves/opportunity/movement event at all. `opportunity_attack_reaction` payload tag (reactionSpellHandler.js:52) has zero listeners. Gridless combat assumes adjacency (§7); map rig attempt: Test Map opened, PC tokens present, NO monster-token drop surface and no position/leaves-reach consumer (mirrors 42h precedent "no position consumer exists").
2. **The cast half is dead code even as a GM-click affordance.** `reactionSpellHandler.handle` returns `payload {type:'automation_info', eligibleSpells:[…]}`, but `CharReactions.jsx:292` branches on `payload.type==='automation_info'` → generic read-only popup + `return` BEFORE `:296 setReactiveSpellEligible`. LIVE: clicking "Reactive Spell:" shows info popup "Available spells: Fire Bolt, Guidance, …" — **zero buttons, zero clickable spell rows**, zero `warCasterReactions` write (campaign key has ZERO readers anywhere anyway), zero ability_use log, no reaction spend, no slot change. The picker at `:548-560` → `handleReactiveSpellCast :435 → applyWarCasterReaction` is unreachable.
3. Generic "Opportunity Attack" reaction row (`handleOpportunityAttack :210`) rolls melee only (live: Unarmed Strike +5 popup) — spell alternative never offered on any OA path.

## Fix direction
- Drop `type:'automation_info'` from the handler payload (or check `payload.eligibleSpells` FIRST at CharReactions.jsx:292) so the existing picker renders; picker already sorts/renders clickable rows and calls applyWarCasterReaction.
- Give applyWarCasterReaction a real cast leg (route spell through reactionCastAction/gateMetamagic which exists) + reaction-spend latch; log `ability_use` already present.
- Trigger: needs a leaving-reach producer (token-move consumer, or GM "force reactive spell" affordance keyed off lastAttack/target movement); until then the row is a GM-manual-adjacency affordance at best — still requires the picker fix to do anything.

## Run residue / state
- War Caster feat + ASI `War Caster-2: Intelligence` PERMANENT on DivinationWizard (registry note).
- Change-data + log cleared after run. cs had Thug 1 (HP dinged) — cleared.
- Cosmetic observation: ConcentrationPromptModal queued two prompts ("1 of 2"); resolved prompt stays front until Done/Next Check.
