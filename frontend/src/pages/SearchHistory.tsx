import React, { useState, useEffect } from "react";
import { History, Search, Calendar, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import type { SearchHistoryItem } from "../services/api";

export const SearchHistory: React.FC = () => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSearchHistory();
      setHistory(data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleString();
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">User Search History</h1>
          <p className="text-slate-500 text-sm mt-1">Review search logs tracked for auditing and query history verification.</p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={isLoading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl border border-slate-200 transition-colors"
          title="Refresh Logs"
        >
          <RefreshCw className={`h-4.5 w-4.5 ${isLoading ? 'animate-spin text-primary-500' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm text-slate-400 gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary-500" />
          <span className="text-xs font-semibold">Retrieving query logs...</span>
        </div>
      ) : history.length > 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {history.map((item, idx) => (
              <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-50 text-primary-600 p-2 rounded-xl">
                    <Search className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-slate-800 text-sm">{item.medicine_name}</h3>
                    <p className="text-slate-400 text-[10px] font-semibold flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatTimestamp(item.search_time)}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] font-extrabold text-slate-300">
                  #{history.length - idx}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm text-slate-400 text-center min-h-[300px]">
          <History className="h-10 w-10 text-slate-300 mb-3 animate-pulse" />
          <h3 className="font-bold text-slate-800 text-sm">No Search Records Found</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-xs">
            Query history is currently empty. Run searches on the Find Medicine page or scan prescriptions to build history records.
          </p>
        </div>
      )}
    </div>
  );
};
export default SearchHistory;
