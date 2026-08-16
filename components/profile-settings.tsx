"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { toast } from "sonner"
import { isUsernameAvailable, updateProfile } from "@/app/actions/profile"

type Profile = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
}

export function ProfileSettings({ profile }: { profile: Profile }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(profile.name)
  const [username, setUsername] = useState(profile.username ?? "")
  const [bio, setBio] = useState(profile.bio ?? "")
  const [image, setImage] = useState<string | null>(profile.image)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)

  const usernameChanged = username.toLowerCase() !== (profile.username ?? "").toLowerCase()

  async function checkUsername(value: string) {
    setUsername(value)
    setAvailable(null)
    const clean = value.trim().toLowerCase()
    if (!clean || clean === (profile.username ?? "").toLowerCase()) return
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setAvailable(false)
      return
    }
    setChecking(true)
    try {
      const res = await isUsernameAvailable(clean)
      setAvailable(res.available)
    } catch {
      setAvailable(null)
    } finally {
      setChecking(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setImage(data.url)
    } catch {
      toast.error("Could not upload image")
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (usernameChanged && available === false) {
      toast.error("That username isn't available")
      return
    }
    setSaving(true)
    try {
      await updateProfile({
        name: name.trim(),
        username: username.trim(),
        bio: bio.trim(),
        image,
      })
      toast.success("Profile updated")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <UserAvatar name={name} image={image} className="size-20 text-2xl" />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            </div>
          ) : null}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="sr-only" id="avatar" />
          <Button type="button" variant="secondary" className="gap-2" onClick={() => fileRef.current?.click()}>
            <Camera className="size-4" aria-hidden />
            Change photo
          </Button>
        </div>
      </div>

      {/* Display name */}
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
      </div>

      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
          <Input
            id="username"
            value={username}
            onChange={(e) => checkUsername(e.target.value)}
            className="pl-7"
            maxLength={20}
            autoCapitalize="none"
            spellCheck={false}
          />
          {usernameChanged ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              ) : available === true ? (
                <Check className="size-4 text-primary" aria-hidden />
              ) : available === false ? (
                <X className="size-4 text-destructive" aria-hidden />
              ) : null}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          3&ndash;20 characters. Letters, numbers, and underscores only.
        </p>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell people a bit about yourself"
          className="min-h-[90px] resize-none"
          maxLength={160}
        />
        <p className="text-right text-xs text-muted-foreground">{bio.length}/160</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || uploading} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
      </div>
    </div>
  )
}
