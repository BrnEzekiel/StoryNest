import React, { createContext, useContext, useState, useCallback } from "react";
import { NoticeModal, NoticeAction, NoticeVariant } from "../components/NoticeModal";

export interface NoticePayload {
  title: string;
  message?: string;
  variant?: NoticeVariant;
  actions?: NoticeAction[];
}

interface NoticeContextType {
  /** Show a branded in-app notice. Replaces Alert.alert everywhere. */
  showNotice: (payload: NoticePayload) => void;
  dismissNotice: () => void;
}

const NoticeContext = createContext<NoticeContextType>({
  showNotice: () => {},
  dismissNotice: () => {},
});

export const NoticeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notice, setNotice] = useState<NoticePayload | null>(null);

  const showNotice = useCallback((payload: NoticePayload) => {
    setNotice(payload);
  }, []);

  const dismissNotice = useCallback(() => {
    setNotice(null);
  }, []);

  return (
    <NoticeContext.Provider value={{ showNotice, dismissNotice }}>
      {children}
      <NoticeModal
        visible={!!notice}
        title={notice?.title || ""}
        message={notice?.message}
        variant={notice?.variant}
        actions={notice?.actions}
        onDismiss={dismissNotice}
      />
    </NoticeContext.Provider>
  );
};

export const useNotice = () => useContext(NoticeContext);
