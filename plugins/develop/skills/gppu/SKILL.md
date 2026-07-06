---
name: gppu
description: "Work with the gppu framework. Three modes: ASK (how to build / use gppu for what the user needs — widgets, config, logging, TUI patterns), DEBUG (troubleshoot a gppu-powered app that misbehaves — blank TUI, stuck worker, F12 silent, config/secret issues), PROPOSE (draft a change to gppu itself — new widget, new mixin, breaking refactor — with review checklist). Pick the mode that matches the user's intent; run one at a time."
id: gppu
---

# gppu — ask / debug / propose

One skill, three modes. The user's wording picks the mode:

| user says                                                                    | mode     |
|------------------------------------------------------------------------------|----------|
| "how do I…", "what's the right way to…", "can gppu do…", "show me an example"| **ask**     |
| "X doesn't work", "it's frozen", "why is…", "crashed", "nothing happens"     | **debug**   |
| "we should add…", "let's refactor…", "I want to change…", "propose…"         | **propose** |

When uncertain, ask once which mode applies, then proceed.

---

## Mode: ASK — "how to do what the user asked"

Goal: reach the right gppu surface quickly without rebuilding it.

### 0. Inventory — what gppu already has

```
~/gppu/gppu/
  __init__.py          # Env, TColor, Info/Warn/Error, secrets, deepget, pfy, slugify …
  logger.py            # init_logger, protocol_Logger
  mixin_Config.py      # mixin_Config base
  App.py               # _Base, _PGBase (adds PostgreSQL)
  tui/
    __init__.py        # curated re-exports — read this first
    launcher.py        # TUIApp, TUILauncher, AppScreen, SpinnerIndicator,
                       # ProcessRow, StatusHeader, InfoScreen
    progress.py        # TickProgress, MarkerProgress, Vendor, marker_*/legend_*
    workers.py         # WorkerPool, WorkerRow, WorkerState
    debug.py           # DebugSink, DebugScreen, DebugMixin, make_debug_sink
    icons.py           # STATE_GLYPHS, SPINNERS, glyph_rich/_ansi, spinner_frames
    viz/heatmap.py     # Heatmap widget, render_heatmap_lines
    selectors.py       # Selector, DetailedSelector, ui_select, ui_select_rows
    config_editor.py   # ConfigEditorApp
```

Always grep ``gppu/tui/__init__.py`` first — if the symbol is exported it
exists, and the subpackage holds the docstring with intended usage.

### 1. Common "how do I" → where to look

| task                                 | answer                                                    |
|--------------------------------------|-----------------------------------------------------------|
| load YAML config                     | ``Env.from_env(name=..., app_path=...)``; ``Env.glob_dict(section)``. No hot-reload. |
| log info/warn/error                  | ``init_logger(name)`` once; then ``Info()/Warn()/Error()``.|
| subclass app with config             | inherit ``gppu._Base`` (general) or ``_PGBase`` (PostgreSQL).|
| resolve secret                       | ``resolve_secret('KEY')`` — env → vault → config.         |
| build a TUI app                      | subclass ``gppu.tui.TUIApp``; override ``compose`` and ``cli()``. |
| show progress (generic)              | ``TickProgress(log)`` — dim dot per item, auto-batches.   |
| show progress (classified, colored)  | ``MarkerProgress(log, categories, unknown, classify)``.   |
| run N concurrent workers w/ live UI  | ``WorkerPool(workers=[...])`` + ``pool.mark(key, state, detail)``.|
| add debug logging                    | mix in ``DebugMixin``; set ``DEBUG_APP_NAME``. F12 + Shift+F12 wired free. |
| canonical state glyphs               | ``glyph_rich('ok' \| 'fail' \| 'running' \| …)``.           |
| activity heatmap                     | ``Heatmap(counts=<dict[date, int]>)`` or the pure-fn variant.|
| list picker modal                    | ``ui_select(items)`` / ``ui_select_rows(items)``.         |
| launcher for multiple sub-apps       | ``TUILauncher`` + ``launcher_main(app_dir=...)``.         |

### 2. Rules of engagement

1. **Reuse before build.** If a widget exists in gppu.tui, import it. Do not
   re-derive SpinnerIndicator, WorkerRow, DebugSink — all three burned
   somebody's time once already.
2. **Keep app-specific logic in the app.** E.g. preservator's LLM-vendor
   classifier stays in preservator; gppu exposes the generic
   ``MarkerProgress`` + ``Vendor`` tuple.
3. **Don't edit gppu for one app.** gppu is editable-installed everywhere;
   changes affect every consumer. If a widget needs a feature, ask whether
   it belongs in the widget (→ propose mode) or in the app.
4. **Use ``call_from_thread`` for widget updates from workers.** Textual
   silently drops off-thread updates. ``DebugSink.__call__`` is thread-safe
   (holds a lock); widget state mutation is not.

### 3. Canonical example — TUI with DebugMixin + WorkerPool

```python
from gppu.tui import TUIApp, DebugMixin, WorkerPool
from textual.binding import Binding

class MyApp(DebugMixin, TUIApp):
    DEBUG_APP_NAME = 'myapp'       # → ~/.cache/myapp/debug.log
    BINDINGS = [*DebugMixin.DEBUG_BINDINGS,
                Binding('q', 'quit', 'Quit')]

    def compose(self):
        self.pool = WorkerPool(workers=['alice', 'bob', 'carol'], id='pool')
        yield self.pool

    def on_mount(self):
        # Background work marks each worker as it advances.
        for w in ['alice', 'bob', 'carol']:
            self.pool.mark(w, 'running', 'dialing...')
        # From a worker thread:
        #   self.call_from_thread(self.pool.mark, w, 'ok', 'done (3 items)')
        #   self.call_from_thread(self.debug_log, f'{w}: {stderr}')
```

---

## Mode: DEBUG — "a gppu-based app misbehaves"

Invoke when anything built on gppu (TUI or CLI consumer of ``Env`` /
``_Base``) doesn't do what it should. Not for debugging the app's own
business logic — only the gppu plumbing around it.

### 0. Where to look first

```
tail -F ~/.cache/<app_name>/debug.log
```

If the file doesn't exist, the app has emitted zero warnings **or** it
didn't mix in ``DebugMixin``. Check both.

In the TUI:
- **F12** dumps the current buffer to file + toast with path (non-modal,
  log keeps scrolling).
- **Shift+F12** opens the modal ``DebugScreen``. Esc/q/F12 to close.
  Hides the main log while open — prefer the file tail for long watches.

### 1. Decision tree

**Won't start / "textual not found"**

```
python -c "import textual, gppu; print(textual.__version__, gppu.__file__)"
```
- ``ImportError: textual`` → ``pip install -e ~/gppu`` in the app's venv.
- ``ImportError: gppu`` → editable install missing / wrong venv.
- Partial stale: ``pip install -e ~/gppu --force-reinstall --no-deps``.
- Never install into system Python.

**TUI starts, screen blank / garbled**

```
echo "TERM=$TERM  COLORTERM=$COLORTERM  TEXTUAL_DRIVER=$TEXTUAL_DRIVER"
```
- Not a TTY → use ``--no-tui`` if supported. ``gppu.tui.launcher._tui_available()`` is the arbiter.
- Wrong color profile → ``export COLORTERM=truecolor``.
- SSH / multiplexer eating escapes → force a driver or disable alt-screen.

**Frozen / no output**

Don't kill yet — most silences are I/O on a subprocess. Order:

```
pgrep -af <app_name>
ls -la /proc/<pid>/fd/        # pipes + sockets in use
cat /proc/<pid>/wchan          # kernel wait reason
ps --ppid <pid> -o pid,stat,etime,cmd   # children (rsync/rar/ssh…)
```

If a child is the bottleneck, debug there (watch staging dir grow, foreground
an ``ssh <host> true`` to re-auth, etc.).

If the Python itself is pinned (%CPU≈100, no children): ``pip install
py-spy`` then ``py-spy dump --pid <pid>``.

**Worker row stuck in "running"**

- Orchestrator forgot ``pool.mark(key, 'ok'|'fail', …)`` on completion.
- Or marked from a worker thread without ``app.call_from_thread(...)``.

**Config not loading / wrong values**

```
python -c "from gppu import Env; e = Env.from_env(name='<app>'); print(e._config_dir); print(e.glob_dict('<section>'))"
```
- Empty dict → YAML not where gppu looks. Default is
  ``<app_path>/_config/*.yaml``.
- Values stale → restart. No hot-reload.

**Secret blank / wrong**

Resolution order: env var → vault → config. A mis-named env var silently
wins. ``clear_secret_cache()`` between rotations. ``gppu.vault`` prints
the active vault path.

**F12 / Shift+F12 does nothing**

App hasn't mixed in ``DebugMixin``. Either add it (and
``*DebugMixin.DEBUG_BINDINGS`` to ``BINDINGS``) or use ``DebugSink``
directly as a callable passed in via ``debug_log=``.

**Log file grows, screen shows nothing**

Intended — main log is progress/results, debug sink is warnings. If a
specific warning needs to surface on screen too, call both.

### 2. Selftest

```
python - <<'PY'
import gppu
from gppu.tui import DebugSink, TickProgress, STATE_GLYPHS, glyph_rich
print('gppu', gppu.VER_GPPU)
s = DebugSink('gppu-selftest', capacity=10); s('hello')
print('sink path:', s.path)
print('running:', glyph_rich('running'))
PY
```

All five lines print → gppu is healthy; the bug is in the app.

### 3. Bug report bundle

1. ``python -V`` + ``pip show gppu textual rich`` (in the app's venv).
2. ``cat ~/.cache/<app>/debug.log`` — last ``--- run <ISO-ts> ---`` section onward.
3. Stdout rerun: ``<app-cmd> 2>&1 | tee /tmp/<app>-repro.log``.
4. For hangs: ``py-spy dump --pid <pid>`` while the freeze is live.
5. Minimal steps to reproduce (which key, which flag, which input).

### 4. Load-bearing assumptions

Break these and nothing above helps:

- App runs in a venv with ``pip install -e ~/gppu``.
- Textual ≥ version gppu pins in its setup.
- Real TTY **or** ``TEXTUAL_DRIVER`` set, not an IDE-terminal that eats escapes.
- Long-running call paths accept ``debug_log: DebugLogger = None`` and route warnings through it (otherwise main log stays noisy).

---

## Mode: PROPOSE — "draft a change to gppu"

Use when someone wants to add, change, or remove something in ``~/gppu``.
The goal of this mode is a well-framed proposal — not the code itself —
since gppu is editable-installed into every app's venv and changes hit
everyone at once.

### 1. Proposal template

Fill all sections before writing code. Keep the draft in
``~/_/inbox/gppu-<slug>.md`` until agreed, then promote to a Project
note or a branch.

```markdown
---
type: Proposal
project: gppu
created: <YYYY-MM-DD>
status: Draft
---

# <title>

## Motivation
Why this exists. One paragraph. Cite the concrete pain (app, file:line).

## Current behavior
What gppu does today. Reference files.

## Proposed behavior
What it should do. Minimal sketch, not full code.

## Public API
Any new/changed symbol: name, module, signature, one-line docstring.
Anything renamed or removed: the migration path.

## Backwards compatibility
- Breaking? (y/n)  For what callers?
- Deprecation plan, if any.

## Affected consumers
List by repo:
- preservator — ... (file:lines that import the symbol)
- SessionManager TUI — ...
- ontology-browser — ...
- Transcriber — ...

## Risk / blast radius
What breaks if this ships wrong?  How do we detect it?

## Rollout
- [ ] Branch gppu locally: `git -C ~/gppu checkout -b <slug>`
- [ ] Write change + tests if practical
- [ ] Point ONE app at the branch (editable install is global — use a
      second venv or a worktree to avoid hitting everyone else)
- [ ] Smoke-test that app end-to-end
- [ ] Update the gppu skill's DEBUG decision tree if a new symptom class is introduced
- [ ] Merge + update consumer apps in one PR per consumer
```

### 2. Where changes belong

```
purpose                                  → place in
─────────────────────────────────────────────────────
new TUI widget reusable by ≥ 2 apps      → gppu/tui/<topic>.py + export in __init__.py
app-specific widget                       → in the app, not gppu
new config helper                         → gppu/mixin_Config.py or gppu/__init__.py (Env)
new logger / logger feature               → gppu/logger.py
new base class                            → gppu/App.py (_Base / _PGBase)
visualization (chart, grid)               → gppu/tui/viz/<name>.py
new state glyph                           → gppu/tui/icons.py (STATE_GLYPHS)
new spinner frame set                     → gppu/tui/icons.py (SPINNERS)
```

### 3. Review checklist (self-review before asking the user)

- [ ] Is any existing gppu symbol already close? (``grep -rn '<intent>' ~/gppu``)
- [ ] Did you check each consumer app for patterns worth generalizing
      along with this change? (preservator, SessionManager, ontology-browser,
      Transcriber — the usual four)
- [ ] Is the new symbol exported from ``gppu/tui/__init__.py``?
- [ ] Does the docstring carry one concrete example?
- [ ] Does the change force an app to pin gppu version? If so — call it out.
- [ ] Does it add a keybinding? Conflict with existing (F12, Shift+F12, Esc, q)?
- [ ] Any new file handle / subprocess / timer that needs cleanup on exit?

### 4. When the proposal is rejected

Write a short "rejected because …" line into the proposal file and move
it to ``~/_/inbox/archive/`` so the next person checking "did anyone try
this?" finds it.
