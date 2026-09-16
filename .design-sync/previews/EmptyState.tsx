import { Button, EmptyState } from "@mango/web";
import { PawPrint, Footprints, Bell } from "lucide-react";

/** Icon + title + description + action — the full composition used on the pets tab. */
export const WithAction = () => (
  <div className="w-96">
    <EmptyState
      icon={PawPrint}
      title="還沒有寵物"
      description="新增你的第一隻毛孩，開始記錄健康、提醒與散步。"
      action={<Button>新增寵物</Button>}
    />
  </div>
);

/** Title and description only. */
export const TextOnly = () => (
  <div className="w-96">
    <EmptyState
      title="這週還沒有散步紀錄"
      description="完成一次散步後，統計會出現在這裡。"
    />
  </div>
);

/** Icon + title, no description — the terse variant used inside cards. */
export const IconAndTitle = () => (
  <div className="w-96">
    <EmptyState icon={Bell} title="沒有待辦提醒" />
  </div>
);

/** Secondary action button. */
export const SecondaryAction = () => (
  <div className="w-96">
    <EmptyState
      icon={Footprints}
      title="附近沒有好友在遛狗"
      description="邀請好友加入，一起看誰走得最多。"
      action={<Button variant="secondary">邀請好友</Button>}
    />
  </div>
);
