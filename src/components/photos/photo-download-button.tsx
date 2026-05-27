"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
};

export function PhotoDownloadButton({
  label,
  disabled,
  busy,
  onClick,
  variant = "primary",
}: Props) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      variant={variant}
      size="md"
      className="min-h-11 w-full sm:w-auto"
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
