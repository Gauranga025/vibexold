import React from "react";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
      
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%)]" />

      {/* auth container */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900/80 backdrop-blur-xl shadow-2xl shadow-black/40 border border-zinc-800 px-8 py-10">
        {children}
      </div>

    </main>
  );
};

export default AuthLayout;
