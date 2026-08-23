import { PropsWithChildren, createContext } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { getDataProvider } from "@/data/provider";
import { DataProvider } from "@/types";

export const DataContext = createContext<DataProvider | null>(null);

export function AppProviders({ children }: PropsWithChildren) {
  const dataProvider = getDataProvider();

  return (
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={dataProvider}>
        {children}
      </DataContext.Provider>
    </I18nextProvider>
  );
}
