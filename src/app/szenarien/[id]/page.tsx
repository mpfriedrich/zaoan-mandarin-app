import { notFound } from "next/navigation";
import { ScenarioDetail } from "@/components/ScenarioDetail";
import { scenarios, scenariosById } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return scenarios.map((s) => ({ id: s.id }));
}

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!scenariosById.has(id)) notFound();
  return <ScenarioDetail id={id} />;
}
