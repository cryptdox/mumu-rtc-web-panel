import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { plans } from "@/api/rtc";
import type { BillingCycle } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { CycleTabs, PlanGrid } from "@/components/plans";
import { Button, ErrorBox, Loading } from "@/components/ui";

/** Live plan catalog from the control plane (public, no login). */
export function PricingSection() {
  const { user } = useAuth();
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const catalog = useQuery({ queryKey: ["plans", "public"], queryFn: plans.listPublic, staleTime: 300_000 });

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Every account starts with a 30-day trial of Starter, then stays on Free forever. Upgrade when you need more.
        </p>
        <div className="mt-5">
          <CycleTabs value={cycle} onChange={setCycle} />
        </div>
      </div>
      <div className="mt-8">
        <ErrorBox error={catalog.error} onRetry={() => catalog.refetch()} />
        {catalog.isLoading ? (
          <Loading />
        ) : (
          <PlanGrid
            plans={catalog.data ?? []}
            cycle={cycle}
            action={(p) => (
              <Link to={user ? "/app/billing" : "/register"}>
                <Button className="w-full" variant={p.price == null ? "secondary" : "primary"}>
                  {p.price == null ? "Contact sales" : user ? "Choose plan" : p.tier === "FREE" ? "Start free" : "Start free trial"}
                </Button>
              </Link>
            )}
          />
        )}
      </div>
    </section>
  );
}

export default function Pricing() {
  return <PricingSection />;
}
