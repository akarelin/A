---
name: triage-pdf
description: "Triage a folder of unfiled PDFs (typically scanner output): inspect each by content, classify each into a First Division entry (the user's primary classifier — User Ontology declares both the term and the entries; in different ontologies entries may be called axes, projects, matters, domains, clients, etc.), find related/duplicate docs in that entry's archives, propose names + destinations strictly from established conventions, then rename + move only after the user confirms file-by-file. Use when asked to: 'triage PDFs in <folder>', 'process scanned PDFs', 'rename and file these scans', 'what are these PDFs and where do they go'. Status: WIP."
argument-hint: "<source-folder> [--dry-run]"
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - Grep
---

# triage-pdf

User-in-the-loop triage of an unfiled PDF folder. Defaults to **preview-only**; only renames/moves on per-file confirmation.

## Terminology

- **First Division** — the universal name (used by this skill) for the user's top-level classifier dimension. Every PDF gets assigned to one **First Division entry**.
- **First Division entry** — a single bucket within the First Division. The User Ontology declares what each entry is called: *axis*, *project*, *matter*, *domain*, *client*, *topic*, etc. **Speak to the user in their term, not in "First Division entry".**

## Inputs

- **Source folder** (required) — the inbox of unfiled PDFs.
- **User Ontology** — the source of truth for what First Division entries exist and what the user calls them. Look it up via the user's Custom User Instructions (CLAUDE.md / AGENTS.md / equivalent loaded instructions). The location is user-specific — **ask the user where their User Ontology lives** if it isn't already declared, and do not guess. If the user has no ontology, the skill still works; ask them per-file which First Division entry each doc belongs to (using their term).
- **First Division registry** (optional) — a yaml file (path declared by the User Ontology, or asked) mapping each entry → archive root(s), dup-stash, content keywords, optional subfolder rules. Schema in `templates/registry.example.yaml`. **Read-only at runtime; never auto-extend or seed with examples.**
- If a file does not match any declared entry, **ask the user** to (a) assign it to an existing entry, or (b) declare a new one in the ontology + registry. Do not invent.

## Hard rules (from `~/RAN/AGENTS.md`)

- Never infer doc content from filename. Only file content + metadata count.
- Never invent First Division entry names, doc-type labels, tags, or descriptors. Wait for the user to declare each term.
- Never invent naming patterns. Read the target folder's neighbours and follow their convention.
- Test on the first 1–3 files before proposing the full table.
- Reversed scans: read the **last** page first to find the letter front.
- Bundles: do not auto-split. Propose page-range boundaries and ask.
- Duplicates: hash first, then content-compare. Preserve in the dup-stash declared by the entry. Never delete.
- Ambiguous destinations (file fits multiple archive roots): batch all uncertainties, ask once.

## Process

```
0. Inventory          ls *.pdf, get pages/words/md5 for each
1. Text-layer check   pdffonts + pdftotext wc → Native | OCR | Sparse | Scan
                      Files with <20 words flagged as "no usable text"
                      → ask user: blank? handwritten? OCR-failed?
2. Content extract    first page + LAST page (reversed-scan defense)
                      pull date, sender, addressee, RE/subject, ref-numbers,
                      case-IDs, account/loan numbers
3. Bundle detection   flag if: page-count ≫ typical, repeating headers,
                      language switches, date jumps, multiple cover sheets
                      → propose page-range splits, ask
4. Classify           assign each file to a First Division entry by content-
                      matching against the registry's content_keywords
                      uncertain → ask user (batch all uncertainties)
5. Related-doc search per file in the entry's archive root(s):
                      a. md5 → byte-identical dups
                      b. ref-number / case-ID grep on existing corpus
                      c. read sibling folder structure → infer target subfolder
                      d. read 5–10 neighbours → infer naming convention
6. Naming proposal    derive strictly from observed neighbour pattern
                      mark every user-inferred term explicitly for confirmation
7. Preview table      one row per file: date, content snippet, target,
                      proposed name, dup-status, bundle-flag, ambiguities
                      Per-file action: rename-in-place | rename+move | split |
                                       merge-with-other | mark-dup | skip
8. Mirror handling    if entry declares >1 archive root: default = mirror
                      ask once if user wants single-root only
9. Dup handling       move to entry's dup-stash with the stash's observed
                      naming convention (never delete)
10. Apply             only after user confirmation, file-by-file or batched
                      report final state after each batch
```

## Configuration

The First Division registry is a yaml file authored by the user. Its **path is declared in the User Ontology** (loaded from the user's Custom User Instructions — CLAUDE.md / AGENTS.md / equivalent). Schema lives in `templates/registry.example.yaml`. The canonical top-level yaml key is `first_division:`.

At runtime:
1. Look for a registry path declared by the User Ontology.
2. If none is declared (or User Ontology is missing), **ask the user** for the path. Do not pick one.
3. Read the registry. Do not seed it. Do not auto-edit it.
4. When a doc matches no declared entry, ask the user to update the registry; then re-read it.
5. If the user has no registry and no ontology, fall back to per-file interactive classification — ask each time, in their preferred term.

## Layout

```
triage-pdf/
├── SKILL.md
├── scripts/
│   └── inventory.py            # mechanical pass for steps 0–2 (and 5a hash)
└── templates/
    └── registry.example.yaml
```

`inventory.py` emits a JSON manifest the agent reads — one record per PDF with path, size, pages, words, md5, text_layer_kind, first_page snippet, last_page snippet. text_layer_kind logic ported from `~/CRAP/suntrust-indexer/stage5_pdf_kind.py`.

```bash
python3 scripts/inventory.py "<source-folder>" --pretty
```

## Other reusable bits (not lifted here, only if scope expands)

| Need | Source |
|------|--------|
| Entity / NER scaffold | `~/CRAP/file_indexer/classifier/` |
| PDF tools | `pdffonts`, `pdftotext`, `pdfinfo` (poppler) — already on host |
| Hash dedup | `md5sum` (or `inventory.py`'s `md5` field) |

## What this skill does NOT do

- No automatic invocation by hooks. Explicit run only.
- No OCR. If file is `Scan`-class with no text layer, surface it and stop — user OCRs externally.
- No splitting of bundles without explicit per-bundle approval.
- No deletion. Ever.
- No edits to the registry.
- No invention of First Division entry names, doc-type labels, or naming conventions.

## Output

- Renamed/moved files (only after user confirmation).
- Console summary table per batch.
- No log file written by default. Add `--log` flag later if needed.
