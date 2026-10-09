import { Suspense } from "react";
import { Editor } from "@/components/editor/Editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <Editor id={id} />
    </Suspense>
  );
}
