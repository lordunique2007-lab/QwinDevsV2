import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ratingSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to rate a project." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { slug: params.slug } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const rating = await prisma.rating.upsert({
    where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
    update: { stars: parsed.data.stars, review: parsed.data.review },
    create: {
      projectId: project.id,
      userId: session.user.id,
      stars: parsed.data.stars,
      review: parsed.data.review
    }
  });

  return NextResponse.json({ rating });
}
