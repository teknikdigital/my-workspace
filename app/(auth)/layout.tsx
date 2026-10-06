import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-[url('/bagroundlogin.png')] bg-cover bg-center bg-no-repeat overflow-hidden">
      {/* Subtle glass overlay to keep contrast */}
      <div className="absolute inset-0 bg-gradient-to-tr from-sky-900/10 via-transparent to-teal/10 pointer-events-none" />
      <div className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between">
        {children}
      </div>
    </div>
  );
}
