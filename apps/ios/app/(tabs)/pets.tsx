import { PlaceholderScreen } from "@/components/placeholder-screen";
import { NO_PETS } from "@/lib/pets";

export default function PetsScreen() {
  // P0: NO_PETS is typed as readonly Pet[] from @mango/shared-types — this is
  // the iOS-side proof that the shared domain types resolve. Real pet queries
  // arrive in P2.
  const count = NO_PETS.length;
  return (
    <PlaceholderScreen
      emoji="🐾"
      title="寵物"
      subtitle={`P2 會接上寵物列表（目前 ${count} 隻）`}
    />
  );
}
