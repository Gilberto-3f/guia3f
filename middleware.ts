import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import {
  isProfileIncomplete,
  ROTAS_EXIGEM_PERFIL_COMPLETO,
} from "./lib/postAuthRedirect.js";

const intlMiddleware = createMiddleware(routing);

function pathExigePerfilCompleto(pathname: string): boolean {
  return ROTAS_EXIGEM_PERFIL_COMPLETO.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;
  const protectedRoutes = [
    "/guia",
    "/feed",
    "/perfil",
    "/atividades",
    "/canal",
    "/dashboard",
  ];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    session?.user?.id &&
    pathExigePerfilCompleto(pathname) &&
    (await isProfileIncomplete(supabase, session.user.id))
  ) {
    return NextResponse.redirect(new URL("/escolha-perfil", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
