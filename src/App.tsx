import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Sources from "@/pages/Sources";
import Settings from "@/pages/Settings";
import SkillsPage from "@/pages/context/SkillsPage";
import RulesPage from "@/pages/context/RulesPage";
import AgentsPage from "@/pages/context/AgentsPage";
import McpsPage from "@/pages/context/McpsPage";

function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/context/skills" element={<SkillsPage />} />
          <Route path="/context/rules" element={<RulesPage />} />
          <Route path="/context/agents" element={<AgentsPage />} />
          <Route path="/context/mcps" element={<McpsPage />} />
          <Route path="/configs" element={<Navigate to="/context/skills" replace />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
