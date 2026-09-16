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

- Cada movimiento conserva su moneda. La moneda principal y las tasas manuales administradas por el usuario consolidan el dashboard; no se consultan APIs externas ni se guardan credenciales. La consolidación omite monedas sin tasa para no mezclar importes incompatibles.
- PWA: instalable y con fallback básico de shell. La captura offline todavía es local y no se sincroniza automáticamente.
- Multiusuario: las cuentas personales conviven con workspaces opcionales. Los datos personales tienen `workspaceId = NULL`; solo se comparten mediante migración explícita y transaccional, que conserva categorías y referencias.
- Workspaces usan `OWNER`, `EDITOR` y `VIEWER`: leer requiere membresía; escribir requiere `EDITOR`; miembros, invitaciones y migración requieren `OWNER`. Las invitaciones normalizan correo, almacenan solo el hash SHA-256 del token, expiran en 7 días y se revocan expirándolas. Sin proveedor de email, la acción devuelve un enlace para copiar.
- La API de workspace vive en `src/app/actions/workspaces.ts`; la pantalla de aceptación requiere sesión y valida que el correo de la cuenta coincida con la invitación.
- Si tu red bloquea el puerto 5432 (común en redes corporativas/escolares), usa el flujo `db:diff` → `db:apply` → `db:check`, que habla con Neon por HTTPS (443) mediante `@neondatabase/serverless`.
- **Fase 1 ✅:** registro/login (NextAuth Credentials + JWT) + CRUD de gastos/ingresos + categorías, verificado E2E contra Neon.
- El cliente de Prisma se genera en `src/generated/` (ignorado por git).

## Roadmap

- **Fase 1 ✅:** registro/login (NextAuth Credentials + JWT) + CRUD de gastos/ingresos + categorías
- **Fase 2:** presupuestos por categoría/mes + movimientos recurrentes
- **Fase 3:** dashboard con gráficas + importar/exportar CSV
- **Fase 4:** PWA instalable + release público (base instalable implementada; iconos, sincronización offline y publicación quedan pendientes)

## Pendientes que requieren decisión o infraestructura

- Elegir proveedor o proceso de actualización para tasas. Actualmente `ExchangeRate` está preparado para tasas introducidas por el usuario, sin credenciales ni llamadas externas.

## Licencia

MIT — ver [LICENSE](LICENSE).
