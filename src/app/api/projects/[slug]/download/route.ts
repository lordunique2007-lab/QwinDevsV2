import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to download." }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { slug: params.slug } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [download] = await prisma.$transaction([
    prisma.download.create({
      data: { projectId: project.id, userId: session.user.id, version: project.version }
    }),
    prisma.project.update({
      where: { id: project.id },
      data: { downloadCount: { increment: 1 } }
    })
  ]);

  return NextResponse.json({
    download,
    fileUrl: project.fileUrl,
    fileName: project.fileName
  });
}
