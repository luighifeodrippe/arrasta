import { getProfile, saveProfile } from "@/lib/server/storage";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getProfile());
}

export async function PUT(request: Request) {
  return Response.json(await saveProfile((await request.json()) as Profile));
}
