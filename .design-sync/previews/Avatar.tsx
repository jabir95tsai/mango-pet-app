import { Avatar } from "@mango/web";
import { petPhotos } from "./_fixtures";

/** Size axis with initials — the fallback when there's no photo (initials + a name-hashed pastel). */
export const Sizes = () => (
  <div className="flex items-end gap-4">
    <Avatar name="芒果" size={24} />
    <Avatar name="芒果" size={32} />
    <Avatar name="芒果" size={40} />
    <Avatar name="芒果" size={56} />
    <Avatar name="芒果" size={80} />
  </div>
);

/** Photo avatars (`src`) — the image fills the circle with object-cover. */
export const WithPhoto = () => (
  <div className="flex items-end gap-4">
    <Avatar src={petPhotos[0]} name="芒果" size={40} />
    <Avatar src={petPhotos[1]} name="芒果" size={56} />
    <Avatar src={petPhotos[2]} name="芒果" size={80} />
  </div>
);

/** Initials + the six name-hashed background colours (colour is stable per name). */
export const InitialsPalette = () => (
  <div className="flex items-center gap-3">
    <Avatar name="Mango Tsai" size={44} />
    <Avatar name="Jabir" size={44} />
    <Avatar name="小白" size={44} />
    <Avatar name="Luna Park" size={44} />
    <Avatar name="Coco" size={44} />
    <Avatar name="Biscuit Lee" size={44} />
    <Avatar size={44} />
  </div>
);

/** Inside a list row — avatar + text, the common pets/friends composition. */
export const InListRow = () => (
  <div className="flex w-80 items-center gap-3 rounded-[var(--radius-lg)] border border-mango-hairline bg-mango-card p-3">
    <Avatar src={petPhotos[0]} name="芒果" size={48} />
    <div className="min-w-0">
      <div className="font-semibold text-mango-ink">芒果</div>
      <div className="text-sm text-mango-ink-2">柴犬 · 3 歲</div>
    </div>
  </div>
);
