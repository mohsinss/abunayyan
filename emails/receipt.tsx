import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export default function ReceiptEmail({ amount, currency }: { amount: number; currency: string }) {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  return (
    <Html>
      <Head />
      <Preview>Your receipt for {formatted}</Preview>
      <Body style={{ fontFamily: "-apple-system, sans-serif", padding: 32 }}>
        <Container>
          <Heading>Receipt</Heading>
          <Text>You were charged <strong>{formatted}</strong>.</Text>
          <Text>Manage your subscription from the billing portal at any time.</Text>
        </Container>
      </Body>
    </Html>
  );
}
