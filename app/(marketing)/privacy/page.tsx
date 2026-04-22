import config from "@/config";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="container max-w-3xl py-16 prose dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <p>
        {config.appName} collects the minimum data needed to provide the service. Replace this
        page with your real privacy policy before shipping to production.
      </p>
      <h2>Data we collect</h2>
      <ul>
        <li>Account information (email, name) via Clerk</li>
        <li>Billing information via Stripe</li>
        <li>Product usage analytics via PostHog</li>
      </ul>
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
