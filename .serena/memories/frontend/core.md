# Frontend
- Main dashboard: `src/app/page.tsx`; preserves existing compact card/list layout.
- Transaction creation/editing uses `src/components/transaction-form.tsx` and `src/app/actions/transactions.ts`.
- CSV import preview is `src/components/csv-import.tsx` at `/importar`; export/backup are protected by `src/app/api/export/route.ts`.
- Charts intentionally use server-rendered CSS bars rather than a chart dependency.