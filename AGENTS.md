<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep tournament analytics and storylines read-only projections of canonical match and tournament state; persist only completed-run summaries locally so displays cannot diverge from simulation results.
- Keep deterministic validation and integrity checks as standalone scripts under `scripts/`, using production modules as the source of truth so repository checks do not require a test-only runtime.
