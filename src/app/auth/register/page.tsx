import { EmailRegistration } from "@/components/email-registration";
import { providerAvailability } from "@/server/authentication/providers";
export const dynamic = "force-dynamic";
export default function Page() {
  return <EmailRegistration githubAvailable={providerAvailability().github} />;
}
