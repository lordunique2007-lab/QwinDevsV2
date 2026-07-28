"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import VerifiedBadge from "./VerifiedBadge";

type SearchResults = {
  users: { username: string; displayName: string; isVerified: boolean }[];
  projects: { slug: string; name: string; category: string }[];
  bots: { username: string; name: string; category: string }[];
  communities: { slug: string; name: string; type: string }[];
};

export default function Navbar() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data);
          setSearchOpen(true);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    async function poll() {
      const res = await fetch("/api/notifications");
      if (!res.ok || !active) return;
      const data = await res.json();
      setUnread(data.unreadCount);
    }
    poll();
    const i = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(i);
    };
  }, [status]);

  const hasResults =
    results && (results.users.length || results.projects.length || results.bots.length || results.communities.length);

  const isStaff =
    status === "authenticated" &&
    ((session.user as any).role === "SUPER_ADMIN" || (session.user as any).role === "MODERATOR");

  return (
    <header className="sticky top-0 z-50 border-b border-qwin-border bg-qwin-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-qwin-text shrink-0">
          Qwin<span className="text-qwin-primary2">Devs</span>
        </Link>

        <div ref={boxRef} className="relative hidden flex-1 md:block">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setSearchOpen(true)}
            placeholder="Search users, projects, bots, communities…"
            className="input h-10"
          />
          {searchOpen && (
            <div className="absolute left-0 right-0 top-12 max-h-96 overflow-y-auto rounded-xl border border-qwin-border bg-qwin-surface p-2 shadow-lg">
              <SearchResultsList results={results} hasResults={!!hasResults} onNavigate={() => setSearchOpen(false)} />
            </div>
          )}
        </div>

        {/* Always-visible core actions */}
        <nav className="ml-auto flex items-center gap-2">
          {status === "authenticated" ? (
            <>
              {isStaff && (
                <Link href="/admin" className="btn-secondary text-sm" aria-label="Admin console">
                  👑
                </Link>
              )}
              <Link href="/notifications" className="btn-secondary relative text-sm" aria-label="Notifications">
                🔔
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-qwin-primary px-1 text-[10px] text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/messages" className="btn-secondary text-sm" aria-label="Messages">
                💬
              </Link>
              <Link href="/wallet" className="btn-secondary text-sm" aria-label="Wallet">
                💎
              </Link>
            </>
          ) : status === "loading" ? (
            <div className="h-10 w-16 animate-pulse rounded-xl bg-qwin-surface2" />
          ) : (
            <Link href="/login" className="btn-secondary text-sm">
              Log in
            </Link>
          )}

          {/* Hamburger menu — holds everything else, always reachable on any screen size */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="btn-secondary text-sm"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              ☰
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-qwin-border bg-qwin-surface p-2 shadow-lg">
                {/* Search — shown here on mobile since the inline bar is desktop-only */}
                <div className="mb-2 md:hidden">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="input h-9 text-sm"
                  />
                  {query.trim().length >= 2 && (
                    <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-qwin-border bg-qwin-surface2 p-1">
                      <SearchResultsList
                        results={results}
                        hasResults={!!hasResults}
                        onNavigate={() => {
                          setMenuOpen(false);
                          setQuery("");
                        }}
                      />
                    </div>
                  )}
                </div>

                <MenuLink href="/projects" onClick={() => setMenuOpen(false)}>
                  Explore projects
                </MenuLink>
                <MenuLink href="/communities" onClick={() => setMenuOpen(false)}>
                  Communities
                </MenuLink>
                <MenuLink href="/bots" onClick={() => setMenuOpen(false)}>
                  Bots
                </MenuLink>
                <MenuLink href="/premium" onClick={() => setMenuOpen(false)} className="text-qwin-gold">
                  ✨ Premium
                </MenuLink>
                <MenuLink href="/team" onClick={() => setMenuOpen(false)}>
                  Meet the Devs
                </MenuLink>

                {status === "authenticated" && (
                  <>
                    <div className="my-2 border-t border-qwin-border" />
                    <MenuLink href={`/profile/${session.user.username}`} onClick={() => setMenuOpen(false)}>
                      {session.user.name ?? session.user.username}
                    </MenuLink>
                    <MenuLink href="/settings" onClick={() => setMenuOpen(false)}>
                      ⚙️ Settings
                    </MenuLink>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-qwin-surface2"
                    >
                      Sign out
                    </button>
                  </>
                )}

                {status === "unauthenticated" && (
                  <>
                    <div className="my-2 border-t border-qwin-border" />
                    <MenuLink href="/register" onClick={() => setMenuOpen(false)} className="text-qwin-primary2">
                      Join
                    </MenuLink>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  onClick,
  className = "",
  children
}: {
  href: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-lg px-3 py-2 text-sm hover:bg-qwin-surface2 ${className}`}
    >
      {children}
    </Link>
  );
}

function SearchResultsList({
  results,
  hasResults,
  onNavigate
}: {
  results: SearchResults | null;
  hasResults: boolean;
  onNavigate: () => void;
}) {
  if (!hasResults) return <p className="p-3 text-sm text-qwin-muted">No results.</p>;

  return (
    <>
      {results?.users && results.users.length > 0 && (
        <SearchGroup label="Developers">
          {results.users.map((u) => (
            <Link key={u.username} href={`/profile/${u.username}`} onClick={onNavigate} className="search-row">
              {u.displayName} {u.isVerified && <VerifiedBadge size={12} />}{" "}
              <span className="text-qwin-muted">@{u.username}</span>
            </Link>
          ))}
        </SearchGroup>
      )}
      {results?.projects && results.projects.length > 0 && (
        <SearchGroup label="Projects">
          {results.projects.map((p) => (
            <Link key={p.slug} href={`/projects/${p.slug}`} onClick={onNavigate} className="search-row">
              {p.name} <span className="text-qwin-muted">· {p.category}</span>
            </Link>
          ))}
        </SearchGroup>
      )}
      {results?.bots && results.bots.length > 0 && (
        <SearchGroup label="Bots">
          {results.bots.map((b) => (
            <Link key={b.username} href={`/bots/${b.username}`} onClick={onNavigate} className="search-row">
              🤖 {b.name} <span className="text-qwin-muted">@{b.username}</span>
            </Link>
          ))}
        </SearchGroup>
      )}
      {results?.communities && results.communities.length > 0 && (
        <SearchGroup label="Communities">
          {results.communities.map((c) => (
            <Link key={c.slug} href={`/communities/${c.slug}`} onClick={onNavigate} className="search-row">
              {c.type === "CHANNEL" ? "📢" : "👥"} {c.name}
            </Link>
          ))}
        </SearchGroup>
      )}
    </>
  );
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-qwin-muted">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
