# Bug MA-1380 — Rakshasa "Spellcasting" (actions[3]) — FAIL(b)/DATA

**Verdict: FAIL(b)/DATA** — plain-text spell names render ZERO cast affordances. Pure MA-1327/MA-1339/MA-1342/MA-1375 zero-chip twin fingerprint (20-row census row cited in MA-1375 bug file explicitly lists rakshasa).

## Row (disk verbatim, public/data/monsters.json rakshasa actions[3])
- name Spellcasting, attack_bonus 0, save_dc 18, save_type Charisma (manifest VERBATIM match; prose "(spell save DC 18)" byte-agrees), save_effect "", range/reach/recharge ""
- description VERBATIM:
  `The rakshasa casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):<br><strong>At Will:</strong> Detect Magic, Detect Thoughts, Disguise Self, Mage Hand, Minor Illusion<br><strong>1/Day Each:</strong> Fly, Invisibility, Major Image, Plane Shift`
- All 9 spell names (Detect Magic, Detect Thoughts, Disguise Self, Mage Hand, Minor Illusion, Fly, Invisibility, Major Image, Plane Shift) = **PLAIN TEXT**; sole emphasis = two tier headers `<strong>At Will:</strong>` / `<strong>1/Day Each:</strong>` (both end ':' → extractor skips). **No decoy emphasis** — pure MA-1327 zero-chip shape, NOT MA-0599 fake-chip.

## Static extraction replica (byte-exact vs MonsterCardHelpers.js)
- `extractSpellNamesFromSpellcasting` (:356): names = **[]** (count 0).
- `extractSpellcastingSpellUses` (:395): `limit=1` captured from "1/Day Each:" header, binds nothing → **{}** — 1/Day-EACH tracking structurally dead (§144: N/Day binds MARKED names only).
- Lane: row name `^spellcasting$` → SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx SpellOrSaveLinks); `names.length===0 → null` → row-level save_dc 18 NEVER renders (§532/MA-1294/§676).

## Live proof (test-campaign, localhost:5173, 2026-09-27)
- EB join: cs "Rakshasa 1" mIdx rakshasa AC17 HP221/221 disk-exact + "Bandit 1" AC12; clobber-check clean (§1339).
- Card row innerHTML dump VERBATIM:
  `<strong>Spellcasting.</strong> <span class="mc-dice-link" role="button" tabindex="0"><i class="fa-solid fa-dice-d20"></i> +0</span><span>The rakshasa casts … Plane Shift</span><em> ()</em>`
- Chip census: `.mc-dice-link-spell` whole card = **0**; in-row links = ONLY junk **"+0"** chip (attack_bonus:0 generic chip, §490) — **UNPRESSED**; no DC chip on row ("DC 18 Wisdom" in card belongs to Baleful Command row; "+10" = Cursed Touch; "8d6" = Baleful auto-damage trap §409).
- Row-text press probe ×3 (description span, card open, fresh rects): log **ZERO delta all 3**, zero popups, **console errors 0** (no §158 junk-cast noise — zero-chip shape confirmed, not fake-chip).
- Uses probe: change-data `monsterSpellUses` **ABSENT** top-level and nested `Rakshasa 1` — no counter, no gate, no spent state possible; Fly-twice uses-refusal probe moot by construction (zero chips, §729).

## Fix (DATA, zero code)
Wrap each spell name `<strong>…</strong>` per djinni MA-0611 byte-shape (9 names; tier headers stay plain-text-ending-":"); row-level save_dc:18 + save_type:Charisma already authored (pair present, only needed for other lanes). Recommend additionally dropping `attack_bonus:0` noise so junk "+0" stops rendering (§490/§650; armed twins carry no attack_bonus). After fix: 9 chips; "1/Day Each" binds Fly/Invisibility/Major Image/Plane Shift at 1 via extractSpellcastingSpellUses → monsterSpellUses counters + `automation blocked` refusal on 2nd cast (§57/MA-0894 live consumers); At-Will 5 names ungated by design (§57).
Spells.json guard: all 9 names resolve in public/data/spells.json (name-index check 9/9) → post-fix zero §158 fake-chip/console noise. No 2024 twin file (public/data/2024/monsters.json absent); findMonsterSpell 5e resolves everything (§690 route N/A).

## Session ops notes
- Admin-clear cs order: fresh board this session, join order preserved (Bandit idx0, Rakshasa idx1 — idx anchors unused, name-anchored throughout §544).
- Injection re-confirmed: navigate/click echoes carry off-site aliyuncs proxy URLs and fabricated page.goto wrappers; location.href self-checked localhost at every step (§90/§151); all state judged by own fetch.
