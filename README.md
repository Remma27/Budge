# Budge

App web open-source y gratuita para trackear gastos personales. Sin suscripciones.

## Stack

Next.js 16 (App Router + TypeScript) + Prisma 7 + PostgreSQL (Neon, free tier) + Auth.js + Tailwind CSS v4. Deploy en Vercel (hobby gratis). Todo el ciclo vive en este repo: un solo deploy.

Gestor de paquetes: **pnpm** (vía corepack).

## Requisitos

- Node.js 22+
- Una base PostgreSQL gratis en [Neon](https://neon.tech) (o cualquier Postgres)

## Quickstart local

```bash
pnpm install
cp .env.example .env
# edita DATABASE_URL en .env con tu connection string
pnpm db:diff && pnpm db:apply && pnpm db:check
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando           | Qué hace                              |
| ----------------- | ------------------------------------- |
| `pnpm dev`        | Servidor de desarrollo                |
| `pnpm build`      | Build de producción                   |
| `pnpm lint`       | ESLint                                |
| `pnpm db:migrate` | Aplica migraciones (`prisma migrate`, requiere salida directa al puerto 5432) |
| `pnpm db:diff`    | Genera SQL offline (`prisma migrate diff`, sin conexión) |
| `pnpm db:apply`   | Aplica `prisma/migrations/0_init/migration.sql` por HTTPS (puerto 443) |
| `pnpm db:check`   | Verifica tablas y conteos en la base     |
| `pnpm db:generate`| Regenera el cliente de Prisma         |
| `pnpm db:studio`  | UI para ver/editar datos              |

## Notas

- Multi-moneda sin conversión automática en v1: cada movimiento guarda su moneda y los totales se agrupan por moneda.
- Si tu red bloquea el puerto 5432 (común en redes corporativas/escolares), usa el flujo `db:diff` → `db:apply` → `db:check`, que habla con Neon por HTTPS (443) mediante `@neondatabase/serverless`.
- **Fase 1 ✅:** registro/login (NextAuth Credentials + JWT) + CRUD de gastos/ingresos + categorías, verificado E2E contra Neon.
- El cliente de Prisma se genera en `src/generated/` (ignorado por git).

## Roadmap

- **Fase 1 ✅:** registro/login (NextAuth Credentials + JWT) + CRUD de gastos/ingresos + categorías
- **Fase 2:** presupuestos por categoría/mes + movimientos recurrentes
- **Fase 3:** dashboard con gráficas + importar/exportar CSV
- **Fase 4:** PWA instalable + release público

## Licencia

MIT — ver [LICENSE](LICENSE).
