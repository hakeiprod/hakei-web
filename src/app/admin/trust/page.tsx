import { notFound, redirect } from "next/navigation";
import { prisma } from "@/prisma";
import { currentActor } from "@/server/auth";
import { trustRuleSchema } from "@/server/trust-calculation";
import { AuthenticatedContent } from "@/components/authenticated-content";
import { TrustAdmin } from "@/components/trust-admin";
export default async function TrustAdministration() {
  const actor = await currentActor();
  if (!actor) redirect("/api/auth/signin");
  if (actor.serviceRole !== "OPERATOR") notFound();
  const policy = await prisma.trustPolicyState.findUnique({
    where: { singletonId: "global" },
  });
  const rule = policy?.activeRuleId
    ? await prisma.trustRuleVersion.findUnique({
        where: { id: policy.activeRuleId },
      })
    : null;
  return (
    <AuthenticatedContent actorId={actor.id}>
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          信頼度の運営設定
        </h1>
        <TrustAdmin
          rule={rule ? trustRuleSchema.parse(rule) : null}
          ruleId={rule?.id ?? null}
          policyVersion={policy?.version ?? 0}
        />
      </main>
    </AuthenticatedContent>
  );
}
