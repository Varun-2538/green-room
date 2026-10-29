"use client";

import { any, CredentialRequest, IDKitRequestWidget, type RpContext } from "@worldcoin/idkit";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

// Accept any World ID credential a real person may hold; uniqueness comes from the nullifier.
const constraints = any(
  CredentialRequest("proof_of_human"),
  CredentialRequest("passport"),
  CredentialRequest("selfie"),
);

export function VerifyWithWorld({ appId, rpId, action, next }: { appId: `app_${string}`; rpId: string; action: string; next: string }) {
  const router = useRouter();
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/rp-signature", { method: "POST" });
      if (!response.ok) throw new Error("Could not start verification. Please log in again.");
      const sig = (await response.json()) as { sig: string; nonce: string; created_at: number; expires_at: number };
      setRpContext({ rp_id: rpId, nonce: sig.nonce, created_at: sig.created_at, expires_at: sig.expires_at, signature: sig.sig });
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start verification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={start} disabled={loading}>
        {loading ? "Starting…" : "Verify with World ID"}
      </Button>
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      {rpContext ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={appId}
          action={action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          constraints={constraints}
          handleVerify={async (result) => {
            const response = await fetch("/api/verify-proof", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(result),
            });
            if (!response.ok) {
              const body = (await response.json().catch(() => ({}))) as { error?: string };
              setError(body.error ?? "Verification failed.");
              throw new Error(body.error ?? "Verification failed");
            }
          }}
          onSuccess={() => router.push(next)}
          onError={(code) => setError(`World ID stopped: ${code.replaceAll("_", " ")}.`)}
        />
      ) : null}
    </div>
  );
}
