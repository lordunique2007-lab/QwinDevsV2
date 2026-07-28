"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProjectCard, { ProjectSummary } from "@/components/ProjectCard";

const CATEGORIES = [
  "Artificial Intelligence",
  "Automation",
  "Bots",
  "Business",
  "Cybersecurity",
  "Developer Tools",
  "Education",
  "Games",
  "Libraries",
  "Mobile Apps",
  "Open Source",
  "Productivity",
  "Utilities",
  "Web Applications"
];

function ProjectsContent() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "newest");
  const q = searchParams.get("q") ?? "";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (sort) params.set("sort", sort);
    if (q) params.set("q", q);

    fetch(`/api/projects?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects);
        setLoading(false);
      });
  }, [category, sort, q]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">
          {q ? `Results for "${q}"` : "Discover projects"}
        </h1>
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input w-auto text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-auto text-sm">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="downloads">Most downloaded</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card h-40 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="card p-10 text-center text-qwin-muted">
          No projects match yet. Be the first to publish one in this category.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <ProjectsContent />
    </Suspense>
  );
}
