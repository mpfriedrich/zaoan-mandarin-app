import { notFound } from "next/navigation";
import { LessonFlow } from "@/components/LessonFlow";
import { scenarios, scenariosById } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return scenarios.map((s) => ({ id: s.id }));
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!scenariosById.has(id)) notFound();
  return <LessonFlow id={id} />;
}
