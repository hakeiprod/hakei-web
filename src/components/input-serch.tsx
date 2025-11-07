"use client";
import { trpc } from "@/trpc/client";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Disc, Music, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { match, P } from "ts-pattern";

export function InputSearch() {
  const [value, setValue] = useState("");
  const { data } = trpc.resource.findMany.useQuery({
    include: { artist: true, album: true, music: true },
    where: { name: { contains: value } },
    take: 5,
  });
  const router = useRouter();
  function handleOnKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.code === "Enter") router.push("/resource?query=" + value);
  }

  return (
    <Autocomplete
      aria-label="Search"
      radius="full"
      isClearable
      placeholder="Search..."
      defaultItems={data ?? []}
      startContent={<Search />}
      onInputChange={setValue}
      onKeyDown={handleOnKeyDown}
    >
      {(item) => (
        <AutocompleteItem
          key={item.id}
          textValue={item.name}
          startContent={match(item as unknown)
            .with({ album: P.nonNullable }, () => <Disc />)
            .with({ music: P.nonNullable }, () => <Music />)
            .with({ artist: P.nonNullable }, () => <User />)
            .otherwise(() => null)}
        >
          {item.name}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
