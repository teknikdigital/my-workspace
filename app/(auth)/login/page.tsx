import React from "react";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

interface LoginPageProps {
  searchParams?: {
    next?: string;
  };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      {/* Left Column: Login Card */}
      <div className="lg:col-span-5 w-full flex justify-center lg:justify-start">
        <main className="w-full max-w-[460px] rounded-[32px] border border-white/60 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] backdrop-blur-2xl transition-all">
          {/* Brand Header */}
          <div className="flex items-center gap-3.5 mb-8">
            <div className="relative h-11 w-11 shrink-0">
              <Image
                src="/logomyworkspace.png"
                alt="My Workspace Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#162a45] dark:text-white leading-tight">
                My Workspace
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Satu tempat untuk semua yang penting
              </p>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-1 mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#162a45] dark:text-white">
              Selamat Datang!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
              Masuk ke akun Anda untuk melanjutkan ke My Workspace.
            </p>
          </div>

          {/* Login Form */}
          <LoginForm nextParam={searchParams?.next} />
        </main>
      </div>

      {/* Right Column: Hero Branding (Matches reference image) */}
      <div className="hidden lg:flex lg:col-span-7 flex-col items-center justify-center p-8 text-center select-none">
        <div className="flex items-center gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md px-8 py-5 rounded-3xl border border-white/60 dark:border-white/10 shadow-lg">
          <div className="relative h-16 w-16 shrink-0">
            <Image
              src="/logomyworkspace.png"
              alt="My Workspace Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="text-left">
            <h2 className="text-3xl font-black tracking-tight text-[#162a45] dark:text-white">
              My Workspace
            </h2>
            <p className="text-sm font-semibold text-teal-800 dark:text-teal-200 mt-0.5">
              Satu tempat untuk semua yang penting
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
