/**
 * Inline paw glyph shared by the week strip and the recent-walk row — the
 * ellipse-based paw of web walks-week-strip.tsx / walk-row.tsx PawIcon (the
 * lucide PawPrint is chunkier than this redesign's paw).
 */
import Svg, { Ellipse, Path } from "react-native-svg";

export function PawIcon({ size = 16, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Ellipse cx={6.5} cy={9} rx={1.8} ry={2.3} />
      <Ellipse cx={17.5} cy={9} rx={1.8} ry={2.3} />
      <Ellipse cx={9.5} cy={5.5} rx={1.6} ry={2.1} />
      <Ellipse cx={14.5} cy={5.5} rx={1.6} ry={2.1} />
      <Path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z" />
    </Svg>
  );
}
