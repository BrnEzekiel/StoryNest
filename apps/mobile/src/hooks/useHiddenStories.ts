import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hidden:stories";

const readHidden = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** Story ids the user chose to hide from browse surfaces. Refreshes on focus. */
export const useHiddenStories = () => {
  const [hidden, setHidden] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setHidden(await readHidden());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const hide = useCallback(
    async (id: string) => {
      const next = [...hidden, id];
      setHidden(next);
      await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    },
    [hidden]
  );

  const unhide = useCallback(
    async (id: string) => {
      const next = hidden.filter((x) => x !== id);
      setHidden(next);
      await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    },
    [hidden]
  );

  return { hidden, hide, unhide, refresh };
};

export const getHiddenStories = readHidden;
