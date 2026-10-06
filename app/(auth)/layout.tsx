import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center md:justify-start p-4 sm:p-8 md:p-12 lg:p-16 bg-[url('/bagroundutamamyworkspace.png')] bg-cover bg-center bg-no-repeat">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-center md:justify-start">
        {children}
      </div>
    </div>
  );
}
