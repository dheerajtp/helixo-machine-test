// Centred card for the empty, error and no-match states; children is the action button.
export function ListMessage({ heading, text, children }) {
  return (
    <s-section>
      <s-stack alignItems="center" gap="base" padding="large">
        <s-heading>{heading}</s-heading>
        <s-paragraph>{text}</s-paragraph>
        {children}
      </s-stack>
    </s-section>
  );
}
