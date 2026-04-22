import "server-only";
import { Client } from "@upstash/qstash";
import { env } from "@/lib/env";

const qstash = env.QSTASH_TOKEN ? new Client({ token: env.QSTASH_TOKEN }) : null;

export type JobPayload<T = unknown> = { job: string; payload: T };

export async function enqueue<TPayload>(opts: {
  job: string;
  url: string;
  body: TPayload;
  delaySeconds?: number;
  retries?: number;
}) {
  const body: JobPayload<TPayload> = { job: opts.job, payload: opts.body };

  if (!qstash) {
    await fetch(opts.url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    return { messageId: "local-noop" };
  }

  return qstash.publishJSON({
    url: opts.url,
    body: body as unknown as object,
    delay: opts.delaySeconds,
    retries: opts.retries ?? 3,
  });
}
