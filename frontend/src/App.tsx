import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Navbar } from "./components/Navbar";
import { LanguageProvider } from "./context/LanguageContext";
import { Dashboard } from "./pages/Dashboard";
import { MedicineSearch } from "./pages/MedicineSearch";
import { PrescriptionOCR } from "./pages/PrescriptionOCR";
import { SearchHistory } from "./pages/SearchHistory";
import { DatasetUpload } from "./pages/DatasetUpload";
import { SystemAnalytics } from "./pages/SystemAnalytics";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";

// ProtectedRoute Guard Component
interface ProtectedRouteProps {
  user: any;
  allowedRoles?: string[];
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, allowedRoles, children }) => {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="h-16 w-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-4 border border-rose-100">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Access Denied</h2>
        <p className="text-slate-500 text-xs mt-2 max-w-sm leading-relaxed">
          Your account does not have administrative privileges to configure ML algorithms or upload dataset tables.
          Please log in as an administrator.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("medfind_user");
      return saved && saved !== "undefined" ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn("Failed to parse cached user session:", e);
      return null;
    }
  });

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    localStorage.setItem("medfind_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("medfind_user");
  };

  return (
    <LanguageProvider>
      <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 selection:bg-teal-500 selection:text-white">
        {/* Navigation header */}
        <Navbar user={user} onLogout={handleLogout} />

        {/* Main application content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<MedicineSearch />} />
            <Route path="/ocr" element={<PrescriptionOCR />} />
            
            {/* Authentication Routes */}
            <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
            <Route path="/signup" element={<Signup onLoginSuccess={handleLoginSuccess} />} />

            {/* Authenticated User Routes */}
            <Route
              path="/history"
              element={
                <ProtectedRoute user={user}>
                  <SearchHistory />
                </ProtectedRoute>
              }
            />

            {/* Administrator Config Module Routes */}
            <Route
              path="/admin/upload"
              element={
                <ProtectedRoute user={user} allowedRoles={["admin"]}>
                  <DatasetUpload />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute user={user} allowedRoles={["admin"]}>
                  <SystemAnalytics />
                </ProtectedRoute>
              }
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer with safety warning */}
        <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              MedFind System &copy; 2026
            </p>
            <p className="text-[10px] text-slate-600 max-w-2xl mx-auto">
              Suggested alternatives are for demonstration purposes only. Final drug dispensing and brand substitution 
              requires direct review and authorization from a qualified healthcare professional.
            </p>
          </div>
        </footer>
      </div>
      </Router>
    </LanguageProvider>
  );
};

export default App;
