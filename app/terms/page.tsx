import React from "react";
import Link from "next/link";

const TermsPage = () => {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-white">
            Terms & Conditions
          </h1>
          <p className="text-sm text-zinc-400">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using this application, you agree to be bound by
            these Terms and Conditions. If you do not agree, please do not use
            the service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            2. User Accounts
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your
            account and for all activities that occur under your account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            3. Acceptable Use
          </h2>
          <p>
            You agree not to misuse the service, attempt unauthorized access,
            or violate any applicable laws.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            4. Termination
          </h2>
          <p>
            We reserve the right to suspend or terminate access to the service
            at any time without notice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            5. Contact
          </h2>
          <p>
            If you have any questions about these Terms, contact us at
            <span className="text-white"> support@vibex.com</span>.
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

export default TermsPage;
