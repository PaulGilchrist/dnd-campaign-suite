# Bug MA-0105 — Adult Gold Dragon "Guiding Light": inert legendary row (zero affordance, zero consumer, no roll/log); underlying Spellcasting Guiding Bolt DOES resolve lv2 correctly (5d6/+13) — proving the legendary row itself is the unwired gap

**Verdict: FAIL** (Guiding Light legendary row is inert — cannot resolve any Guiding Bolt; the once-per-turn clause is unenforceable. Distinct from Copper MA-0094: here the underlying Spellcasting attack-spell math IS correct at lv2, so the ONLY gap is the delegated legendary row having no affordance/consumer.)

## Row
- MA-0105 · Adult Gold Dragon (`adult-gold-dragon`) · `legendary_actions[2]` · category: legendary_actions · actionType: other.
- `public/data/monsters.json` `adult-gold-dragon.legendary_actions[2]`: `{name:"Guiding Light", description:"The dragon uses Spellcasting to cast <em>Guiding Bolt</em> (level 2 version)."}`. **No `delegates_to`, no `attack_bonus`, no `save_dc`, no `spell`, no `uses`, no `advisory`.** Same shape as Copper Mind Jolt (MA-0094) / Bronze Guiding Light (MA-0082).
- `spells.json` (both paths) Guiding Bolt: level 1, `dc:null` (attack spell, no save), `damage.damage_at_slot_level {1:"4d6", 2:"5d6", …}`, damage_type Radiant. Spellcasting row authors "spell save DC 21, **+13 to hit** with spell attacks" + "Guiding Bolt (level 2 version)" ⇒ expected lv2 = **5d6 Radiant, +13 spell attack**. Numbers confirmed.

## Live probe (test-campaign, :5173, 2026-09-14)
Setup: header test-campaign ✓. EB Join → cs `Adult Gold Dragon 1` (npc, init 20, hp 243/243, ac 19, cs idx 0). Armed target on the dragon initiative card `[data-testid="target-select"]` via Playwright `selectOption` → cs `creatures[0].targetName = "DivinationWizard"` (verified via change-data). Dragon card opened (`img.avatar-image.click()` → `.mc-overlay`, count 1).

### FAIL 1 — Guiding Light legendary row is INERT (cannot be triggered)
- Row DOM (`DIV.mc-action`): innerText `Guiding Light. The dragon uses Spellcasting to cast Guiding Bolt (level 2 version).`, innerHTML 122 B. **Zero clickable children** — `a / button / [role=button] / .mc-dice-link / .mc-dice-link-spell / .mc-dice-link-legendary / span[onclick] / .clickable` all 0; pointer-cursor descendants **0**; no "Expend Legendary" span (`expendLegendaryText:false`).
- No legendary economy on this dragon (MA-0092 fingerprint): `.mc-legendary-counter` and `.mc-legendary-header-row` both **absent** in the overlay.
- Forced clicks (row `<div>` + inner `<strong>` + all `<span>`/`<em>`): **log 2 → 2** (zero new entries), change-data **byte-identical (11455 → 11455 B)**, `lastAttack` null, `pendingSavePrompts`/`pendingAttackPrompts` null, zero overlays beyond the card. The action cannot fire.
- grep `guiding light` / `guiding_light` / `guidingLight` across `src/` + `server/` → **zero** matches. Inert by construction.

### Root cause (static, confirmed)
- `MonsterCardBody.jsx:38` `legendaryHeader = legendaryHeaderAction(monster)`. `monsterLegendaryUses.js legendaryHeaderAction` returns `rows[0]` **only if `rows[0].uses != null`**. Adult Gold `legendary_actions[0]` = `{name:"Legendary Action Uses: 3 (4 in Lair)", description:…}` — **no numeric `uses` key** ⇒ returns `null`.
- ⇒ `MonsterCardBody.jsx:54` `s.key==='legendary_actions' && legendaryHeader` is FALSE ⇒ the section renders via the generic else branch (:57) **without `legendaryGate`**.
- ⇒ In `MonsterAction.jsx`, `legendaryGate` is undefined ⇒ `LegendarySpendLink` returns `null` at :149 ⇒ no "Expend Legendary" affordance ever renders. Guiding Light's `{name, description}` also carries no `attack_bonus`/`save_dc`/rollable formula (:151 numeric affordance false) and its name ≠ Spellcasting (:170) ⇒ `SpellCastLinks` never runs ⇒ the Guiding Bolt reference in the description is plain sanitized text (:189), never a clickable spell link.
- Even if the header had `uses`, Guiding Light would only get a generic advisory "Expend Legendary" span (:155) → `expendLegendaryUse`, which just spends + logs — it has **no delegated spell-cast mechanic** (`delegates_to` absent), so it still would not resolve Guiding Bolt. No consumer exists to route "Guiding Light" → a Guiding Bolt lv2 cast.

### FAIL 2 — once-per-turn clause unenforceable
Row text has no explicit "can't take this action again until the start of its next turn" clause (unlike Copper Mind Jolt), but the legendary-economy latch is moot regardless: no header `uses` ⇒ no gate, no latch, no `legendary_use_refused` producer, no spend. Nothing to enforce or refuse.

## Contrast with Copper MA-0094 — underlying spell here IS correct (engine alive)
Proving the engine resolves Guiding Bolt so the legendary row is the *only* gap: clicking the **Spellcasting** row's At-Will `mc-dice-link-spell` "Guiding Bolt" (target armed) fires a real spell-attack:
- `lastAttack`: `{attackerName:"Adult Gold Dragon 1", targetName:"DivinationWizard", attackName:"Guiding Bolt", bonus:13, damageFormula:"5d6", damageType:"Radiant", weaponType:"ranged", rollType:"attack", hit:true, targetAc:9, effectiveAc:9}`.
- `ability_use` log: "Adult Gold Dragon 1 casts Guiding Bolt via Spellcasting — **level 2** ranged spell attack **+13** vs DivinationWizard, formula **5d6**."
- `roll` log: attack, rolls `[5,9]` mode normal, total 5, bonus 13 (+13 to hit), Radiant, hit vs AC 9.
⇒ lv2 upcast (5d6, not base 4d6) and +13 both **correct** here. This differs from Copper MA-0094 where the underlying Mind Spike (a SAVE-forcing spell) wrongly rolled BASE 3d8: Guiding Bolt is an **ATTACK** spell, so it routes through `resolveSpellAttackPlan` where `spellCastLevelFromSpellcasting` (MA-0033) **is** wired → resolves the "(level 2 version)" to 5d6. The Gold Spellcasting math is sound.
- Secondary (MA-0082-consistent): the `lastAttack` carries no `next_attack_advantage` targetEffect — Guiding Bolt's "next attack roll vs this target has advantage" rider is PC-scoped (`next_attack_advantage` consumers in attackPostProcessing.js / ConditionEffectBadges.jsx gate on `te.target===characterName`), so no monster-cast advantage te is applied. Not the core defect, but confirms no monster Spellcasting advantage producer.

## Verdict rationale (STRICT)
Guiding Light never resolves a level-2 Guiding Bolt: no clickable affordance, no roll, no damage, no advantage te, no spend, no log, byte-identical change-data on forced click, grep-zero consumers app-wide. FAIL — identical inert-fingerprint to MA-0082/MA-0094. The only silver lining unique to Gold: the *reachable* Spellcasting Guiding Bolt already rolls the correct lv2 numbers (5d6/+13), so the fix is purely to wire the legendary row, not the spell math.

## Fix shape
1. **Author numeric `uses` on the header** `legendary_actions[0]` (`uses: 3`, lair bump advisory) so `legendaryHeaderAction` returns the header ⇒ legendary counter renders + `legendaryGate=handleLegendaryRow` is passed ⇒ rows get gated expend + round/turn latch (MA-0021/MA-0092 fix shape).
2. **Give Guiding Light a delegating spell mechanic.** Either `delegates_to:"Spellcasting"` + a spell-cast selector, or extend the legendary-row handler to detect an embedded cast reference ("uses Spellcasting to cast <X> (level N version)") and route it through the **spell-attack branch** (`resolveSpellAttackPlan` + `spellCastLevelFromSpellcasting`), mirroring the working Spellcasting Guiding Bolt seam. Add a `guiding bolt`/`next_attack_advantage` producer for the monster-cast path so the advantage rider lands (MA-0082 gap). Without a consumer there is nothing to click and nothing to gate.

## Cleanup
- Only `test-campaign` touched. Closed card overlay (Escape). POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/api/campaigns/test-campaign/admin/clear-log` (Host localhost); re-verified change-data `{}` + log `[]` via GET. No manifest `verified` edits.
