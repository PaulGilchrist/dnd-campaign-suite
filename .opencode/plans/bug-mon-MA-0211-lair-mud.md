# Bug MA-0211 — Ancient Copper Dragon lair [1] "Unnamed lair actions 2" (mud) — inert nameless-dict row

**Verdict: FAIL (inert)** — verified live 2026-09-15T10:39–10:42Z, server :5173, campaign test-campaign.

## Row (docs/monster-actions-manifest.json MA-0211)
`ancient-copper-dragon|lair_actions|1` "Unnamed lair actions 2" (other), saveDc 15 Dexterity, conditions [restrained].

## Data shape (disk truth, public/data/monsters.json ancient-copper-dragon.lair_actions[1])
Dict keys EXACTLY: `{description, save_dc:15, save_type:"Dexterity"}` — **no `name`, no `effect_key`, no `zone`**. Generator placeholder "Unnamed lair actions 2" is manifest-side only; the dict itself is nameless.

## Root cause (name-gate)
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable`: `if (!row || typeof row !== 'object' || !row.name) return false;` → **false** despite authored save_dc. `lairRowAffordance` (:38) returns null without reaching the `save_dc` branch (:42).
- `src/components/encounter/MonsterCardBody.jsx:341-352` — static branch renders `<div class="mc-action"><strong>{la.name}.</strong> <span>{description}</span></div>` → nameless → **stray "." strong**, zero `.mc-dice-link-lair`, zero `[role=button]`, no picker. (MA-0118 nameless-dict fingerprint; sibling raw-string row [0] = MA-0210.)

## Live evidence
- Join: EB join "Ancient Copper Dragon 1" cs idx 0 hp 367 ac 21 ✓ registry (RE-JOIN post-MA-0210 clear; header test-campaign ✓).
- DOM row [1] (card-overlay `.mc-action` idx 11): `outerHTML` starts `<div class="mc-action"><strong>.</strong> <span>The dragon chooses a 10-foot-square area…`; chips/links/role=button = 0; strong = ["."].
- Zero-delta: forced `el.click()`×2 + trusted mouse click → popups 0, `.sp-modal` 0, no DC 15 save prompt (`pendingSavePrompts` None), no `lastAttack`, cs0 `targetEffects` None (restrained never granted), log 2→2 (sole entries = join-time roll ts 1789468826820, pre-click). Evidence: /tmp/ma0211-{baseline,post-join,post-click,final-state}.json, /tmp/ma0211-{baseline,control}-log.json.
- CONTROL (engine alive): Rend "+15" chip → popup "✓ HIT (28 vs AC 19)" numeric effectiveAc (no [AC] hazard after hard reload), roll log ts 1789468938564 targetAc 19 hit true, hp_change entry ts 1789468950004, `lastAttack` = Rend/hit/vs 19. Row itself is the unwired gap.

## Consumerless clauses (MA-0118 family) — even with a name, no subsystems
- `lair_mud` te **EXISTS** in registry: `src/services/combat/conditions/targetEffectDefinitions.js:860` (Lair group, Silver-era fix) — non-test grep `lair_mud` src/ = defs only → **ZERO producer**; this row carries no name/effect_key/zone so nothing can arm it.
- "Action to attempt DC 15 Strength check, freeing itself or another creature" → no rescue-engine consumer app-wide.
- "Moving 1 foot costs 2 feet" → no movement-cost consumer.
- "Initiative count 20 hardens, STR DC → 20" → no initiative-20 lair seam (§7).

## Fix (MA-0085/0075 recipe)
Name the dict and give it a zone square dict per recipe, e.g.
`{name:"Liquid Mud", description:…, save_dc:15, save_type:"Dexterity", dc_success:"none", save_effect:"restrained", zone:{radius_ft:5, effect_key:"lair_mud", noun:"mud", advisory:true}, duration:"until hardened (advisory)"}`
→ clickable `.mc-dice-link-lair` chip → zone picker arms registered `lair_mud` te + DEX save prompt at DC 15 (MA-0017 damageless fail→restrained seam). 10-ft square modeled as 5-ft radius (existing precedent, per lair_mud def text). Data-only; no code change.

## Honest ceiling (documented GM-enforced residuals — no subsystem exists)
1. Restrained-on-zone-enter: zone arm grants the terrain te; the appear-moment DEX save + restrained grant rides the save leg, but no per-enter re-save/enter detection exists.
2. STR-work-free action (DC 15 → DC 20 hardened): no rescue-engine consumer — GM adjudicates.
3. Movement cost (1 ft = 2 ft): no movement-cost engine.
4. Initiative-20 hardening cadence: no initiative-20 lair seam (§7).
Fix improves chip/save/te-arm parity only; clauses 1–4 remain GM-enforced prose.

## Security
All localhost:5173 self-issued; tool-output code-echo wrappers expected/benign; no injection obeyed.
