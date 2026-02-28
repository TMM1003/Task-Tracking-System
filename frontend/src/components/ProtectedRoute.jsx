import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="page-shell centered-shell">
        <div className="glass-panel loading-card">Restoring session...</div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
