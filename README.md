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

- Cada movimiento conserva su moneda. El dashboard consulta automáticamente tasas diarias de Frankfurter, sin API key; si el proveedor no responde, usa tasas guardadas como respaldo y omite monedas sin tasa para no mezclar importes incompatibles.
- PWA: instalable, con manifest, service worker, fallback básico de shell y cola local de movimientos. La sincronización ocurre al recuperar conexión y abrir la app; no se procesan cambios offline de edición o borrado.
- Multiusuario: las cuentas personales conviven con workspaces opcionales. Los datos personales tienen `workspaceId = NULL`; solo se comparten mediante migración explícita y transaccional, que conserva categorías y referencias.
- Workspaces usan `OWNER`, `EDITOR` y `VIEWER`: leer requiere membresía; escribir requiere `EDITOR`; miembros, invitaciones y migración requieren `OWNER`. Las invitaciones normalizan correo, almacenan solo el hash SHA-256 del token, expiran en 7 días y se revocan expirándolas. Sin proveedor de email, la acción devuelve un enlace para copiar.
- La API de workspace vive en `src/app/actions/workspaces.ts`; la pantalla de aceptación requiere sesión y valida que el correo de la cuenta coincida con la invitación.
- Si tu red bloquea el puerto 5432 (común en redes corporativas/escolares), usa el flujo `db:diff` → `db:apply` → `db:check`, que habla con Neon por HTTPS (443) mediante `@neondatabase/serverless`.
- **Fase 1 ✅:** registro/login (NextAuth Credentials + JWT) + CRUD de gastos/ingresos + categorías, verificado E2E contra Neon.
- El cliente de Prisma se genera en `src/generated/` (ignorado por git).

## Roadmap

- **Fase 1 ✅:** registro/login (NextAuth Credentials + JWT) + CRUD de gastos/ingresos + categorías
- **Fase 2 ✅:** presupuestos por categoría/mes + movimientos recurrentes
- **Fase 3 ✅:** dashboard con gráficas + importar/exportar CSV
- **Fase 4 🟡:** PWA instalable y sincronización básica de movimientos implementadas; quedan pruebas de instalación/offline, despliegue público y operación.

## Pendientes que requieren decisión o infraestructura

- Configurar `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `NEXTAUTH_URL` en el entorno de despliegue para habilitar recuperación de contraseña por correo. Sin esas credenciales, la interfaz mantiene una respuesta genérica y el flujo no envía mensajes.
- Las tasas de cambio se obtienen automáticamente desde Frankfurter (`api.frankfurter.dev`), sin credenciales ni coste. Las tasas guardadas solo funcionan como respaldo cuando el proveedor no está disponible.

Antes de publicar, ejecutar `pnpm lint`, `pnpm build` y `pnpm db:check`. Si se añade una migración y la red bloquea PostgreSQL, aplicarla con `pnpm db:apply -- <nombre-de-migracion>`.

## Licencia

MIT — ver [LICENSE](LICENSE).
