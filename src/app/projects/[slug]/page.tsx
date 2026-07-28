"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import BoostButton from "@/components/BoostButton";
import ReportButton from "@/components/ReportButton";

type ProjectDetail = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  license: string;
  status: string;
  repoUrl: string | null;
  websiteUrl: string | null;
  downloadCount: number;
  viewCount: number;
  avgRating: number;
  ratingCount: number;
  isBoosted?: boolean;
  isOwner?: boolean;
  developer: { username: string; displayName: string; isVerified: boolean; bio: string };
  ratings: Array<{
    id: string;
    stars: number;
    review: string;
    createdAt: string;
    user: { username: string; displayName: string };
  }>;
};

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${params.slug}`)
      .then((r) => r.json())
      .then((data) => {
        setProject(data.project);
        setLoading(false);
      });
  }, [params.slug]);

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      window.location.href = "/login";
      return;
    }
    setRateBusy(true);
    const res = await fetch(`/api/projects/${params.slug}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, review })
    });
    setRateBusy(false);
    if (res.ok) {
      setMessage("Thanks for rating this project.");
      const refreshed = await fetch(`/api/projects/${params.slug}`).then((r) => r.json());
      setProject(refreshed.project);
    }
  }

  async function handleDownload() {
    if (!session) {
      window.location.href = "/login";
      return;
    }
    setDownloadBusy(true);
    const res = await fetch(`/api/projects/${params.slug}/download`, { method: "POST" });
    const data = await res.json();
    setDownloadBusy(false);
    if (res.ok && project) {
      setProject({ ...project, downloadCount: project.downloadCount + 1 });
      if (data.fileUrl) {
        window.open(data.fileUrl, "_blank");
      } else {
        setMessage("This project doesn't have a file attached yet — check the repository link instead.");
      }
    }
  }

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!project) return <div className="card p-8 text-center text-qwin-muted">Project not found.</div>;

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="badge bg-qwin-surface2 text-qwin-muted">{project.category}</span>
            <h1 className="mt-2 font-display text-2xl font-bold">{project.name}</h1>
            <p className="mt-1 text-qwin-muted">{project.tagline}</p>
          </div>
          <button onClick={handleDownload} disabled={downloadBusy} className="btn-primary shrink-0">
            {downloadBusy ? "…" : `⬇ Download v${project.version}`}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-qwin-muted">
          <span>⭐ {project.avgRating || "—"} ({project.ratingCount} ratings)</span>
          <span>⬇ {project.downloadCount} downloads</span>
          <span>👁 {project.viewCount} views</span>
          <span>{project.license}</span>
        </div>

        {project.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((t) => (
              <span key={t} className="badge bg-qwin-surface2 text-qwin-primary2">
                #{t}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 whitespace-pre-wrap text-qwin-text">{project.description}</p>

        <div className="mt-4 flex gap-3 text-sm">
          {project.repoUrl && (
            <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-qwin-primary2 hover:underline">
              Repository
            </a>
          )}
          {project.websiteUrl && (
            <a href={project.websiteUrl} target="_blank" rel="noreferrer" className="text-qwin-primary2 hover:underline">
              Website
            </a>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-qwin-border pt-4">
          <Link href={`/profile/${project.developer.username}`} className="flex items-center gap-1 text-sm hover:underline">
            by @{project.developer.username} {project.developer.isVerified && <VerifiedBadge size={13} />}
          </Link>
          <ReportButton targetType="PROJECT" targetId={project.id} />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-display font-semibold">Rate this project</h2>
        <form onSubmit={submitRating} className="mt-3 space-y-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStars(s)}
                className={`text-2xl ${s <= stars ? "opacity-100" : "opacity-30"}`}
              >
                ⭐
              </button>
            ))}
          </div>
          <textarea
            placeholder="Write a review (optional)"
            className="input resize-none"
            rows={3}
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
          <button type="submit" disabled={rateBusy} className="btn-secondary">
            {rateBusy ? "Submitting…" : "Submit rating"}
          </button>
          {message && <p className="text-sm text-qwin-accent">{message}</p>}
        </form>

        <div className="mt-6 space-y-4 border-t border-qwin-border pt-4">
          {project.ratings.length === 0 && (
            <p className="text-sm text-qwin-muted">No reviews yet.</p>
          )}
          {project.ratings.map((r) => (
            <div key={r.id}>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{r.user.displayName}</span>
                <span className="text-qwin-muted">{"⭐".repeat(r.stars)}</span>
              </div>
              {r.review && <p className="mt-1 text-sm text-qwin-muted">{r.review}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
