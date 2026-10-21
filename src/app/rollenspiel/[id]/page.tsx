import { notFound } from "next/navigation";
import { RoleplayChat } from "@/components/RoleplayChat";
import { roleplaysById, scenarios } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return scenarios.map((s) => ({ id: s.roleplay.id }));
}

export default async function RoleplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!roleplaysById.has(id)) notFound();
  return <RoleplayChat id={id} />;
}
