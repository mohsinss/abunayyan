import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Welcome{user.name ? `, ${user.name}` : ""}</h1>
      <p className="mt-2 text-muted-foreground">
        This is your dashboard. Wire up whatever your app needs here.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Try the AI chat</CardTitle>
            <CardDescription>Streaming chat with Claude, tool-use, prompt caching.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/chat">Open chat</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Manage your subscription</CardTitle>
            <CardDescription>View invoices, change plan, cancel.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/billing">Billing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
