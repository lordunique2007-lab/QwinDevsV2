"use client";

import { useState } from "react";

const REACTIONS = ["❤️", "😂", "🔥", "😭", "🥲", "🤔", "🥰", "🗿"];
const MORE_REACTIONS = ["👍", "👎", "😮", "😡", "🎉", "👏", "💯", "🙏", "😍", "🤯", "😢", "🤝"];

export default function MessageContextMenu({
  isMine,
  onReply,
  onPin,
  isPinned,
  onDeleteForMe,
  onDeleteForEveryone,
  onCopy,
  onReact,
  onClose
}: {
  isMine: boolean;
  onReply: () => void;
  onPin: () => void;
  isPinned: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
  onCopy: () => void;
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div
        className="absolute left-1/2 top-1/2 w-64 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-qwin-border bg-qwin-surface p-2 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex flex-wrap gap-1 border-b border-qwin-border pb-2">
          {(showMore ? MORE_REACTIONS : REACTIONS).map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="rounded-lg p-1.5 text-xl hover:bg-qwin-surface2"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowMore((v) => !v)}
            className="rounded-lg p-1.5 text-sm text-qwin-muted hover:bg-qwin-surface2"
          >
            {showMore ? "←" : "+"}
          </button>
        </div>

        <MenuItem
          label="Reply"
          onClick={() => {
            onReply();
            onClose();
          }}
        />
        <MenuItem
          label={isPinned ? "Unpin" : "Pin"}
          onClick={() => {
            onPin();
            onClose();
          }}
        />
        <MenuItem
          label="Copy"
          onClick={() => {
            onCopy();
            onClose();
          }}
        />
        <MenuItem
          label="Delete for me"
          danger
          onClick={() => {
            onDeleteForMe();
            onClose();
          }}
        />
        {isMine && onDeleteForEveryone && (
          <MenuItem
            label="Delete for everyone"
            danger
            onClick={() => {
              onDeleteForEveryone();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-qwin-surface2 ${
        danger ? "text-red-400" : ""
      }`}
    >
      {label}
    </button>
  );
}
