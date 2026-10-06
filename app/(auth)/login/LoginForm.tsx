"use client";

import React, { useState } from "react";
import { signIn } from "@/lib/actions/auth";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

interface LoginFormProps {
  nextParam?: string;
}

export function LoginForm({ nextParam }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    if (nextParam) {
      formData.set("next", nextParam);
    }

    try {
      const result = await signIn(formData);
      if (result && result.error) {
        setErrorMessage(result.error);
        setIsLoading(false);
      }
    } catch {
      // Normal Next.js redirect navigation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email / Username Input */}
      <div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
            <Mail className="h-4 w-4" />
          </div>
          <input
            id="email"
            name="email"
            type="text"
            required
            autoFocus
            autoComplete="username email"
            placeholder="Email atau Username"
            disabled={isLoading}
            className="w-full h-12 rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-4 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:border-[#28849E] focus:outline-none focus:ring-1 focus:ring-[#28849E] transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Password Input */}
      <div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
            <Lock className="h-4 w-4" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Password"
            disabled={isLoading}
            className="w-full h-12 rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-11 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:border-[#28849E] focus:outline-none focus:ring-1 focus:ring-[#28849E] transition-all shadow-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#475569] transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Options Row: Ingat saya & Lupa password */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none text-[#64748B]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-[#CBD5E1] text-[#28849E] focus:ring-[#28849E]"
          />
          <span>Ingat saya</span>
        </label>
        <button
          type="button"
          onClick={() => alert("Silakan hubungi administrator workspace untuk reset password.")}
          className="font-medium text-[#28849E] hover:underline"
        >
          Lupa password?
        </button>
      </div>

      {/* Error Message Box */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600 animate-in fade-in"
        >
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        id="btn-login-submit"
        disabled={isLoading}
        className="flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-[#28849E] hover:bg-[#207289] active:bg-[#1a5e72] px-4 font-bold text-white shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-60 transition-all mt-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Memproses...</span>
          </>
        ) : (
          <>
            <span>Masuk</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Terms & Privacy Notice */}
      <div className="pt-6 text-center text-[11px] leading-relaxed text-[#94A3B8]">
        <p>Dengan melanjutkan, Anda menyetujui</p>
        <p className="mt-0.5">
          <span className="font-semibold text-[#28849E] hover:underline cursor-pointer">
            Syarat & Ketentuan
          </span>{" "}
          dan{" "}
          <span className="font-semibold text-[#28849E] hover:underline cursor-pointer">
            Kebijakan Privasi
          </span>
        </p>
      </div>
    </form>
  );
}
