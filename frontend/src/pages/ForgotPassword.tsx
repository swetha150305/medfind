import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, KeyRound, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "../services/api";

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Forgot password</h2>
          <p className="text-slate-500 text-xs">Enter your email and we will send you a link to reset your password.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-700 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {sent ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-emerald-800 text-xs leading-relaxed">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <span>
                If an account exists for <b>{email}</b>, a reset link is on its way. It works for 30 minutes. Check your spam folder too.
                If you normally sign in with Google, just use the "Continue with Google" button instead.
              </span>
            </div>
            <Link to="/login" className="block text-center text-teal-600 hover:text-teal-700 font-bold underline text-xs">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? "Sending..." : "Send reset link"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-xs text-slate-500">
              <Link to="/login" className="text-teal-600 hover:text-teal-700 font-bold underline">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
