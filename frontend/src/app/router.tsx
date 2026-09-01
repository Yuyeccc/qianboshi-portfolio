import type { ReactNode } from "react";
import { createHashRouter, Navigate } from "react-router-dom";
import SiteShell from "@/components/layout/SiteShell";
import OverviewPage from "@/pages/OverviewPage";
import ArchitecturePage from "@/pages/ArchitecturePage";
import DataAssetsPage from "@/pages/DataAssetsPage";
import DecisionDeskPage from "@/pages/DecisionDeskPage";
import DisciplinePage from "@/pages/DisciplinePage";
import AboutPage from "@/pages/AboutPage";
import BriefListPage from "@/pages/BriefListPage";
import BriefDetailPage from "@/pages/BriefDetailPage";
import ResearchVaultPage from "@/pages/ResearchVaultPage";
import AssetResearchDetailPage from "@/pages/AssetResearchDetailPage";
import CognitiveCorePage from "@/pages/CognitiveCorePage";

const locales = ["zh", "en"];

const localeRoute = (element: ReactNode) => ({
  path: ":locale",
  element,
  children: [
    { index: true, element: <OverviewPage /> },
    { path: "architecture", element: <ArchitecturePage /> },
    { path: "cognitive", element: <CognitiveCorePage /> },
    { path: "assets", element: <DataAssetsPage /> },
    { path: "decisions", element: <DecisionDeskPage /> },
    { path: "discipline", element: <DisciplinePage /> },
    { path: "vault", element: <ResearchVaultPage /> },
    { path: "vault/assets/:assetId", element: <AssetResearchDetailPage /> },
    { path: "about", element: <AboutPage /> },
    { path: "briefs", element: <BriefListPage /> },
    { path: "briefs/:filename", element: <BriefDetailPage /> },
  ],
});

export const router = createHashRouter([
  { path: "/", element: <Navigate to="/zh" replace /> },
  localeRoute(<SiteShell />),
  { path: "*", element: <Navigate to="/zh" replace /> },
]);

export { locales };
