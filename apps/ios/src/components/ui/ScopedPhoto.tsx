import { useEffect, useState } from "react";
import { Image, type ImageProps, type ImageURISource } from "react-native";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import { isScopedPhoto } from "@/lib/photos";

export function ScopedPhoto({ uri, ...props }: Omit<ImageProps, "source"> & { uri: string }) {
  const [photo, setPhoto] = useState<{ path: string; source: ImageURISource }>();
  useEffect(() => {
    if (!isScopedPhoto(uri)) return;
    let active = true;
    const bucket = storage().app.options.storageBucket;
    auth().currentUser?.getIdToken().then(token => {
      if (active && bucket) setPhoto({ path: uri, source: {
        uri: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(uri)}?alt=media`,
        headers: { Authorization: `Firebase ${token}` },
        cache: "reload",
      } });
    }).catch(() => {});
    return () => { active = false; };
  }, [uri]);
  const source = isScopedPhoto(uri) ? (photo?.path === uri ? photo.source : undefined) : { uri };
  return <Image {...props} source={source} />;
}
