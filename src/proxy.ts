import { NextResponse, type NextRequest } from "next/server";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * A API só atende o próprio computador: bloqueia acesso por outro nome de host (DNS rebinding)
 * e pedidos que mudam algo vindos de outro site aberto no navegador.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!LOCAL_HOST.test(host)) return forbidden();
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site") return forbidden();
    if (origin && origin !== "null") {
      try {
        if (new URL(origin).host !== host) return forbidden();
      } catch {
        return forbidden();
      }
    } else if (origin === "null") {
      return forbidden();
    }
  }
  return NextResponse.next();
}

function forbidden() {
  return NextResponse.json({ error: "O Arrasta só aceita pedidos deste computador." }, { status: 403 });
}

export const config = { matcher: "/api/:path*" };
