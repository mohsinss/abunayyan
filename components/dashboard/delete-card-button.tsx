"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteCardButton({
  datasetId,
  datasetTitle,
}: {
  datasetId: string;
  datasetTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const onConfirm = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/datasets/${datasetId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError(`Delete failed (${res.status})`);
        setBusy(false);
        return;
      }
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete card
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{datasetTitle}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The card disappears from the gallery and its chatbot stops responding immediately.
            Uploaded files, parsed rows, and indexed chunks are permanently removed 30 days later
            by the retention sweep. You cannot undo after that.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent the default dialog close so we can stay open on error.
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
