import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Activity, Search, FileText, Database, BarChart2, History, Menu, X, LogIn, LogOut } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const userLinks = [
    { to: "/", label: t("dashboard"), icon: Activity },
    { to: "/search", label: t("findMedicine"), icon: Search },
    { to: "/ocr", label: t("prescriptionOcr"), icon: FileText },
    { to: "/history", label: t("searchHistory"), icon: History },
  ];

  const adminLinks = [
    { to: "/admin/upload", label: t("dataUpload"), icon: Database },
    { to: "/admin/analytics", label: t("systemAnalytics"), icon: BarChart2 },
  ];

  const activeStyle = "bg-primary-600 text-white shadow-md shadow-primary-500/20";
  const inactiveStyle = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-gradient-to-tr from-primary-600 to-accent-500 p-2 rounded-xl text-white shadow-md shadow-primary-500/30 group-hover:scale-105 transition-transform duration-300">
                <Activity className="h-6 w-6" />
              </div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-primary-700 to-accent-600 bg-clip-text text-transparent">
                MedFind
              </span>
            </Link>

            {/* Desktop User Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {/* Desktop Actions */}
              <div className="hidden lg:flex lg:items-center lg:gap-3 mr-2">
                {/* Language Selector Toggle */}
                <button
                  onClick={() => setLanguage(language === "en" ? "ta" : "en")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
                >
                  <span className="text-[10px]">🌐</span>
                  <span>{language === "en" ? "தமிழ்" : "English"}</span>
                </button>
              </div>
              {userLinks
                .filter((link) => link.to !== "/history" || user) // Only show history if authenticated
                .map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                          isActive ? activeStyle : inactiveStyle
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </NavLink>
                  );
                })}
            </div>
          </div>

          {/* Desktop Right Panel (Admin Nav & Auth Status) */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Admin Links (Only for Admins) */}
            {user?.role === "admin" && (
              <div className="flex items-center gap-1 border-l border-slate-200 pl-4 py-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2 pl-1">Admin</span>
                {adminLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                          isActive ? activeStyle : inactiveStyle
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </NavLink>
                  );
                })}
              </div>
            )}

            {/* Auth Profile / Login Button */}
            <div className="border-l border-slate-200 pl-4 flex items-center gap-3 my-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-800">{user.name}</span>
                    <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                      {user.role} ({user.provider})
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center font-bold text-xs text-primary-700">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="h-4.5 w-4.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                  >
                    <LogIn className="h-3.5 w-3.5 text-slate-400" />
                    {language === "en" ? "Sign In" : "உள்நுழை"}
                  </Link>
                  <Link
                    to="/signup"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all shadow-sm shadow-primary-500/10"
                  >
                    {language === "en" ? "Sign Up" : "பதிவுசெய்"}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white py-3 px-4 shadow-inner space-y-4">
          {/* Mobile Language Switcher */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {language === "en" ? "Language" : "மொழி"}
            </span>
            <button
              onClick={() => setLanguage(language === "en" ? "ta" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
            >
              <span className="text-[10px]">🌐</span>
              <span>{language === "en" ? "தமிழ்" : "English"}</span>
            </button>
          </div>

          {/* Mobile Profile Block */}
          <div className="pb-3 border-b border-slate-100">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center font-bold text-sm text-primary-700">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-800 block">{user.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wide">
                      {user.role} ({user.provider})
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setIsOpen(false);
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 transition"
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold transition-all"
                >
                  <LogIn className="h-4 w-4 text-slate-400" />
                  {language === "en" ? "Sign In" : "உள்நுழை"}
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-all shadow-sm shadow-primary-500/10"
                >
                  {language === "en" ? "Sign Up" : "பதிவுசெய்"}
                </Link>
              </div>
            )}
          </div>

          {/* User Links */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">
              {language === "en" ? "Navigation" : "வழிசெலுத்தல்"}
            </p>
            {userLinks
              .filter((link) => link.to !== "/history" || user)
              .map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-base font-semibold ${
                        isActive ? activeStyle : inactiveStyle
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </NavLink>
                );
              })}
          </div>

          {/* Admin Links */}
          {user?.role === "admin" && (
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">Admin Section</p>
              {adminLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-base font-semibold ${
                        isActive ? activeStyle : inactiveStyle
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
export default Navbar;
