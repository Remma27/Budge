# Completion
- Standard checks: `corepack pnpm lint`, `corepack pnpm build`.
- Build can compile successfully then fail on unrelated pre-existing recurring Prisma type errors if concurrent schema/client changes are incomplete.
- Inspect `git status --short` and `git diff` before reporting.