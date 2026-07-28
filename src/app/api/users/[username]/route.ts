import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNumericId } from "@/lib/user-id";

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);

  const user = await prisma.user.findUnique({
    where: { username: params.username.toLowerCase() },
    select: {
      id: true,
      numericId: true,
      username: true,
      usernameHidden: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      role: true,
      status: true,
      banReason: true,
      bannedUntil: true,
      isVerified: true,
      createdAt: true,
      _count: { select: { followedBy: true, following: true, projects: true, posts: true } },
      projects: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          slug: true,
          name: true,
          tagline: true,
          category: true,
          downloadCount: true,
          viewCount: true,
          version: true,
          status: true,
          developer: { select: { username: true, displayName: true, isVerified: true } },
          ratings: { select: { stars: true } }
        }
      },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          author: { select: { username: true, displayName: true, avatarUrl: true, isVerified: true, role: true } },
          likes: { select: { userId: true } }
        }
      }
    }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let isFollowing = false;
  if (session?.user && session.user.id !== user.id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } }
    });
    isFollowing = !!follow;
  }

  const projects = user.projects.map((p) => {
    const avg = p.ratings.length ? p.ratings.reduce((s, r) => s + r.stars, 0) / p.ratings.length : 0;
    const { ratings, ...rest } = p;
    return { ...rest, avgRating: Math.round(avg * 10) / 10, ratingCount: ratings.length };
  });

  const posts = user.posts.map((p) => ({ ...p, likeCount: p.likes.length, likes: undefined }));

  const isSelf = session?.user?.id === user.id;

  let isStaffViewer = false;
  if (session?.user && !isSelf) {
    const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    isStaffViewer = viewer?.role === "SUPER_ADMIN" || viewer?.role === "MODERATOR";
  }

  return NextResponse.json({
    profile: {
      id: user.id,
      numericId: formatNumericId(user.numericId),
      // The username can be hidden by its owner — the numeric ID above is
      // always resolvable and is what the profile URL still uses internally,
      // but the public-facing @handle is withheld from other viewers.
      username: user.usernameHidden && !isSelf ? null : user.username,
      usernameHidden: user.usernameHidden,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      followerCount: user._count.followedBy,
      followingCount: user._count.following,
      projectCount: user._count.projects,
      postCount: user._count.posts,
      isFollowing,
      isSelf,
      // Only sent to Moderators/Super Admin viewing someone else's profile —
      // this is what powers the quick-ban/freeze buttons without needing the
      // admin console.
      moderation: isStaffViewer
        ? { id: user.id, status: user.status, banReason: user.banReason, bannedUntil: user.bannedUntil }
        : undefined
    },
    projects,
    posts
  });
}
