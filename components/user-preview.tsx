"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { getProfilePreview } from "@/app/actions/profile"
import {
  sendFriendRequest,
  cancelFriendRequest,
} from "@/app/actions/invites"
import type { UserProfile } from "@/lib/types"
import { Check, Clock, ExternalLink, Loader2, MessageCircle, UserPlus } from "lucide-react"

// A small popup card that previews a user's profile without navigating away.
// Controlled by a `userId` (null = closed). Used from in-chat avatars/names and
// the members sidebar so clicking a user opens a preview instead of redirecting.
export function UserPreviewDialog({
  userId,
  onClose,
}: {
  userId: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let active = true
    setLoading(true)
    getProfilePreview(userId)
      .then((p) => {
        if (active) setProfile(p)
      })
      .catch(() => {
        if (active) toast.error("Could not load profile")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  async function addOrAccept() {
    if (!profile) return
    setBusy(true)
    try {
      // sendFriendRequest also auto-accepts if they had already requested us.
      const res = await sendFriendRequest(profile.id)
      if ("status" in res && res.status === "accepted") {
        setProfile({
          ...profile,
          friendStatus: "friends",
          dmChatId: "chatId" in res ? (res.chatId ?? null) : null,
        })
        toast.success(`You and ${profile.name} are now friends`)
      } else {
        setProfile({ ...profile, friendStatus: "outgoing" })
        toast.success("Friend request sent")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request")
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!profile) return
    setBusy(true)
    try {
      await cancelFriendRequest(profile.id)
      setProfile({ ...profile, friendStatus: "none" })
      toast.success("Request canceled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel")
    } finally {
      setBusy(false)
    }
  }

  function message() {
    if (!profile?.dmChatId) return
    onClose()
    router.push(`/app/messages?c=${profile.dmChatId}`)
  }

  return (
    <Dialog open={userId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogTitle className="sr-only">Profile preview</DialogTitle>
        {loading || !profile ? (
          <div className="flex h-44 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <div className="flex flex-col items-center pt-2 text-center">
            <UserAvatar name={profile.name} image={profile.image} className="size-20" />
            <h2 className="mt-3 text-lg font-semibold text-balance">{profile.name}</h2>
            {profile.username ? (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            ) : null}
            {profile.bio ? (
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-pretty text-muted-foreground">
                {profile.bio}
              </p>
            ) : null}

            <div className="mt-3 flex items-center gap-6 text-sm">
              <span>
                <strong className="font-semibold tabular-nums">{profile.postCount}</strong>{" "}
                <span className="text-muted-foreground">posts</span>
              </span>
              <span>
                <strong className="font-semibold tabular-nums">{profile.friendCount}</strong>{" "}
                <span className="text-muted-foreground">friends</span>
              </span>
            </div>

            <div className="mt-5 flex w-full flex-col gap-2">
              {profile.isSelf ? null : profile.friendStatus === "friends" ? (
                <Button className="gap-2" disabled={!profile.dmChatId} onClick={message}>
                  <MessageCircle className="size-4" aria-hidden />
                  Message
                </Button>
              ) : profile.friendStatus === "outgoing" ? (
                <Button variant="secondary" className="gap-2" disabled={busy} onClick={cancel}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Clock className="size-4" aria-hidden />
                  )}
                  Requested · Cancel
                </Button>
              ) : profile.friendStatus === "incoming" ? (
                <Button className="gap-2" disabled={busy} onClick={addOrAccept}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  Accept request
                </Button>
              ) : (
                <Button className="gap-2" disabled={busy} onClick={addOrAccept}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="size-4" aria-hidden />
                  )}
                  Add friend
                </Button>
              )}

              <Button
                variant="outline"
                className="gap-2"
                render={
                  <Link
                    href={profile.username ? `/app/u/${profile.username}` : "#"}
                    onClick={onClose}
                  />
                }
              >
                <ExternalLink className="size-4" aria-hidden />
                View full profile
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
