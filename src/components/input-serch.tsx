"use client";
import { findResources } from "@/app/actions";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Disc, Music, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { match, P } from "ts-pattern";

export function InputSearch() {
  const [resources, setResources] = useState<
    Awaited<ReturnType<typeof findResources>>
  >([]);
  const [query] = useQueryState("query");
  const [value, setValue] = useState(query ?? "");
  const router = useRouter();
  function handleOnKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.code === "Enter") router.push("/resource?query=" + value);
  }
  async function handleInputChange(value: string) {
    setValue(value);
    setResources(
      await findResources({
        include: { artist: true, album: true, music: true },
        where: { name: { contains: value } },
        take: 5,
      })
    );
  }

  return (
    <Autocomplete
      aria-label="Search"
      radius="full"
      isClearable
      placeholder="Search..."
      defaultItems={resources}
      startContent={<Search />}
      inputValue={value}
      onInputChange={handleInputChange}
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
