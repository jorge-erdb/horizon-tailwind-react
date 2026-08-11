import React, { Suspense, lazy, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import Landing from "views/landing";
import ProtectedRoute from "components/auth/ProtectedRoute";
import RouteFallback from "components/common/RouteFallback";
import { AuthProvider } from "contexts/AuthContext";
import { WorkspaceProvider } from "contexts/WorkspaceContext";
import QueryCacheReset from "components/common/QueryCacheReset";
import { createQueryClient } from "lib/queryClient";

// The landing page is the first thing most visitors load, and it needs none
// of the dashboard's weight — ApexCharts alone is a few hundred KB. Splitting
// the authenticated areas keeps them out of the initial bundle.
const AdminLayout = lazy(() => import("layouts/admin"));
const AuthLayout = lazy(() => import("layouts/auth"));

const App = () => {
  // Created once per mount rather than at module scope, so the cache can't
  // outlive the app across a hot reload and hand back another user's rows.
  const [queryClient] = useState(createQueryClient);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <QueryCacheReset />
        {/* Inside AuthProvider: the active workspace is derived from the
            signed-in user's memberships. */}
        <WorkspaceProvider>
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
        </WorkspaceProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
};

export default App;
