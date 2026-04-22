import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z, type ZodTypeAny } from "zod";
import { captureError } from "@/lib/logger";
import { ratelimit } from "@/lib/ratelimit";
import { normalizeError, UnauthorizedError, RateLimitError } from "./errors";

type RateLimitBucket = keyof typeof ratelimit;

type Ctx<TIn, TParams> = {
  req: Request;
  input: TIn;
  params: TParams;
  userId: string | null;
};

type HandlerOptions<TIn, TOut, TParams> = {
  schema?: ZodTypeAny;
  auth?: "required" | "optional" | "none";
  rateLimit?: RateLimitBucket;
  handler: (ctx: Ctx<TIn, TParams>) => Promise<TOut> | TOut;
};

export function createHandler<TIn = unknown, TOut = unknown, TParams = Record<string, string>>(
  opts: HandlerOptions<TIn, TOut, TParams>,
) {
  return async (
    req: Request,
    routeCtx: { params: Promise<TParams> } | { params: TParams } | undefined,
  ) => {
    try {
      const session = await auth();
      const userId = session?.user?.id ?? null;

      if (opts.auth === "required" && !userId) {
        throw new UnauthorizedError();
      }

      if (opts.rateLimit) {
        const id = userId ?? (await headers()).get("x-forwarded-for") ?? "anon";
        const { success } = await ratelimit[opts.rateLimit].limit(id);
        if (!success) throw new RateLimitError();
      }

      let input: unknown = undefined;
      if (opts.schema) {
        const method = req.method.toUpperCase();
        if (method === "GET" || method === "DELETE") {
          const url = new URL(req.url);
          input = Object.fromEntries(url.searchParams.entries());
        } else {
          input = await req.json().catch(() => ({}));
        }
        input = opts.schema.parse(input);
      }

      const params = routeCtx
        ? await Promise.resolve((routeCtx as { params: Promise<TParams> | TParams }).params)
        : ({} as TParams);

      const data = await opts.handler({
        req,
        input: input as TIn,
        params,
        userId: userId ?? null,
      });

      return NextResponse.json({ data });
    } catch (err) {
      const normalized = normalizeError(err);
      if (normalized.status >= 500) {
        captureError(err, { url: req.url });
      }
      return NextResponse.json(
        {
          error: {
            code: normalized.code,
            message: normalized.message,
            details: normalized.details,
          },
        },
        { status: normalized.status },
      );
    }
  };
}

// Convenience helpers that pre-set auth mode
export const createProtectedHandler = <TIn = unknown, TOut = unknown, TParams = Record<string, string>>(
  opts: Omit<HandlerOptions<TIn, TOut, TParams>, "auth">,
) => createHandler({ ...opts, auth: "required" });

export const createPublicHandler = <TIn = unknown, TOut = unknown, TParams = Record<string, string>>(
  opts: Omit<HandlerOptions<TIn, TOut, TParams>, "auth">,
) => createHandler({ ...opts, auth: "none" });

export type ApiResponse<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string; details?: unknown } };

export { z };
