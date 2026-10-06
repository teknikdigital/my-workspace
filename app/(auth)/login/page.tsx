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
    <main className="w-full max-w-[430px] rounded-[30px] border border-white/80 bg-white p-7 sm:p-9 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-7">
        <div className="relative h-10 w-10 shrink-0">
          <Image
            src="/logomyworkspace.png"
            alt="My Workspace Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#132B45] leading-snug">
            My Workspace
          </h2>
          <p className="text-[12px] text-[#7B92A8] font-normal leading-none mt-0.5">
            Satu tempat untuk semua yang penting
          </p>
        </div>
      </div>

      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight text-[#132B45]">
          Selamat Datang!
        </h1>
        <p className="text-[13px] text-[#7B92A8] font-normal mt-1 leading-normal">
          Masuk ke akun Anda untuk melanjutkan ke My Workspace.
        </p>
      </div>

      {/* Login Form */}
      <LoginForm nextParam={searchParams?.next} />
    </main>
  );
}
