"use client";
import { Navbar, NavbarBrand, NavbarContent } from "@heroui/react";
import { InputSearch } from "./input-serch";
import Link from "next/link";
export function Header() {
  return (
    <>
      <Navbar>
        <NavbarBrand>
          <Link href="/">
            <p className="font-bold text-inherit">hakei</p>
          </Link>
        </NavbarBrand>
        <NavbarContent justify="center">
          <InputSearch />
        </NavbarContent>
      </Navbar>
    </>
  );
}
