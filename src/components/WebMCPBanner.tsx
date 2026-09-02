export function WebMCPBanner({ available }: { available: boolean }) {
  if (available) return null;
  return (
    <div className="banner" role="status">
      <span>⚠</span>
      <span>
        WebMCP isn't active in this browser. Every tool is still usable via the <strong>Simulated Agent</strong>{" "}
        panel in the sidebar. Try Chrome with <code>chrome://flags/#enable-webmcp-testing</code>, or ChatGPT's
        in-app browser, to drive this with a real agent.
      </span>
    </div>
  );
}
