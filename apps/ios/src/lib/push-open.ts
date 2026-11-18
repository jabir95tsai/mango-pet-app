/** Routes a tapped FCM push (server sends the web path in `data.url`) to the iOS screen. */
import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import type { Href } from "expo-router";

type PushData = Record<string, unknown> | undefined | null;

export function pushOpenRoute(data: PushData): Href | null {
  const url = typeof data?.url === "string" ? data.url.split(/[?#]/)[0].replace(/\/+$/, "") : "";
  const postId = typeof data?.postId === "string" ? data.postId : "";
  if (url === "/app") return "/(tabs)";
  if (url === "/app/walks") return "/(tabs)/walks";
  if (url === "/app/leaderboard") return "/(tabs)/leaderboard";
  if (url === "/app/achievements") return "/achievements";
  if (url === "/app/feed") return postId ? { pathname: "/feed", params: { postId } } : "/feed";
  if (url.startsWith("/app/pets")) return { pathname: "/(tabs)/pets", params: { tab: "reminders" } };
  return null;
}

// Foreground: show server pushes as banners; keep local walk-return reminders silent in-app (prior behaviour).
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const show = n.request.content.data?.kind !== "walk-return";
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

let lastOpen = { key: "", at: 0 };
let initialHandled = false;

/** expo-notifications and RNFB may both see the same tap (whichever owns the UNUserNotificationCenter delegate), so dedupe. */
export function listenPushOpen(open: (route: Href) => void): () => void {
  const accept = (data: PushData) => {
    const route = pushOpenRoute(data);
    if (!route) return false;
    const key = JSON.stringify(route);
    const now = Date.now();
    if (lastOpen.key === key && now - lastOpen.at < 3000) return true;
    lastOpen = { key, at: now };
    open(route);
    return true;
  };
  const fromResponse = (r: Notifications.NotificationResponse | null) => {
    if (!r) return;
    const content = r.notification.request.content.data as PushData;
    const payload = (r.notification.request.trigger as { payload?: PushData } | null)?.payload;
    if (accept(content?.url ? content : payload)) void Notifications.clearLastNotificationResponseAsync();
  };
  const expoSub = Notifications.addNotificationResponseReceivedListener(fromResponse);
  const unsubOpened = messaging().onNotificationOpenedApp((m) => accept(m.data));
  if (!initialHandled) {
    initialHandled = true; // getInitialNotification keeps returning the launch push for the whole process
    void messaging().getInitialNotification().then((m) => m && accept(m.data)).catch(() => undefined);
  }
  void Notifications.getLastNotificationResponseAsync().then(fromResponse).catch(() => undefined);
  return () => { expoSub.remove(); unsubOpened(); };
}
