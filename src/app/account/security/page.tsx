import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordAddition } from "@/components/password-addition";
import { providerAvailability } from "@/server/authentication/providers";
import { PasswordChange } from "@/components/password-change";
import { requireActor } from "@/server/auth";
import { prisma } from "@/prisma";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await requireActor().catch(() => null);
  if (!actor) redirect("/api/auth/signin");
  const credential = await prisma.passwordCredential.findUnique({
    where: { userId: actor.id },
    select: { userId: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { email: true },
  });
  return credential ? (
    <PasswordChange />
  ) : (
    <>
      <PasswordAddition
        githubAvailable={providerAvailability().github}
        hasEmail={Boolean(user?.email)}
      />
      <Link href="/">ホームへ戻る</Link>
    </>
  );
}
