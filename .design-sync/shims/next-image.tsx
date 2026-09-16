// design-sync shim: `next/image` outside the Next.js runtime.
// Avatar renders <Image fill unoptimized>; outside Next there is no image
// optimizer or config context, so map it to a plain <img> that honours `fill`
// the way next/image does (absolute, inset:0, object-fit via className).
// Bundle-only substitution — apps/web itself still uses the real next/image.
import { forwardRef, type ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  unoptimized?: boolean;
  priority?: boolean;
  quality?: number;
  loader?: unknown;
  placeholder?: string;
  blurDataURL?: string;
};

const Image = forwardRef<HTMLImageElement, Props>(function NextImageShim(
  { fill, unoptimized, priority, quality, loader, placeholder, blurDataURL, style, ...rest },
  ref,
) {
  const fillStyle = fill
    ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" }
    : undefined;
  return <img ref={ref} style={{ ...fillStyle, ...style }} {...rest} />;
});

export default Image;
