import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export default function WelcomeEmail({ name, appName = "Magic Create" }: { name?: string | null; appName?: string }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to {appName}</Preview>
      <Body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: "#f6f9fc", padding: "40px 0" }}>
        <Container style={{ background: "#fff", borderRadius: 8, padding: 32, maxWidth: 560, margin: "0 auto" }}>
          <Heading>Welcome{name ? `, ${name}` : ""}</Heading>
          <Section>
            <Text>Thanks for joining {appName}. Here's what you can do next:</Text>
            <Text>- Create your first project</Text>
            <Text>- Chat with the AI assistant</Text>
            <Text>- Invite a teammate</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
