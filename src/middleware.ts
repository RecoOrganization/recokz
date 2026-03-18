import {
  clerkMiddleware,
  createRouteMatcher,
  clerkClient,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isApiRoute = createRouteMatcher(["/api(.*)"]);
const isOnboardingRoute = createRouteMatcher(["/onboarding"]);
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/api(.*)",
]);

type ClerkOrgMetadata = {
  organizationIds?: string[];
  currentOrganizationId?: string | null;
  organizationId?: string | null;
};

function extractOrgIds(meta: ClerkOrgMetadata | undefined): string[] {
  if (Array.isArray(meta?.organizationIds) && meta.organizationIds.length > 0) {
    return meta.organizationIds;
  }
  if (typeof meta?.organizationId === "string" && meta.organizationId) {
    return [meta.organizationId];
  }
  return [];
}

async function getOrganizationIds(
  userId: string,
  sessionClaims: Record<string, unknown> | null,
): Promise<string[]> {
  const meta =
    (sessionClaims?.metadata as ClerkOrgMetadata | undefined) ??
    (sessionClaims?.publicMetadata as ClerkOrgMetadata | undefined);
  const ids = extractOrgIds(meta);
  if (ids.length > 0) return ids;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    return extractOrgIds(user.publicMetadata as ClerkOrgMetadata);
  } catch {
    return [];
  }
}

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (userId && (isOnboardingRoute(request) || isApiRoute(request))) {
    return NextResponse.next();
  }

  if (!userId && !isPublicRoute(request)) {
    return redirectToSignIn({ returnBackUrl: request.url });
  }

  if (userId) {
    const organizationIds = await getOrganizationIds(userId, sessionClaims);
    if (!organizationIds.length) {
      const onboardingUrl = new URL("/onboarding", request.url);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
