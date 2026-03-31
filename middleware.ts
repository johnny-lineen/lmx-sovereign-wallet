import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/access-restricted(.*)"]);
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
    const { userId } = await auth();
    const allowlistRaw = process.env.TEST_USER_ALLOWLIST?.trim();
    if (allowlistRaw && userId) {
      const allowlist = new Set(
        allowlistRaw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      );
      if (!allowlist.has(userId)) {
        if (isApiRoute(req)) {
          return NextResponse.json({ error: "FORBIDDEN", message: "Access is currently restricted." }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/access-restricted", req.url));
      }
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
