import SignInFormClient from "@/modules/auth/components/sign-in-form-client";
import Image from "next/image";
import React from "react";

const Page = () => {
  return (
    <section className="flex flex-col items-center gap-6 text-center">
      
      {/* Illustration */}
      <Image
        src="/login.svg"
        alt="Login illustration"
        width={260}
        height={260}
        priority
        className="object-contain"
      />

      {/* Heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">
          Sign in to your account
        </h1>
        <p className="text-sm text-zinc-400">
          Choose your preferred sign-in method
        </p>
      </div>

      {/* Sign in form */}
      <SignInFormClient />
    </section>
  );
};

export default Page;
