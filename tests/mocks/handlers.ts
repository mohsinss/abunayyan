import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("https://api.stripe.com/v1/checkout/sessions", () =>
    HttpResponse.json({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }),
  ),
  http.post("https://api.resend.com/emails", () =>
    HttpResponse.json({ id: "re_test_123" }),
  ),
  http.post("https://api.anthropic.com/v1/messages", () =>
    HttpResponse.json({
      id: "msg_test",
      role: "assistant",
      content: [{ type: "text", text: "Mocked response" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  ),
];
