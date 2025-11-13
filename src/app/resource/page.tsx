import { Header } from "@/components/header";
import { TableResource } from "@/components/table-resource";

export default function Resources() {
  return (
    <>
      <Header />
      <div className="container">
        <TableResource />
      </div>
    </>
  );
}
