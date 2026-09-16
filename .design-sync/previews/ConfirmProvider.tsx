import { useEffect } from "react";
import { Button, ConfirmProvider, useConfirm } from "@mango/web";

function ConfirmTrigger({ danger }: { danger: boolean }) {
  const confirm = useConfirm();
  const ask = () =>
    confirm(
      danger
        ? {
            title: "刪除寵物",
            message: "「芒果」的所有紀錄、提醒與照片都會一併刪除，且無法復原。",
            confirmText: "刪除",
            danger: true,
          }
        : {
            title: "結束遛狗？",
            message: "本次散步 1.8 公里、23 分鐘會被儲存。",
            confirmText: "結束並儲存",
            cancelText: "繼續走",
          },
    );
  // Open the dialog on mount so the card shows the confirm state.
  useEffect(() => {
    void ask();
  }, []);
  return (
    <div className="h-[420px]">
      <Button variant={danger ? "danger" : "primary"} onClick={ask}>
        {danger ? "刪除寵物" : "結束遛狗"}
      </Button>
    </div>
  );
}

/** Wrap a subtree in ConfirmProvider; children call `useConfirm()` and await a boolean. Danger variant. */
export const DangerConfirm = () => (
  <ConfirmProvider>
    <ConfirmTrigger danger />
  </ConfirmProvider>
);

/** Neutral confirmation with custom confirm/cancel text. */
export const NeutralConfirm = () => (
  <ConfirmProvider>
    <ConfirmTrigger danger={false} />
  </ConfirmProvider>
);
