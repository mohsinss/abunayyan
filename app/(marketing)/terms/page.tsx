import config from "@/config";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="container max-w-3xl py-16 prose dark:prose-invert">
      <h1>Terms of Service</h1>
      <p>Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <p>
        These placeholder terms apply to {config.appName}. Replace this page with your real
        terms before shipping to production.
      </p>
      <h2>Acceptance</h2>
      <p>By using {config.appName}, you agree to these terms.</p>
      <h2>Contact</h2>
      <p>
        Questions? Email{" "}
        <a href={`mailto:${config.email.supportEmail ?? "support@example.com"}`}>
          {config.email.supportEmail ?? "support@example.com"}
        </a>
        .
      </p>
    </article>
  );
}
