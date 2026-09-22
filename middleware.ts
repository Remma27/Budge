import { withAuth } from "next-auth/middleware";

// Todo protegido por defecto salvo auth, API e iconos estáticos.
// /api/* se excluye a propósito: cada ruta responde 401 JSON por sí misma y
// un redirect del middleware a /login rompería clientes fetch (ej. sync offline).
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/((?!api|login|register|recuperar-contrasena|restablecer-contrasena|invitaciones|_next|favicon.ico|manifest.webmanifest|sw.js|icon-192.svg|icon-512.svg).*)",
  ],
};
