import { authenticationRequest } from "@/server/authentication/maintenance";
import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { guardAuthRequest } from "@/server/authentication/http";
import { providerAvailability } from "@/server/authentication/providers";

const availability = providerAvailability();
export const GET = (request: Request) =>
  guardAuthRequest(
    request,
    (bounded) =>
      authenticationRequest(bounded, () =>
        handlers.GET(new NextRequest(bounded)),
      ),
    availability.github,
  );
export const POST = (request: Request) =>
  guardAuthRequest(
    request,
    (bounded) =>
      authenticationRequest(bounded, () =>
        handlers.POST(new NextRequest(bounded)),
      ),
    availability.github,
  );
