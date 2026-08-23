import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import SiteShell from "@/components/layout/SiteShell";
import OverviewPage from "@/pages/OverviewPage";
import ArchitecturePage from "@/pages/ArchitecturePage";
import DataAssetsPage from "@/pages/DataAssetsPage";
import DecisionDeskPage from "@/pages/DecisionDeskPage";
import DisciplinePage from "@/pages/DisciplinePage";
import AboutPage from "@/pages/AboutPage";
import BriefListPage from "@/pages/BriefListPage";
import BriefDetailPage from "@/pages/BriefDetailPage";

const locales = ["zh", "en"];

const localeRoute = (element: ReactNode) => ({
  path: ":locale",
  element,
  children: [
    { index: true, element: <OverviewPage /> },
    { path: "architecture", element: <ArchitecturePage /> },
    { path: "assets", element: <DataAssetsPage /> },
    { path: "decisions", element: <DecisionDeskPage /> },
    { path: "discipline", element: <DisciplinePage /> },
    { path: "about", element: <AboutPage /> },
    { path: "briefs", element: <BriefListPage /> },
    { path: "briefs/:filename", element: <BriefDetailPage /> },
  ],
});

export const router = createBrowserRouter(
  [
    { path: "/", element: <Navigate to="/zh" replace /> },
    localeRoute(<SiteShell />),
    { path: "*", element: <Navigate to="/zh" replace /> },
  ],
  { basename: import.meta.env.VITE_BASE_PATH || "/" },
);

export { locales };