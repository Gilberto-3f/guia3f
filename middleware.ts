import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { middlewareTemSessaoLocal } from "./lib/middlewareAuthCookie";

const intlMiddleware = createMiddleware(routing);

/** Guia público (home e categorias); subrotas específicas podem exigir login. */
const PROTECTED_PREFIXES = [
  "/feed",
  "/perfil",
  "/atividades",
  "/canal",
  "/dashboard",
  "/favoritos",
  "/servicos",
  "/mobilidade",
];

function rotaExigeAuth(pathname: string): boolean {
  return (
    PROTECTED_PREFIXES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/guia/compras")
  );
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const needsAuth = rotaExigeAuth(pathname);

  const response = intlMiddleware(request);

  if (!needsAuth) {
    return response;
  }

  if (!middlewareTemSessaoLocal(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
