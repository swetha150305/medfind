import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "../services/api";

export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: any) {
      setError(err.message || "Could not reset the password.");
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
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Choose a new password</h2>
        </div>

        {!token ? (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-xs">
              This reset link is incomplete. Please request a new one.
            </div>
            <Link to="/forgot-password" className="block text-center text-teal-600 hover:text-teal-700 font-bold underline text-xs">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-xs">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <span>Password updated. Taking you to the login page...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-700 text-xs">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">New password</label>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">Confirm new password</label>
              <input
                type="password"
                placeholder="Type it again"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? "Saving..." : "Reset password"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
