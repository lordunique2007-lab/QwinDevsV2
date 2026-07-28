import Link from "next/link";
import VerifiedBadge from "./VerifiedBadge";

export type ProjectSummary = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  downloadCount: number;
  viewCount: number;
  avgRating: number;
  ratingCount: number;
  version: string;
  status: string;
  isBoosted?: boolean;
  developer: { username: string; displayName: string; isVerified: boolean };
};

export default function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`card block p-4 transition-transform hover:-translate-y-0.5 hover:border-qwin-primary/50 ${
        project.isBoosted ? "border-qwin-gold/50 shadow-goldglow" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-semibold">{project.name}</h3>
          <p className="text-sm text-qwin-muted line-clamp-2">{project.tagline}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {project.isBoosted && <span className="badge bg-qwin-gold/20 text-qwin-gold">🚀 Boosted</span>}
          <span className="badge bg-qwin-surface2 text-qwin-muted">{project.category}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-qwin-muted">
        <span>⭐ {project.avgRating || "—"} ({project.ratingCount})</span>
        <span>⬇ {project.downloadCount}</span>
        <span>👁 {project.viewCount}</span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-qwin-border pt-3">
        <span className="inline-flex items-center gap-1 text-xs text-qwin-muted">
          by @{project.developer.username} {project.developer.isVerified && <VerifiedBadge size={12} />}
        </span>
        <span className="text-xs text-qwin-accent">v{project.version}</span>
      </div>
    </Link>
  );
}
