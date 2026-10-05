"use client";

import React, { useState } from "react";
import { signIn } from "@/lib/actions/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface LoginFormProps {
  nextParam?: string;
}

export function LoginForm({ nextParam }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      // If Next.js redirect happens, it might throw a NEXT_REDIRECT error in client transitions
      // which is normal navigation behavior.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {/* Email Input */}
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="nama@domain.com"
          disabled={isLoading}
          className="w-full h-11 rounded-btn border border-line bg-card/80 px-3.5 text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
        />
      </div>

      {/* Password Input with show/hide toggle */}
      <div>
        <label
          htmlFor="password"
          className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider"
        >
          Kata sandi
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={isLoading}
            className="w-full h-11 rounded-btn border border-line bg-card/80 px-3.5 pr-11 text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-mute hover:text-ink transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error Message Box */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-btn border border-red/20 bg-red/10 p-3 text-xs font-semibold text-red animate-in fade-in"
        >
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        id="btn-login-submit"
        disabled={isLoading}
        className="flex w-full h-11 items-center justify-center gap-2 rounded-btn bg-gradient-to-r from-teal to-teal-dark px-4 font-bold text-white shadow-soft hover:opacity-95 active:scale-[0.99] disabled:opacity-60 transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Memproses...</span>
          </>
        ) : (
          <span>Masuk</span>
        )}
      </button>
    </form>
  );
}
