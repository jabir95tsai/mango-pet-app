"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RestaurantReviewInput } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: RestaurantReviewInput) => Promise<void>;
};

export function ReviewFormDialog({ open, onClose, onSubmit }: Props) {
  const tC = useTranslations("Common");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRating(5);
      setText("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("請寫些評論內容");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ rating, text: text.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="寫評論">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FieldLabel>評分</FieldLabel>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                className="p-1"
              >
                <Star
                  className={cn(
                    "size-7",
                    n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel>評論</FieldLabel>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="寵物可以進室內嗎? 服務態度如何? 適合大型犬嗎?"
            rows={4}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tC("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "..." : tC("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
