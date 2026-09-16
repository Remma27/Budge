import { withAuth } from "next-auth/middleware";

// Rutas que requieren sesión; lo demás (login, registro, API de auth) queda público.
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/", "/categorias", "/transacciones/:path*"],
};
