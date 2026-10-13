import { useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import { getPalette, type Palette } from "../theme/palette";

export const useTheme = (): { C: Palette; isDark: boolean } => {
  const theme = useSelector((s: RootState) => s.theme.theme);
  const isDark = theme === "dark";
  return { C: getPalette(isDark), isDark };
};
