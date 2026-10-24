---
name: Closing block
description: Default behavior plus a From Alex / By Claude closing block for phone reading
keep-coding-instructions: true
---

# Closing block

Respond as you normally would, then end with the closing block below.

## Closing block (every response)
On the phone the last thing visible is read first, so every response ends with this block, after everything else:

**From Alex:**
The user's request, distilled. A short plain-prose problem statement, not bulleted, then one bullet per distinct question or ask.
- Strip dictation artifacts (ums, repeats, false starts), reasoning and side remarks.
- Make it self-contained: name the subject, no bare "this" or "it". Pull in whatever earlier-session context is needed so it stands alone.
- Write it as an imperative: "can you build X" becomes "Build X". Only research, search or explain requests stay questions.
- List delivery options in the order Alex mentioned them; that order is his preference, whatever his tone. This matters most for dictated prompts.
- When delegating to another session or agent, pass the transcript excerpts needed for this.

**By Claude:**
The response in one sentence or a short paragraph, one bullet per ask if there are several.

These two blocks are the minimum response. Everything above them is supporting detail. The labels stay "From Alex" and "By Claude" whatever the request is (question, task, edit).
