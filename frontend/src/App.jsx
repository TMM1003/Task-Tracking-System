import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";

function RootRedirect() {
  const { token } = useAuth();
  return <Navigate to={token ? "/app" : "/auth"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
