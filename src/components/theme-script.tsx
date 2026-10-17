import { THEME_SCRIPT } from "./theme-toggle";

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
