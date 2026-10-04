import React, { useState, useEffect } from "react";
import { Upload, Database, CheckCircle, AlertTriangle, AlertCircle, ArrowRight, RefreshCw, X, Table } from "lucide-react";
import { api } from "../services/api";

export const DatasetUpload: React.FC = () => {
  // Upload flow states
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mappingRequired, setMappingRequired] = useState(false);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Summary statistics state
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrorMsg("");
      setMappingRequired(false);
      setImportResult(null);
    }
  };

  // Perform upload
  const handleUpload = async (e?: React.FormEvent, customMapping?: Record<string, string>) => {
    if (e) e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await api.uploadDataset(file, customMapping);
      
      if (res.status === "mapping_required") {
        setMappingRequired(true);
        setAllColumns(res.all_columns || []);
        
        // Initialize mapping dropdowns with detected columns
        const initialMapping: Record<string, string> = {};
        const expectedFields = [
          "medicine_name", "brand_name", "salt_composition", "strength",
          "dosage_form", "therapeutic_class", "price", "stock_quantity",
          "availability", "pharmacy_name", "pharmacy_address", "latitude",
          "longitude", "city", "district", "state", "phone"
        ];
        
        expectedFields.forEach(field => {
          initialMapping[field] = res.detected_columns[field] || "";
        });
        
        setMapping(initialMapping);
      } else if (res.status === "success") {
        setImportResult(res);
        setMappingRequired(false);
        setFile(null);
        fetchStats(); // Update database stats
      } else {
        setErrorMsg(res.message || "Failed to process dataset file.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to connect to dataset upload service.");
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm Custom Mapping
  const handleConfirmMapping = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out unmapped keys (except required ones)
    const finalMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([k, v]) => {
      if (v) finalMapping[k] = v;
    });

    // Check required fields are mapped
    const required = ["medicine_name", "salt_composition", "price", "pharmacy_name", "latitude", "longitude"];
    const missing = required.filter(f => !finalMapping[f]);
    if (missing.length > 0) {
      setErrorMsg(`Required fields mapping missing: ${missing.join(", ")}`);
      return;
    }

    handleUpload(undefined, finalMapping);
  };

  // Reset database to Initial Dataset
  const handleResetToDemo = async () => {
    setIsLoading(true);
    setErrorMsg("");
    setImportResult(null);
    setMappingRequired(false);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/dataset/reset", { method: "POST" });
      if (res.ok) {
        setImportResult({
          status: "success",
          records_imported: 7,
          total_medicines: 7,
          total_pharmacies: 4,
          message: "Database reset to Initial Dataset."
        });
        fetchStats();
      } else {
        setErrorMsg("Failed to reset database to initial state.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to connect to reset service.");
    } finally {
      setIsLoading(false);
    }
  };

  const expectedFieldsConfig = [
    { name: "medicine_name", label: "Medicine Name (Req)", required: true },
    { name: "salt_composition", label: "Salt Composition (Req)", required: true },
    { name: "price", label: "Price / MRP (Req)", required: true },
    { name: "pharmacy_name", label: "Pharmacy Name (Req)", required: true },
    { name: "latitude", label: "Latitude Coordinate (Req)", required: true },
    { name: "longitude", label: "Longitude Coordinate (Req)", required: true },
    { name: "brand_name", label: "Brand Name", required: false },
    { name: "strength", label: "Strength", required: false },
    { name: "dosage_form", label: "Dosage Form", required: false },
    { name: "therapeutic_class", label: "Therapeutic Class", required: false },
    { name: "stock_quantity", label: "Stock Quantity", required: false },
    { name: "availability", label: "Availability Status", required: false },
    { name: "pharmacy_address", label: "Pharmacy Address", required: false },
    { name: "city", label: "City", required: false },
    { name: "district", label: "District", required: false },
    { name: "state", label: "State", required: false },
    { name: "phone", label: "Pharmacy Contact Phone", required: false },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dataset Upload &amp; Overwrite</h1>
        <p className="text-slate-500 text-sm mt-1">Upload CSV or Excel files. Dynamic mapper parses variations, validates schema properties, and clears old databases.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Stats & Upload Form (cols-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Current Db Summary */}
          {stats && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Database className="h-4 w-4 text-slate-400" /> Active Dataset Info
              </h2>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Dataset Source:</span>
                  <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] uppercase border ${
                    stats.is_synthetic
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-teal-50 text-teal-700 border-teal-200"
                  }`}>
                    {stats.is_synthetic ? "Initial Dataset" : "User Uploaded"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Medicines Imported:</span>
                  <span className="font-extrabold text-slate-800">{stats.total_medicines}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Pharmacies Loaded:</span>
                  <span className="font-extrabold text-slate-800">{stats.total_pharmacies}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Inventory Records:</span>
                  <span className="font-extrabold text-slate-800">{stats.total_records}</span>
                </div>
              </div>

              {stats.is_synthetic && (
                <p className="text-[10px] text-amber-700 bg-amber-50 p-3 border-l-2 border-amber-500 rounded-r-xl leading-relaxed">
                  <strong>Notice:</strong> MedFind is running on synthetic illustration data. Uploading your custom dataset will completely replace this database.
                </p>
              )}
            </div>
          )}

          {/* Upload card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary-500" /> Upload Database Sheet
            </h2>

            <form onSubmit={(e) => handleUpload(e)} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-2xl p-6 transition-colors bg-slate-50 flex flex-col items-center justify-center text-center cursor-pointer relative group">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Database className="h-10 w-10 text-slate-400 group-hover:text-primary-500 transition-colors mb-3" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">
                    {file ? file.name : "Select CSV / Excel Spreadsheet"}
                  </p>
                  <p className="text-[10px] text-slate-400">CSV or XLSX (Max 10MB)</p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 text-rose-600 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading || !file}
                  className="flex-grow bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Upload Dataset"}
                </button>
                
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  disabled={isLoading}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-colors text-xs"
                  title="Reset database to initial dataset"
                >
                  Reset Db
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column: Column Mapping & Validation Results (cols-7) */}
        <div className="lg:col-span-7">
          {isLoading ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center text-slate-400 gap-3 min-h-[350px]">
              <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">Processing Dataset Sheet</h3>
                <p className="text-slate-500 text-xs">Parsing file, checking coordinates and schema mappings...</p>
              </div>
            </div>
          ) : mappingRequired ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                    <Table className="h-5 w-5 text-indigo-500" /> Map Database Columns
                  </h3>
                  <p className="text-slate-500 text-xs">Your spreadsheet headers differ from standard MedFind schema. Map them manually below.</p>
                </div>
                <button
                  onClick={() => setMappingRequired(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmMapping} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-2">
                  {expectedFieldsConfig.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex justify-between">
                        <span>{field.label}</span>
                        {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <select
                        value={mapping[field.name] || ""}
                        onChange={(e) => setMapping(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold outline-none"
                      >
                        <option value="">-- Skip Field --</option>
                        {allColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  Confirm Mappings &amp; Import <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : importResult ? (
            <div className="space-y-6 animate-fade-in">
              {/* Success Result banner */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-teal-50 text-teal-600 p-2 rounded-2xl">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">Import Completed Successfully</h3>
                    <p className="text-slate-500 text-xs">A total of {importResult.records_imported} rows have been imported into the DB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center py-2 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Medicines</span>
                    <span className="text-lg font-black text-slate-800">{importResult.total_medicines || importResult.records_imported}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Pharmacies</span>
                    <span className="text-lg font-black text-slate-800">{importResult.total_pharmacies || 4}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Records</span>
                    <span className="text-lg font-black text-slate-800">{importResult.records_imported}</span>
                  </div>
                </div>
              </div>

              {/* Validation reports Table */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-rose-600">
                    <AlertTriangle className="h-4.5 w-4.5" /> Validation Errors Log ({importResult.error_count} rows skipped)
                  </h3>
                  <p className="text-slate-500 text-xs">The following rows contain invalid data properties and were skipped during import.</p>
                  
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left text-xs divide-y divide-slate-100">
                      <thead className="bg-slate-50 text-slate-500 font-bold">
                        <tr>
                          <th className="p-3">Row</th>
                          <th className="p-3">Medicine</th>
                          <th className="p-3">Specific Failures</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {importResult.errors.map((err: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-slate-400">Row {err.row}</td>
                            <td className="p-3 font-semibold">{err.medicine}</td>
                            <td className="p-3 text-[10px] text-rose-600 leading-snug">
                              <ul className="list-disc list-inside">
                                {err.errors.map((e: string, i: number) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm text-slate-400 text-center min-h-[350px]">
              <Database className="h-10 w-10 text-slate-300 mb-3 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-sm">Waiting for Import Actions</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                Upload a spreadsheet from the left panel to trigger column mapping, schema structure audits, and records preview.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
export default DatasetUpload;
