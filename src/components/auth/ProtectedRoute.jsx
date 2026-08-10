import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import NovaLogo from "components/brand/NovaLogo";

const ProtectedRoute = ({ children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-navy-900">
        <NovaLogo
          variant="mark"
          className="h-12 w-12 animate-pulse"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!session) {
    // Remember where they were headed so sign-in can send them back.
    return <Navigate to="/auth/sign-in" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
