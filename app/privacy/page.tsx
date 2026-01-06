import React from "react";
import Link from "next/link";

const PrivacyPage = () => {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-white">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-400">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </header>

        {/* Content */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            1. Information We Collect
          </h2>
          <p>
            When you sign in using third-party providers such as Google or GitHub,
            we may collect basic profile information including your name, email
            address, and profile image.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            2. How We Use Your Information
          </h2>
          <p>
            We use your information solely to authenticate you, manage your
            account, and improve the functionality and security of the
            application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            3. Data Storage & Security
          </h2>
          <p>
            Your data is stored securely using industry-standard practices.
            We do not sell, rent, or share your personal information with
            third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            4. Cookies & Sessions
          </h2>
          <p>
            We use cookies and session storage only for authentication and
            security purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            5. Your Rights
          </h2>
          <p>
            You may request access to or deletion of your personal data
            at any time.
          </p>
        </section>

        {/* Back button at the END */}
        <div className="pt-8 border-t border-zinc-800">
          <Link
            href="/auth/sign-in"
            className="inline-flex items-center text-sm text-zinc-400 hover:text-white transition"
          >
            ← Back to Sign In
          </Link>
        </div>

      </div>
    </main>
  );
};

export default PrivacyPage;
