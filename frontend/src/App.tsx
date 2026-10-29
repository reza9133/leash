import { Suspense, lazy, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { PageLoader } from "./components/Spinners";
import Home from "./pages/Home";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Create = lazy(() => import("./pages/Create"));
const Mandate = lazy(() => import("./pages/Mandate"));
const Request = lazy(() => import("./pages/Request"));
const Explorer = lazy(() => import("./pages/Explorer"));
const Docs = lazy(() => import("./pages/Docs"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Scrolls to the top on a new page, but leaves the position alone when only the query string changes. */
function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    // docs pages scroll to their own anchors
    if (!pathname.startsWith("/docs")) window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ScrollManager />
      <Shell>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/new" element={<Create />} />
            <Route path="/app/mandates/:id" element={<Mandate />} />
            <Route path="/app/requests/:id" element={<Request />} />
            <Route path="/explore" element={<Explorer />} />
            <Route path="/docs" element={<Navigate to="/docs/overview" replace />} />
            <Route path="/docs/:slug/:anchor?" element={<Docs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Shell>
    </HashRouter>
  );
}
