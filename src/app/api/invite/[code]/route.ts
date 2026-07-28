import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { joinByInvite, CommunityError } from "@/lib/community";

export async function POST(_req: Request, { params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  try {
    const result = await joinByInvite(params.code, session.user.id);
    return NextResponse.json({ joined: true, slug: result.community.slug, alreadyMember: result.alreadyMember });
  } catch (err) {
    if (err instanceof CommunityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not join community." }, { status: 500 });
  }
}
