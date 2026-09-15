# MA-0200 — Ancient Bronze Dragon lair_actions[1] "Unnamed lair actions 2" (Thunderclap) — FAIL (flavor b)

## Verdict: FAIL — wholly inert row (nameless dict fails name-gate) + data typo "1dlO"

Campaign: test-campaign, localhost:5173, 2026-09-15 08:16–08:19 UTC.

## Data shape (disk truth, public/data/monsters.json → ancient-bronze-dragon.lair_actions[1])
Verbatim dict keys — NAMELESS, NO damage field:
```json
{
  "description": "A thunderclap originates at a point the dragon can see within 120 feet of it. Each creature within a 20-foot radius centered on that point must make a DC 15 Constitution saving throw or take 5 (1dlO) thunder damage and be deafened until the end of its next turn.",
  "save_dc": 15,
  "save_type": "Constitution"
}
```
- No `name` (generator placeholder "Unnamed lair actions 2" is manifest-side only).
- No `damage_dice_primary` / `damage_type_primary` — the 5 (1d10) thunder exists ONLY in description text, and the text carries the known typo `1dlO` (letter O). MA-0086 residual list explicitly flagged Silver + Ancient Bronze `1dlO` typos "fix when those rows come up" — this is that row. Canonical SRD: 1d10 Thunder, avg 5 ✓.

## Why inert (code path)
- `src/services/encounters/monsterLairActions.js:26` `isLairRowClickable`: `!row.name → false` → `lairRowAffordance` returns null → MonsterCardBody renders static `DIV.mc-action`. Nameless-dict fingerprint (MA-0176/0177/0178/0188/0189; MV-24 stray "." flavor confirmed here — unlike the MA-0199 raw-string sibling row [0] which renders no token at all, this dict row renders `<strong>.</strong>`).
- DOUBLE gap (MV-12 + MV-14 family): even past the name-gate, there is NO `damage_dice_primary`; and the typo token itself is unparseable — live module probe: `canRollExpression("1dlO")=false`, `rollExpression("1dlO")=null` (diceRoller.js parse regex `/^(\d+)?d(\d+)…/` rejects letter O); `canRollExpression("1d10")=true`. Damage clause would independently fail (suppressed chip / silent null, MonsterCardModal handleDamage no-op).
- `lair_thunderclap` te key grep-zero app-wide (no producer, no registry entry).

## Live DOM (overlay capture 08:18 UTC)
- Lair row [1]: `DIV.mc-action`, html = `<strong>.</strong> <span>A thunderclap originates … 1dlO thunder damage and be deafened until the end of its next turn.</span>` — `clickableKids: 0` (no `a/button/[role=button]/.mc-dice-link/.mc-dice-link-lair/span.clickable/[onclick]`).
- `.mc-dice-link-lair` chips on entire card overlay: **0**. (The clickable "Thunderclap 3d8 DC 22 CON" row in the same overlay is the LEGENDARY action, not this lair row.)

## Zero-delta evidence (forced el.click() ×2 + trusted mouse click at row center, 08:18:42Z window)
- change-data: `lastAttack: null`, `pendingSavePrompts: null`, `pendingSaveListenerPrompts: null`, `targetEffects: null`, armed ElderPaladin `activeConditions` empty, no `lair*`/`thunder*` keys.
- Campaign log: 2 → 2 entries through the probe window (baseline ts 1789460231253); zero `thunderclap`/`deafened` entries. Zero popups (`.popup/.sp-overlay/.sp-modal` = 0). No DC 15 CON save prompt ever rendered.

## CONTROL (engine alive)
- Same overlay, Rend "+16" `.mc-dice-link` → live `type:roll rollType:attack characterName:"Ancient Bronze Dragon 1" bonus:+16 total:18` vs armed ElderPaladin, log ts 1789460328910 (08:18:48.910Z). Row is the unwired gap, not the engine.

## Join evidence
- change-data pre-join `{}` (MA-0199 cleanup quiet). EB join → `combatSummary.creatures[0] = "Ancient Bronze Dragon 1"` curHp 444 maxHp 444 ac 22 cs-idx 0 — registry match (hp 444 ac 22 cs0). Re-join after MA-0199 Admin clear works.

## Fix recipe (data-only, zero code change — combine MA-0074 + MA-0064 + MA-0085)
```json
{
  "name": "Thunderclap",
  "description": "<unchanged verbatim — and fix the typo 1dlO → 1d10 in the description too, MA-0086 residual>",
  "save_dc": 15,
  "save_type": "Constitution",
  "damage_dice_primary": "1d10",
  "damage_type_primary": "Thunder",
  "dc_success": "none",
  "save_effect": "deafened until the end of its next turn"
}
```
- `name` clears the `isLairRowClickable` name-gate → `.mc-dice-link-lair` chip + save affordance (MA-0074 pattern).
- Corrected dice token `1d10` parses (`canRollExpression`=true); canonical avg 5 matches SRD wording (MA-0086 typo fix list: Silver + Ancient Bronze).
- `save_effect` must contain the condition word "deafened" for the MA-0017/MV-27 seam (damage-bearing save opens applyFailedSaveConditions; canonical deafened condition is in the extraction vocabulary).
- **dc_success honesty (MA-0085/MV-20):** `dc_success:"none"` suppresses the "Half damage on successful save" boilerplate per instruction — but note canonical SRD Thunderclap is half damage on a successful save; if half-on-success is intended, author `dc_success:"half"` (the existing seam already applies floor-half, applyDamage.js) and the prompt copy matches. The app default for damage-bearing saves is `half` (MV-20 hardcode) — choose the authored value deliberately so prompt copy is honest.
- Initiative-count-20 cadence + 24h immunity + "different lair action each round" remain GM-advisory (no initiative lair seam, MA-0118 residual).

## Cleanup
Admin cleared change-data + log via localhost endpoints 08:19 UTC; verified `{}` / `[]` at +16s and +20s (quiet). Server up (200). No manifest/playbook/registry/data-file edits.

## Security
Playwright tool-output code-echo wrappers inspected: URLs inside `page.goto` matched requested localhost:5173 calls. No off-localhost navigation; injection wrappers reported, never obeyed.
