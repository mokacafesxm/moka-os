"use client";

import { useParams } from "next/navigation";
import WorkflowRunner from "../../../components/workflows/WorkflowRunner";
import { WORKFLOWS } from "../../../components/workflows/definitions";

export default function WorkflowPage() {
  const { id } = useParams();
  const workflow = WORKFLOWS[id];

  if (!workflow) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-center px-4" style={{ background: "#f7efe4" }}>
        <p className="text-sm text-[#9a7060] font-semibold">Workflow introuvable : {id}</p>
      </div>
    );
  }

  return <WorkflowRunner workflow={workflow} />;
}
