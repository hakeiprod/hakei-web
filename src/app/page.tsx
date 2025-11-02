import { InputSearch } from "@/components/input-serch";
import { HydrateClient } from "@/trpc/server";

export default function Home() {
  return (
    <HydrateClient>
      <InputSearch />
    </HydrateClient>
  );
}
