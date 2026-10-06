import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[url('/bagroundutamamyworkspace.png')] bg-cover bg-center bg-no-repeat">
      <div className="w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
