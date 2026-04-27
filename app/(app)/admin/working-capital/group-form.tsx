"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateGroupAction } from "./actions";

type GroupInitial = {
  fiscalYear: string;
  groupRevenue: number;
  nwcTargetRelease: number;
  notes: string;
};

export function GroupForm({ initial }: { initial: GroupInitial }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState(initial);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateGroupAction(fd);
      if ("error" in res) toast.error(res.error);
      else toast.success("Group baseline updated");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Fiscal year" name="fiscalYear" value={state.fiscalYear} onChange={(v) => setState((s) => ({ ...s, fiscalYear: v }))} />
      <Field
        label="Group revenue (SAR m)"
        name="groupRevenue"
        type="number"
        step="0.01"
        value={String(state.groupRevenue)}
        onChange={(v) => setState((s) => ({ ...s, groupRevenue: Number(v) }))}
      />
      <Field
        label="NWC target release (SAR m)"
        name="nwcTargetRelease"
        type="number"
        step="0.01"
        value={String(state.nwcTargetRelease)}
        onChange={(v) => setState((s) => ({ ...s, nwcTargetRelease: Number(v) }))}
      />
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          rows={2}
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save group baseline"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (_v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
      />
    </div>
  );
}
