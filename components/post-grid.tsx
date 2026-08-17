"use client";

import { PostCard } from "@/components/post-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { PostSummary } from "@/lib/types";
import { ImageIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function PostGrid({
  posts,
  emptyLabel = "No posts yet.",
  isOwnProfile = false,
}: {
  posts: PostSummary[];
  emptyLabel?: string;
  isOwnProfile?: boolean;
}) {
  // Keep a local copy so edits/deletes reflect immediately without a refetch.
  const [items, setItems] = useState<PostSummary[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const router = useRouter();

  // Re-sync if the server sends a new list (e.g. after navigation/refresh).
  useEffect(() => {
    setItems(posts);
  }, [posts]);

  const active = items.find((p) => p.id === activeId) ?? null;

  // Only show the full empty state if it's NOT their own profile
  if (items.length === 0 && !isOwnProfile) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
          <ImageIcon className="text-muted-foreground size-6" aria-hidden />
        </div>
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {/* Render the Create Post tile as the first element if it's their profile */}
        {isOwnProfile ? (
          <button
            type="button"
            onClick={() => {
              router.push("/app/feed");
            }}
            className="group border-border hover:bg-muted/50 relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-transparent transition-colors"
          >
            <div className="bg-muted group-hover:bg-background flex size-10 items-center justify-center rounded-full transition-colors">
              <PlusIcon className="text-foreground size-5" aria-hidden />
            </div>
            <span className="text-muted-foreground group-hover:text-foreground mt-3 text-xs font-medium">
              New Post
            </span>
          </button>
        ) : null}

        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveId(p.id)}
            className="group bg-muted relative aspect-square overflow-hidden rounded-md"
          >
            {p.imageUrl ? (
              <Image
                src={p.imageUrl || "/placeholder.svg"}
                alt={p.caption ?? "Post"}
                fill
                sizes="(max-width: 640px) 33vw, 300px"
                className="object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              // Text-only post: show the caption on a solid tile.
              <div className="bg-secondary group-hover:bg-secondary/80 flex h-full w-full min-w-0 items-center justify-center p-3 transition-all group-hover:scale-105">
                <p className="text-secondary-foreground line-clamp-5 w-full text-center text-xs leading-snug wrap-break-word">
                  {p.caption ?? ""}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog
        open={!!active}
        onOpenChange={(open) => !open && setActiveId(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 ring-0 sm:max-w-md"
        >
          <DialogTitle className="sr-only">
            {active ? `Post by ${active.authorName}` : "Post"}
          </DialogTitle>
          {active ? (
            <div className="max-h-[85vh] overflow-y-auto">
              <PostCard
                post={active}
                onDeletedAction={(id) => {
                  setActiveId(null);
                  setItems((prev) => prev.filter((p) => p.id !== id));
                }}
                onUpdatedAction={(id, caption) =>
                  setItems((prev) =>
                    prev.map((p) => (p.id === id ? { ...p, caption } : p)),
                  )
                }
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
