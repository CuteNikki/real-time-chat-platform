"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createPost } from "@/app/actions/posts"

export function PostComposer({ userName, userImage }: { userName: string; userImage: string | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setUploadedUrl(data.url)
    } catch {
      toast.error("Could not upload image")
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function clearImage() {
    setPreview(null)
    setUploadedUrl(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function submit() {
    if (!uploadedUrl) {
      toast.error("Add an image first")
      return
    }
    setPosting(true)
    try {
      await createPost({ imageUrl: uploadedUrl, caption: caption.trim() || undefined })
      setCaption("")
      clearImage()
      toast.success("Posted!")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post")
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <div className="flex-1 space-y-3">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            className="block min-h-[60px] resize-none rounded-none border-none bg-transparent p-0 text-base leading-relaxed shadow-none focus-visible:ring-0 md:text-base"
            maxLength={2200}
          />

          {preview ? (
            <div className="relative w-full overflow-hidden rounded-lg border border-border">
              <img src={preview || "/placeholder.svg"} alt="Selected preview" className="max-h-96 w-full object-cover" />
              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                </div>
              ) : null}
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
                aria-label="Remove image"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="sr-only" id="post-image" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-primary"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden />
              Photo
            </Button>
            <Button type="button" onClick={submit} disabled={posting || uploading || !uploadedUrl} className="gap-2">
              {posting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
