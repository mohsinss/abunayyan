"use client";

import { useTransition } from "react";
import { toggleKillSwitchAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

export function KillSwitchButton({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        fd.set("enabled", String(!enabled));
        start(() => {
          void toggleKillSwitchAction(fd);
        });
      }}
    >
      <Button
        type="submit"
        variant={enabled ? "default" : "destructive"}
        disabled={pending}
        title={enabled ? "Re-enable all chatbots" : "Stop all chat traffic"}
      >
        {enabled ? "Re-enable chat" : "Emergency stop"}
      </Button>
    </form>
  );
}
