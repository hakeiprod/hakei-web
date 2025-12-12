"use client";
import { Navbar, NavbarBrand, NavbarContent } from "@heroui/react";
import Link from "next/link";
import { InputSearch } from "./input-serch";
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
