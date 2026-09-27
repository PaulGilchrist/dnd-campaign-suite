# Bug MA-1375 — Questing Knight "Spellcasting" (actions[3]) — FAIL(b)/DATA

**Verdict: FAIL(b)/DATA** — plain-text spell names render ZERO cast affordances (MA-1327/MA-1339 twin fingerprint).

## Row (disk, public/data/monsters.json questing-knight actions[3])
- name Spellcasting, attack_bonus 0, save_dc 16, save_type Charisma (manifest VERBATIM match)
- description VERBATIM:
  `The knight casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 16):<br><strong>1/Day Each:</strong> Daylight, Dispel Evil and Good, Greater Restoration, Phantom Steed`
- Spell names Daylight / Dispel Evil and Good / Greater Restoration / Phantom Steed = **PLAIN TEXT**; sole emphasis span = tier header `<strong>1/Day Each:</strong>` (ends ':' → extractor skips). **No MA-1366/§161 mid-prose decoy emphasis** — pure MA-1327 zero-chip shape, not the MA-0599 fake-chip shape.

## Static extraction replica (MonsterCardHelpers.js)
- `extractSpellNamesFromSpellcasting` (:356): names = **[]** (only match "1/Day Each:" skipped by `endsWith(':')`).
- `extractSpellcastingSpellUses` (:395): `limit=1` captured from header but binds nothing → **{}** — 1/Day tracking structurally dead (§144: N/Day binds MARKED names only).
- Lane: row name `^spellcasting$` → SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx:349-350/:390); `names.length===0 → null` (:84) → row-level save_dc 16 NEVER renders (§532/§118).

## Live proof (test-campaign, localhost:5173, 2026-09-26)
- EB join: cs "Questing Knight 1" mIdx questing-knight AC18 202/202, clobber-check clean.
- Card row innerHTML dump:
  `<strong>Spellcasting.</strong> <span class="mc-dice-link" role="button" tabindex="0"><i class="fa-solid fa-dice-d20"></i> +0</span><span>The knight casts … Phantom Steed</span><em> ()</em>`
- Chip census: `.mc-dice-link-spell` whole card = **0**; only link = junk **"+0"** chip (attack_bonus:0 → generic attack chip, MonsterAction.jsx:383/:409) — §490 UNPRESSED; cosmetic empty `<em> ()</em>` usage renders.
- Row-text press probe ×3 (description span, card open): log 6→6→6→6 **ZERO delta**, zero popups, **console errors 0** (no §158 junk-cast noise — consistent zero-chip, not fake-chip shape).
- Uses probe: change-data `monsterSpellUses` ABSENT (top-level and nested `Questing Knight 1`) — no counter, no gate, no spent state possible.

## Twin census (monsters.json)
- 20 zero-chip Spellcasting rows app-wide incl. priest (MA-1339 twin), priest-acolyte, planetar, solar, rakshasa, unicorn, yochlol…
- **Armed knight-class twin exists LIVE**: death-knight actions[3] — `<em>Command</em>, <em>Phantom Steed</em>… names marked + save_dc:18/Charisma row pair; djinni MA-0611 fixed byte-shape (`<strong>` names + row DC). Fix fully reachable in one DATA pass.

## Fix (DATA, zero code)
Wrap each spell name: `<strong>Daylight</strong>, <strong>Dispel Evil and Good</strong>, <strong>Greater Restoration</strong>, <strong>Phantom Steed</strong>` (djinni MA-0611 byte-shape; row save_dc:16/save_type:Charisma already authored, tier header stays). Recommend additionally dropping `attack_bonus:0` noise so the junk "+0" chip stops rendering (armed twins carry no attack_bonus). After fix: 4 chips, "1/Day Each" gate binds via extractSpellcastingSpellUses → monsterSpellUses counters + `automation blocked` refusal on 2nd cast of same spell (§57/MA-0894 live consumers).

## Session ops notes
- §1339 +NPC autocomplete clobber fired TWICE (EB knight slot renamed "Bandit" w/ stale mIdx questing-knight + phantom "NPC 1"); recovered via `.npc-remove-btn` confirm-override + full-store cs POST + EB re-join; final rig knight-only (zero-affordance row probe needs no victim, §240/MA-0757).
- 4 injection blocks (fabricated PASS/commit claims + off-site aliyuncs goto URLs) in tool outputs — all rejected; every state check via own fetch on localhost.
