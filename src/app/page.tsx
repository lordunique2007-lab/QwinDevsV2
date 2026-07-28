"use client";

import { useEffect, useState } from "react";
import Composer from "@/components/Composer";
import PostCard, { FeedPost } from "@/components/PostCard";
import StoriesBar from "@/components/StoriesBar";
import Link from "next/link";

export default function HomePage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function loadFeed(cursor?: string) {
    const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
    const res = await fetch(url);
    const data = await res.json();
    setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts));
    setNextCursor(data.nextCursor);
    setLoading(false);
  }

  useEffect(() => {
    loadFeed();
  }, []);

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <h1 className="font-display text-lg font-bold">Home</h1>
          <p className="text-sm text-qwin-muted">Where Developers Build. Share. Connect. Grow.</p>
        </div>
        <Link href="/projects/new" className="btn-primary text-sm">
          + Publish project
        </Link>
      </div>

      <StoriesBar />

      <Composer onPosted={(post) => setPosts((prev) => [post, ...prev])} />

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse p-4" />
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="card p-8 text-center text-qwin-muted">
          No posts yet. Be the first to share what you&apos;re building.
        </div>
      )}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {nextCursor && (
        <button onClick={() => loadFeed(nextCursor)} className="btn-secondary mx-auto">
          Load more
        </button>
      )}
    </div>
  );
}
