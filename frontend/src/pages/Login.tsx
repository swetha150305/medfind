import React, { useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, AlertCircle, ArrowRight } from "lucide-react";
import { api } from "../services/api";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || "/";

  // Admin Google sign-in needs an emailed 6-digit code
  const [mfaEmail, setMfaEmail] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.googleAuth("", "", credential);
      if (res.status === "mfa_required" && res.email) {
        setMfaEmail(res.email);
      } else if (res.user) {
        onLoginSuccess(res.user);
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  }, [from, navigate, onLoginSuccess]);

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaEmail) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.verifyGoogleMFA(mfaEmail, mfaCode.trim());
      onLoginSuccess(res.user);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid or expired code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.login(email, password);
      onLoginSuccess(res.user);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 mb-1">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Login</h2>
          <p className="text-slate-500 text-xs">Enter your email and password to access MedFind.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-700 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="text-right -mt-2">
            <Link to="/forgot-password" className="text-xs text-teal-600 hover:text-teal-700 font-bold">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isLoading ? "Logging in..." : "Log In"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {mfaEmail ? (
          <form onSubmit={handleMfa} className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-600">
              Enter the 6-digit security code we emailed to <b>{mfaEmail}</b>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={isLoading || mfaCode.trim().length < 6}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl text-sm transition-all"
            >
              Verify code
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-400">
              <div className="h-px bg-slate-200 flex-1" /> or <div className="h-px bg-slate-200 flex-1" />
            </div>
            <GoogleSignInButton onCredential={handleGoogleCredential} />
          </div>
        )}

        <p className="text-center text-xs text-slate-500 pt-2">
          Don't have an account?{" "}
          <Link to="/signup" className="text-teal-600 hover:text-teal-700 font-bold underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
