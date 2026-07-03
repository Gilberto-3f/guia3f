import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        encode: "tokens-only",
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, responseHeaders) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          if (responseHeaders) {
            Object.entries(responseHeaders).forEach(([key, value]) => {
              response.headers.set(key, value);
            });
          }
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
