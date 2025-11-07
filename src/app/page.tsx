import { Header } from "@/components/header";
import { HydrateClient } from "@/trpc/server";

export default function Home() {
  return (
    <HydrateClient>
      <Header />
      Home
    </HydrateClient>
  );
}
