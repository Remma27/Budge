# Budge core
- Next app lives in `src/app`; dashboard is `src/app/page.tsx` and uses server-side Prisma queries.
- Auth boundary is `requireUserId()` from `src/lib/get-user.ts`; server actions and download routes must call it.
- Shared UI primitives/classes are in `src/components/ui.tsx`; preserve minimal Tailwind/zinc visual language.
- Data model and migrations are in `prisma/`; generated Prisma client is `src/generated/prisma`.
- Related persistence: frontend details in `mem:frontend/core`; database/commands in `mem:tech_stack` and `mem:suggested_commands`.