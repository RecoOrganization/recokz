import { initTRPC, TRPCError } from "@trpc/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma } from "@/shared/lib/prisma";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 * These allow you to access things like the database, the session, etc, when
 * processing a request
 */
type ClerkOrgMetadata = {
  organizationIds?: string[];
  currentOrganizationId?: string | null;
  /** @deprecated use organizationIds + currentOrganizationId */
  organizationId?: string | null;
};

function getOrgFromMetadata(metadata: ClerkOrgMetadata | undefined): {
  organizationId: string | undefined;
  organizationIds: string[];
  currentOrganizationId: string | null;
} {
  let organizationIds = Array.isArray(metadata?.organizationIds)
    ? metadata.organizationIds
    : [];
  const legacyId = metadata?.organizationId as string | null | undefined;
  if (organizationIds.length === 0 && legacyId) {
    organizationIds = [legacyId];
  }
  const currentOrganizationId =
    metadata?.currentOrganizationId !== undefined
      ? (metadata.currentOrganizationId as string | null)
      : legacyId ?? null;
  const organizationId =
    currentOrganizationId ?? organizationIds[0] ?? undefined;
  return { organizationId, organizationIds, currentOrganizationId };
}

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const { userId, sessionClaims } = await auth();
  const clerk = await clerkClient();

  let meta: ClerkOrgMetadata | undefined =
    (sessionClaims?.metadata as ClerkOrgMetadata) ??
    (sessionClaims as { publicMetadata?: ClerkOrgMetadata })?.publicMetadata;

  const hasOrgInfo =
    (Array.isArray(meta?.organizationIds) && meta.organizationIds.length > 0) ||
    (typeof meta?.organizationId === "string" && meta.organizationId);
  if (userId && !hasOrgInfo) {
    try {
      const user = await clerk.users.getUser(userId);
      meta = user.publicMetadata as ClerkOrgMetadata;
    } catch {
      // ignore
    }
  }

  const { organizationId, organizationIds, currentOrganizationId } =
    getOrgFromMetadata(meta);

  return {
    userId,
    organizationId,
    organizationIds,
    currentOrganizationId,
    prisma,
    clerk,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers directory
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthed) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Reusable middleware that enforces users are logged in before running the
 * procedure
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      organizationIds: ctx.organizationIds,
      currentOrganizationId: ctx.currentOrganizationId,
      prisma: ctx.prisma,
      clerk: ctx.clerk,
    },
  });
});

/**
 * Protected (authenticated) procedure
 */
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
