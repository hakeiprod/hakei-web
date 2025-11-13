"use client";
import { trpc } from "@/trpc/client";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
  TableColumn,
  Link,
  Spinner,
} from "@heroui/react";
import { Disc, Music, User } from "lucide-react";
import { useInfiniteScroll } from "@heroui/use-infinite-scroll";
import { match, P } from "ts-pattern";
import { useQueryState } from "nuqs";

export function TableResource() {
  const [query] = useQueryState("query");
  const { data, isLoading, fetchNextPage, hasNextPage } =
    trpc.resource.infinity.useInfiniteQuery(
      {
        include: { artist: true, album: true, music: true },
        ...(query ? { where: { name: { contains: query } } } : {}),
        limit: 20,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );
  const [loaderRef, scrollerRef] = useInfiniteScroll({
    hasMore: hasNextPage,
    onLoadMore: () => {
      fetchNextPage();
    },
  });

  const columns = [
    { key: "type", name: "type" },
    { key: "name", label: "name" },
  ];
  return (
    <>
      <Table
        isHeaderSticky
        aria-label="Example table with dynamic content"
        baseRef={scrollerRef}
        bottomContent={
          hasNextPage ? (
            <div className="flex w-full justify-center">
              <Spinner ref={loaderRef} />
            </div>
          ) : null
        }
      >
        <TableHeader>
          {columns.map((column) => (
            <TableColumn key={column.key}>{column.label}</TableColumn>
          ))}
        </TableHeader>
        <TableBody
          isLoading={isLoading}
          items={data?.pages.flatMap((page) => page.items) ?? []}
          loadingContent={<Spinner />}
        >
          {(item) => (
            <TableRow key={item.id}>
              <TableCell>
                {match(item)
                  .with({ album: P.nonNullable }, () => <Disc />)
                  .with({ music: P.nonNullable }, () => <Music />)
                  .with({ artist: P.nonNullable }, () => <User />)
                  .otherwise(() => null)}
              </TableCell>
              <TableCell>
                <Link href={"/resource/" + item.id} underline="hover">
                  {item.name}
                </Link>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
