"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProjectCard, { ProjectSummary } from "@/components/ProjectCard";
import PostCard, { FeedPost } from "@/components/PostCard";
import VerifiedBadge from "@/components/VerifiedBadge";
import QuickModeration, { ModerationInfo } from "@/components/QuickModeration";
import ReportButton from "@/components/ReportButton";

type Profile = {
  id: string;
  numericId: string;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  role: string;
  isVerified: boolean;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  projectCount: number;
  postCount: number;
  isFollowing: boolean;
  isSelf: boolean;
  moderation?: ModerationInfo;
};

const ROLE_LABEL: Record<string, string> = {
  USER: "Member",
  PREMIUM: "Premium",
  VERIFIED_DEVELOPER: "Verified Developer",
  BUSINESS: "Qwin Business",
  MODERATOR: "Moderator",
  SUPER_ADMIN: "Super Admin"
};

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function load() {
    const res = await fetch(`/api/users/${params.username}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setProfile(data.profile);
    setProjects(data.projects);
    setPosts(data.posts);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.username]);

  async function toggleFollow() {
    setFollowBusy(true);
    const res = await fetch(`/api/users/${params.username}/follow`, { method: "POST" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setFollowBusy(false);
    setProfile((p) => (p ? { ...p, isFollowing: data.following, followerCount: p.followerCount + (data.following ? 1 : -1) } : p));
  }

  async function messageUser() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: params.username })
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (res.ok) router.push(`/messages/${data.conversationId}`);
  }

  async function toggleBlock() {
    if (!confirm(blocked ? "Unblock this user?" : "Block this user? They won't be able to message, follow, or mention you.")) {
      return;
    }
    const res = await fetch(`/api/users/${params.username}/block`, { method: "POST" });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (res.ok) setBlocked(data.blocked);
  }

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!profile) return <div className="card p-8 text-center text-qwin-muted">User not found.</div>;

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      {profile.bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.bannerUrl} alt="" className="h-32 w-full rounded-2xl object-cover sm:h-48" />
      )}
      <div className="card p-6">
        {profile.moderation && (
          <div className="mb-4">
            <QuickModeration moderation={profile.moderation} onChanged={load} />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-qwin-surface2 text-2xl font-bold">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                profile.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="flex items-center gap-1.5 font-display text-xl font-bold">
                {profile.displayName} {profile.isVerified && <VerifiedBadge size={18} />}
              </h1>
              <p className="text-sm text-qwin-muted">
                {profile.username ? `@${profile.username}` : `ID ${profile.numericId}`}
              </p>
              {profile.username && (
                <p className="text-xs text-qwin-muted/70">ID {profile.numericId}</p>
              )}
              <span className="badge mt-1 bg-qwin-primary/20 text-qwin-primary2">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </span>
            </div>
          </div>

          {!profile.isSelf && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button onClick={messageUser} className="btn-secondary">
                  Message
                </button>
                <button onClick={toggleFollow} disabled={followBusy} className={profile.isFollowing ? "btn-secondary" : "btn-primary"}>
                  {profile.isFollowing ? "Following" : "Follow"}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={toggleBlock} className="text-xs text-qwin-muted hover:text-red-400">
                  {blocked ? "Unblock" : "Block"}
                </button>
                <ReportButton targetType="USER" targetId={profile.id} />
              </div>
            </div>
          )}
        </div>

        {profile.bio && <p className="mt-4 text-sm text-qwin-text">{profile.bio}</p>}

        <div className="mt-4 flex gap-6 text-sm">
          <span><b>{profile.followerCount}</b> <span className="text-qwin-muted">followers</span></span>
          <span><b>{profile.followingCount}</b> <span className="text-qwin-muted">following</span></span>
          <span><b>{profile.projectCount}</b> <span className="text-qwin-muted">projects</span></span>
          <span><b>{profile.postCount}</b> <span className="text-qwin-muted">posts</span></span>
        </div>
      </div>

      {projects.length > 0 && (
        <div>
          <h2 className="mb-3 font-display font-semibold">Projects</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-semibold">Posts</h2>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
