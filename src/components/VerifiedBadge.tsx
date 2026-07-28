"use client";

export default function VerifiedBadge({ size = 16, title = "Verified" }: { size?: number; title?: string }) {
  return (
    <span
      className="verified-badge-wrap inline-flex align-middle"
      style={{ width: size, height: size }}
      title={title}
    >
      <svg
        viewBox="0 0 22 22"
        width={size}
        height={size}
        className="verified-badge-svg"
        aria-label={title}
        role="img"
      >
        <path
          className="verified-badge-star"
          fill="#3B9EFF"
          d="M11 0l2.24 1.93 2.9-.8 1.37 2.63 2.96.63-.3 3.02 2.33 1.94-1.94 2.33.3 3.02-2.96.63-1.37 2.63-2.9-.8L11 22l-2.24-1.93-2.9.8-1.37-2.63-2.96-.63.3-3.02L.5 11.75l1.94-2.33-.3-3.02 2.96-.63L6.47 3.14l2.9.8L11 0z"
        />
        <path
          className="verified-badge-check"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.5 11.3l2.7 2.7 6.3-6.3"
        />
      </svg>

      <style jsx>{`
        .verified-badge-wrap {
          filter: drop-shadow(0 0 0 rgba(59, 158, 255, 0));
          animation: badge-glow 2.6s ease-in-out infinite;
        }
        .verified-badge-check {
          stroke-dasharray: 14;
          stroke-dashoffset: 14;
          animation: badge-draw 0.5s ease-out 0.15s forwards;
        }
        .verified-badge-star {
          transform-origin: center;
          animation: badge-pop 0.4s ease-out;
        }
        @keyframes badge-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes badge-pop {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          70% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes badge-glow {
          0%,
          100% {
            filter: drop-shadow(0 0 1px rgba(59, 158, 255, 0.35));
          }
          50% {
            filter: drop-shadow(0 0 4px rgba(59, 158, 255, 0.75));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .verified-badge-wrap,
          .verified-badge-check,
          .verified-badge-star {
            animation: none !important;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </span>
  );
}
