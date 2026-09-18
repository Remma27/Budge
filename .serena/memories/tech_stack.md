# Stack
- Next.js 16.3.5, React 19.2.8, TypeScript 5, Tailwind CSS 4.
- Prisma 7.10 with PostgreSQL and Neon adapter; package manager is pnpm 12.4.2 (pnpm may be unavailable in some shells).
- ESLint 9 with eslint-config-next; generated Prisma output is under `src/generated/prisma`.
- Models include User, Category, Transaction, Budget, RecurringRule; transactions are Decimal amounts grouped by 3-letter currency.