import { useState } from "react";
import { Button, PhotoLightbox } from "@mango/web";
import { petPhotos } from "./_fixtures";

/** Open on the 2nd of 3 photos — dots + "2 / 3" counter render only when there is more than one photo. */
export const Gallery = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[460px]">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        看照片
      </Button>
      <PhotoLightbox photos={petPhotos} initialIdx={1} open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

/** With a download action in the toolbar. */
export const WithDownload = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[460px]">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        看照片
      </Button>
      <PhotoLightbox
        photos={petPhotos}
        initialIdx={0}
        open={open}
        onClose={() => setOpen(false)}
        downloadAction={{ label: "儲存到相簿", busyLabel: "儲存中…", onClick: async () => {} }}
      />
    </div>
  );
};

/** Single photo — no dots, no counter. */
export const Single = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[460px]">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        看照片
      </Button>
      <PhotoLightbox photos={[petPhotos[2]]} initialIdx={0} open={open} onClose={() => setOpen(false)} />
    </div>
  );
};
