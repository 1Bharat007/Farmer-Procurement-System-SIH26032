/**
 * Next.js Edge Middleware — Route Auth Guard
 * Protects /farmer and /dashboard from unauthenticated access.
 * Since tokens are in localStorage (client-side only), we use a lightweight
 * cookie-based echo: the login pages write a short-lived "session" cookie
 * (ks_session=1) after successful auth so the middleware can gate routes.
 * The real JWT is still validated server-side on every API call.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FARMER_ROUTES = ["/farmer"];
const ADMIN_ROUTES = ["/dashboard", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isFarmerRoute = FARMER_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  const isAdminRoute = ADMIN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (!isFarmerRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  // Check session cookie (set by login pages on success)
  const sessionCookie = request.cookies.get("ks_session");
  const roleCookie = request.cookies.get("ks_role");

  if (!sessionCookie?.value) {
    // Not authenticated -- redirect to appropriate login
    const loginPath = isAdminRoute ? "/login/admin" : "/login/farmer";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = loginPath;
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Role-based guard: farmer session cannot access admin routes
  if (isAdminRoute && roleCookie?.value === "farmer") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/farmer";
    return NextResponse.redirect(redirectUrl);
  }

  // Admin/staff session cannot access farmer routes
  if (isFarmerRoute && roleCookie?.value && roleCookie.value !== "farmer") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/farmer",
    "/farmer/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
