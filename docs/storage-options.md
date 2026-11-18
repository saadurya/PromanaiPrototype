# Storage options for later phases (SCRUM-21)

Neutral comparison for when ProManAI needs a real backend. **No selection is made here** - this is a comparison note, not a decision. The current prototype phase stays frontend-only with sample data kept in the browser.

What we would need to store later: interview content and reports, roadmap/resource entries, shared interview experiences, peer availability and bookings, engagement state (streaks, XP).

| Option | Cost | Effort | Team fit | Notes |
| --- | --- | --- | --- | --- |
| Supabase (Postgres + auth + storage) | Free tier; paid as usage grows | Medium: schema design, SDK integration, security rules | Appears in the older written build plan (Oct 7), but was never a team-agreed decision in the calls | Team member has raised a safety concern about proceeding with Supabase; that concern is unresolved and recorded here as a concern, not a verified finding |
| Google Sheets | Free | Low: share a sheet, read/write via API or manually | Matches the team's current habit of working in Google tools | Workable as interim storage for small structured data (resources, roadmap entries); weak for concurrent writes and relational data |
| Google Docs | Free | Very low | Same as above | Fine for content that is basically documents (question banks, guides); not structured storage |
| Excel (local files) | Free | Very low | Familiar to everyone | No multi-user access story; version conflicts likely |

## What this means now

- The prototype keeps using in-browser sample data; nothing in the current phase requires any of these options.
- Real data needs at this stage are small, so a Sheets/Docs interim approach is consistent with the current phase if the team wants shared editable content before a backend exists.
- The Supabase safety concern should be addressed explicitly by the team before it is chosen or ruled out.

*No selection made. Decision belongs to the team when the backend phase starts.*
