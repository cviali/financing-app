"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/format";
import type { PettyCashMutation, Project } from "@repo/shared";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<(Project & { pettyCashBalance: number }) | null>(null);
  const [mutations, setMutations] = useState<PettyCashMutation[]>([]);

  useEffect(() => {
    Promise.all([api.projects.get(id), api.projects.pettyCash(id)]).then(([p, pc]) => {
      setProject(p.data);
      setMutations(pc.data.mutations);
    });
  }, [id]);

  if (!project) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-sm text-gray-500">{project.code}</p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm inline-block">
        <p className="text-sm text-gray-500">Petty Cash Balance</p>
        <p className="text-3xl font-bold mt-1">{formatIDR(project.pettyCashBalance)}</p>
        <a
          href={api.exports.projectPettyCash(id)}
          download
          className="mt-3 inline-block text-sm text-blue-600 hover:underline"
        >
          Export to Excel
        </a>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Mutation History</h2>
        {mutations.length === 0 ? (
          <p className="text-sm text-gray-400">No petty cash mutations yet.</p>
        ) : (
          <div className="overflow-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {["Date", "Direction", "Amount", "Balance After", "Note"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {mutations.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${m.direction === "in" ? "text-green-600" : "text-red-600"}`}>
                        {m.direction === "in" ? "▲ IN" : "▼ OUT"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-right">{formatIDR(m.amountIdr)}</td>
                    <td className="px-4 py-3 tabular-nums text-right">{formatIDR(m.balanceAfterIdr)}</td>
                    <td className="px-4 py-3 text-gray-500">{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
