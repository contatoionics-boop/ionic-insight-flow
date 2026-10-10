import { useEffect } from "react";

// O sistema usa apenas o tema claro. O hook continua existindo para garantir que
// nenhuma preferência antiga (localStorage "ionics-theme" ou tema do sistema)
// reative o modo escuro.
const STORAGE_KEY = "ionics-theme";

export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);
}
