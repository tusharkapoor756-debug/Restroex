// src/app/dashboard/ai/page.tsx
"use client";

import React, { useState } from "react";
import {
  Bot,
  Activity,
  Lightbulb,
  ScrollText,
  Settings2,
} from "lucide-react";
import { AiService } from "../../../lib/services/ai.service";
import { AiLog } from "../../../types";

type Tab = "employees" | "activity" | "suggestions" | "logs" | "config";

export default function AIPage() {
  const [activeTab, setActiveTab] = useState<Tab>("logs");
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await AiService.listLogs();
        setLogs(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "employees", label: "AI Employees", icon: <Bot className="h-3.5 w-3.5" /> },
    { id: "activity", label: "Activity Feed", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "suggestions", label: "AI Suggestions", icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { id: "logs", label: "System Logs", icon: <ScrollText className="h-3.5 w-3.5" /> },
    { id: "config", label: "Configuration", icon: <Settings2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">AI Engine</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Manage virtual AI employees, review their activity, apply suggestions, and configure behavior.
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-[#0e0f14]/60 border border-[#23242B] rounded-2xl w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#23242B]/50 border border-transparent"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab !== "logs" && (
          <div className="text-center py-12 text-slate-500 text-xs bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl">
            {activeTab} not implemented (Placeholder)
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400">System event logs</p>
            </div>

            <div className="bg-[#09090B] border border-[#23242B] rounded-2xl overflow-hidden font-mono text-xs">
              <div className="flex items-center px-4 py-2 bg-[#23242B]/40 border-b border-[#23242B]">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ml-1.5" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ml-1.5" />
                <span className="ml-2 text-[10px] text-slate-500">restroex-ai.log</span>
              </div>
              <div className="p-4 space-y-2 max-h-[55vh] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    {isLoading ? "Loading..." : "No logs available."}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#0e0f14]/80 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-[#23242B]">
                      <tr>
                        <th className="p-3 w-28">Timestamp</th>
                        <th className="p-3 w-32">Type</th>
                        <th className="p-3">Log Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23242B]/40">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/40 font-mono transition-colors">
                          <td className="p-3 text-slate-500">{log.createdAt}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.type === 'error' ? "bg-red-950/40 text-red-400 border border-red-900/50" : "bg-slate-900 text-slate-400 border border-slate-700"
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300">{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
