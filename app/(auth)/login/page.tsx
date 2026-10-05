import React from "react";
import { LoginForm } from "./LoginForm";

interface LoginPageProps {
  searchParams?: {
    next?: string;
  };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="w-full max-w-[400px] rounded-panel border border-line bg-glass p-6 md:p-8 backdrop-blur-[14px] shadow-soft">
      {/* Logo gradient teal -> orange */}
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal via-teal-dark to-orange text-white shadow-md font-black text-xl mb-4">
          W
        </div>
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-ink">
          Masuk ke My Workspace
        </h1>
        <p className="mt-1.5 text-xs md:text-sm text-mute">
          Pusat kendali pekerjaan dan informasi pribadimu.
        </p>
      </div>

      <LoginForm nextParam={searchParams?.next} />
    </main>
  );
}
