import { useDocumentTitle } from "../lib/hooks";
import { LeashMark } from "../components/Logo";
import { ButtonLink } from "../components/ui";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="page notfound">
      <LeashMark size={96} />
      <h1>This page slipped its lead</h1>
      <p>There is nothing at this address. Go back to the start, or open the app.</p>
      <div className="row">
        <ButtonLink to="/" variant="primary">Home</ButtonLink>
        <ButtonLink to="/app">Open the app</ButtonLink>
        <ButtonLink to="/docs/overview">Docs</ButtonLink>
      </div>
    </div>
  );
}
