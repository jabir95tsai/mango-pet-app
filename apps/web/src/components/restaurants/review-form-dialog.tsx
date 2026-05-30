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
  const tR = useTranslations("Restaurant.review");
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
      setError(tR("needText"));
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
    <Dialog open={open} onClose={onClose} title={tR("write")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FieldLabel>{tR("rating")}</FieldLabel>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} / 5`}
                aria-pressed={n === rating}
                className="size-10 grid place-items-center rounded-full hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
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
          <FieldLabel>{tR("text")}</FieldLabel>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tR("placeholder")}
            rows={4}
            maxLength={500}
          />
          <p className="text-[10px] text-zinc-400 self-end">
            {text.length}/500
          </p>
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
