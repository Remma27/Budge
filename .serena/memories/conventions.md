# Conventions
- Spanish user-facing copy; ASCII is preferred in new source unless existing UI needs accents.
- Server components query Prisma directly; mutations use server actions under `src/app/actions` and revalidate affected paths.
- Keep UI dependency-free where native HTML/CSS suffices; shared classes come from `src/components/ui.tsx`.
- Dashboard filters use URL search params so links/bookmarks preserve state.