"use client";
import { Navbar, NavbarBrand, NavbarContent } from "@heroui/react";

export default function Users() {
  return (
    <>
      <Navbar>
        <NavbarBrand>
          <p className="font-bold text-inherit">hakei</p>
        </NavbarBrand>
        <NavbarContent></NavbarContent>
      </Navbar>
    </>
  );
}
