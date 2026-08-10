import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "views/landing";
import ProtectedRoute from "components/auth/ProtectedRoute";
import RouteFallback from "components/common/RouteFallback";
import { AuthProvider } from "contexts/AuthContext";

// The landing page is the first thing most visitors load, and it needs none
// of the dashboard's weight — ApexCharts alone is a few hundred KB. Splitting
// the authenticated areas keeps them out of the initial bundle.
const AdminLayout = lazy(() => import("layouts/admin"));
const AuthLayout = lazy(() => import("layouts/auth"));

const App = () => {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="auth/*" element={<AuthLayout />} />
          <Route
            path="admin/*"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
};

export default App;
