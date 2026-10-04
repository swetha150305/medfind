import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart2, Activity, MapPin, Database, Award, RefreshCw } from "lucide-react";
import { api } from "../services/api";

export const SystemAnalytics: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Theme colors
  const PIE_COLORS = ["#0d9488", "#f43f5e"]; // Teal for available, rose for out of stock
  const BAR_COLORS = ["#0d9488", "#0f766e", "#115e59", "#134e4a", "#6366f1", "#4f46e5", "#4338ca", "#3730a3"];

  const availabilityPieData = stats
    ? [
        { name: "Available", value: stats.available_medicines },
        { name: "Out of Stock", value: stats.out_of_stock_medicines },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Statistics &amp; Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time visualizations of medicine distributions, pharmacy coverages, and pricing tiers in the database.</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl border border-slate-200 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={`h-4.5 w-4.5 ${isLoading ? 'animate-spin text-primary-500' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm text-slate-400 gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary-500" />
          <span className="text-xs font-semibold">Compiling database aggregations...</span>
        </div>
      ) : stats ? (
        <div className="space-y-8 animate-fade-in">
          
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
              <div className="bg-teal-50 text-teal-600 p-3 rounded-xl">
                <Database className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Medicines</span>
                <span className="text-xl font-black text-slate-800">{stats.total_medicines}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Pharmacies Loaded</span>
                <span className="text-xl font-black text-slate-800">{stats.total_pharmacies}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
              <div className="bg-teal-50 text-teal-600 p-3 rounded-xl">
                <Activity className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">In-Stock Records</span>
                <span className="text-xl font-black text-slate-800">{stats.available_medicines}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl">
                <Award className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Out-of-Stock Records</span>
                <span className="text-xl font-black text-slate-800">{stats.out_of_stock_medicines}</span>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. Medicines by class */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Medicines by Therapeutic Class (Top 8)</h3>
              <div className="h-[240px]">
                {stats.medicines_by_class && stats.medicines_by_class.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.medicines_by_class}
                      layout="vertical"
                      margin={{ top: 5, right: 10, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <YAxis dataKey="class_name" type="category" tick={{ fontSize: 9 }} width={100} stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {stats.medicines_by_class.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">Class data empty</div>
                )}
              </div>
            </div>

            {/* 2. Availability Ratio */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-800">Inventory Stock Availability Ratio</h3>
              <div className="h-[200px] flex items-center justify-center relative">
                {stats.available_medicines > 0 || stats.out_of_stock_medicines > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={availabilityPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {availabilityPieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Available</span>
                      <span className="text-2xl font-black text-slate-800">
                        {Math.round((stats.available_medicines / (stats.total_records || 1)) * 100)}%
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400">Inventory records empty</div>
                )}
              </div>
              <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                  <span>Available ({stats.available_medicines})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span>Out of Stock ({stats.out_of_stock_medicines})</span>
                </div>
              </div>
            </div>

            {/* 3. Price distribution */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Medicine MRP Tiers (Price Distribution)</h3>
              <div className="h-[220px]">
                {stats.price_distribution && stats.price_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.price_distribution}
                      margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="range" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">Price distribution empty</div>
                )}
              </div>
            </div>

            {/* 4. Pharmacies by city */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Pharmacy Coverage by City/Locality</h3>
              <div className="h-[220px]">
                {stats.pharmacy_by_city && stats.pharmacy_by_city.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.pharmacy_by_city}
                      margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="city" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">City coverage data empty</div>
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm text-slate-400 text-center min-h-[300px]">
          <BarChart2 className="h-10 w-10 text-slate-300 mb-3 animate-pulse" />
          <h3 className="font-bold text-slate-800 text-sm">Failed to Load Dashboard Stats</h3>
          <p className="text-slate-500 text-xs mt-1">Ensure the FastAPI backend server is active on port 8000 and has seeded databases.</p>
        </div>
      )}
    </div>
  );
};
export default SystemAnalytics;
