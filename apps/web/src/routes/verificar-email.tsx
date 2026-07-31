import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/verificar-email")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/verificar-email"!</div>;
}
