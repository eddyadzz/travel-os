import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login({ data: { email, password } });
      toast.success("Signed in");
      await navigate({ to: "/agent" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="gradient-lagoon flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
            <Palmtree className="size-6" />
          </span>
          <div>
            <h1 className="text-display text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Access the agent console and back office.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="surface-card space-y-4 rounded-2xl p-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@agency.mv"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          {import.meta.env.DEV && (
            <p className="text-center text-xs text-muted-foreground">
              Demo: admin@oceanatlas.mv · changeme123
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to the website
          </Link>
        </p>
      </div>
    </div>
  );
}
