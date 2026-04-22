export interface ConfigProps {
  appName: string;
  appDescription: string;
  domainName: string;
  stripe: {
    plans: ReadonlyArray<{
      tier: string;
      priceId: { dev: string; prod: string };
      name: string;
      description?: string;
      price: number;
      priceAnchor?: number;
      isFeatured?: boolean;
      features: ReadonlyArray<{ name: string }>;
    }>;
  };
  email: {
    from: string;
    supportEmail?: string;
  };
  auth: {
    signInUrl: string;
    signUpUrl: string;
    afterSignInUrl: string;
    afterSignUpUrl: string;
  };
}
