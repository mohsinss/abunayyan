"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { WcSbu } from "@/db";
import { updateSbuAction } from "../actions";

const PAIRS: Array<[keyof WcSbu, keyof WcSbu, string]> = [
  ["inv", "tInv", "Inventory (SAR m)"],
  ["ar", "tAr", "Trade Receivables (SAR m)"],
  ["ca", "tCa", "Contract Assets (SAR m)"],
  ["ap", "tAp", "Accounts Payable (SAR m)"],
  ["dio", "tDio", "DIO (days)"],
  ["dso", "tDso", "DSO (days)"],
  ["dpo", "tDpo", "DPO (days)"],
];

export function SbuForm({ sbu }: { sbu: WcSbu }) {
  const [pending, start] = useTransition();
  const initialNotes = (sbu.notes ?? []).slice(0, 4);
  while (initialNotes.length < 4) initialNotes.push("");
  const [notes, setNotes] = useState<string[]>(initialNotes);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateSbuAction(fd);
      if ("error" in res) toast.error(res.error);
      else toast.success(`Saved ${sbu.name}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="id" value={sbu.id} />

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Identity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" defaultValue={sbu.name} />
          <Field label="Share text" name="shareText" defaultValue={sbu.shareText ?? ""} />
          <div className="sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="posture">
              Posture
            </label>
            <input
              id="posture"
              name="posture"
              defaultValue={sbu.posture ?? ""}
              className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Baselines &amp; targets
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Field</div>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Baseline</div>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Target</div>
          {PAIRS.map(([baseKey, targetKey, label]) => (
            <PairRow
              key={String(baseKey)}
              label={label}
              baseName={String(baseKey)}
              baseDefault={sbu[baseKey] as number}
              targetName={String(targetKey)}
              targetDefault={sbu[targetKey] as number}
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Observation bullets (4 max)
        </h2>
        <div className="space-y-2">
          {notes.map((n, i) => (
            <textarea
              key={i}
              name={`note${i}`}
              value={n}
              onChange={(e) =>
                setNotes((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
              }
              rows={2}
              placeholder={`Bullet ${i + 1}`}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save SBU"}
        </button>
        <span className="text-xs text-neutral-500">
          Last updated {sbu.updatedAt.toISOString().slice(0, 10)}
        </span>
      </div>
    </form>
  );
}

function PairRow({
  label,
  baseName,
  baseDefault,
  targetName,
  targetDefault,
}: {
  label: string;
  baseName: string;
  baseDefault: number;
  targetName: string;
  targetDefault: number;
}) {
  return (
    <>
      <div className="self-center text-sm">{label}</div>
      <input
        name={baseName}
        type="number"
        step="0.01"
        defaultValue={baseDefault}
        className="rounded-md border border-neutral-200 px-3 py-2 text-sm tabular-nums"
      />
      <input
        name={targetName}
        type="number"
        step="0.01"
        defaultValue={targetDefault}
        className="rounded-md border border-neutral-200 px-3 py-2 text-sm tabular-nums"
      />
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
      />
    </div>
  );
}
