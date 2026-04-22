import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export default function SubscriptionCancelledEmail() {
  return (
    <Html>
      <Head />
      <Preview>Your subscription was cancelled</Preview>
      <Body style={{ fontFamily: "-apple-system, sans-serif", padding: 32 }}>
        <Container>
          <Heading>We're sorry to see you go</Heading>
          <Text>Your subscription has been cancelled. You'll retain access until the end of the current billing period.</Text>
        </Container>
      </Body>
    </Html>
  );
}
