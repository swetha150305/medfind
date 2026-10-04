import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Upload, Sparkles, AlertCircle, Check, Edit2, Trash2, ArrowRight, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import type { OCRMatch } from "../services/api";
import { MedicalDisclaimer } from "../components/MedicalDisclaimer";

export const PrescriptionOCR: React.FC = () => {
  const navigate = useNavigate();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [mockText, setMockText] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [rawText, setRawText] = useState("");
  const [matches, setMatches] = useState<OCRMatch[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // Edit item index state
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrorMsg("");
    }
  };

  // Perform OCR Scan
  const handleOCRScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !mockText.trim()) {
      setErrorMsg("Please select a prescription file or enter mock handwritten text.");
      return;
    }

    setIsScanning(true);
    setErrorMsg("");
    setMatches([]);
    setRawText("");

    try {
      // If we don't have a file but have mock text, we supply a dummy empty file
      const uploadFile = file || new File([""], "mock_prescription.png", { type: "image/png" });
      const res = await api.processOCR(uploadFile, mockText.trim() || undefined);
      
      setRawText(res.raw_text);
      setMatches(res.matches || []);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to process OCR scan. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  // Confirm match
  const handleToggleConfirm = (index: number) => {
    setMatches((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, confirmed: !item.confirmed } : item))
    );
  };

  // Edit match text (user corrects spelling manually)
  const handleStartEdit = (index: number, currentText: string) => {
    setEditIndex(index);
    setEditText(currentText);
  };

  const handleSaveEdit = async (index: number) => {
    if (!editText.trim()) return;

    // We can run fuzzy matching on the server again for the newly edited text by calling a search
    // For simplicity, we search against medicines in the DB using the search API to find the best match
    try {
      const searchRes = await api.searchMedicines(editText);
      let matchedId = null;
      let matchedName = null;
      let conf = 0.0;

      if (searchRes.results && searchRes.results.length > 0) {
        const best = searchRes.results[0];
        matchedId = best.id;
        matchedName = best.medicine_name;
        conf = 100.0; // User edited manually, assume high confidence
      }

      setMatches((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                ocr_text: editText,
                matched_id: matchedId,
                matched_name: matchedName,
                confidence: conf,
                confirmed: matchedId !== null,
              }
            : item
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setEditIndex(null);
      setEditText("");
    }
  };

  // Remove match
  const handleRemoveMatch = (index: number) => {
    setMatches((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Go to search page for the first confirmed medicine
  const handleLookupConfirmed = () => {
    const confirmed = matches.filter((m) => m.confirmed && m.matched_name);
    if (confirmed.length === 0) return;
    
    // Redirect to Search page with medicine preselected or query pre-populated
    // In our simplified routing, we can pass it as a query param or session storage
    sessionStorage.setItem("ocr_search_term", confirmed[0].matched_name || "");
    navigate("/search");
  };

  const hasConfirmed = matches.some((m) => m.confirmed && m.matched_name);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Prescription Digitization via OCR</h1>
        <p className="text-slate-500 text-sm mt-1">Digitize handwritten doctor prescriptions, resolve spelling corrections with fuzzy matching, and locate pharmacies.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Upload and Settings (cols-5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-5">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary-500" /> Upload Prescription
            </h2>

            <form onSubmit={handleOCRScan} className="space-y-4">
              
              {/* File dropzone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-2xl p-6 transition-colors bg-slate-50 flex flex-col items-center justify-center text-center cursor-pointer relative group">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileText className="h-10 w-10 text-slate-400 group-hover:text-primary-500 transition-colors mb-3" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">
                    {file ? file.name : "Select Prescription File"}
                  </p>
                  <p className="text-[10px] text-slate-400">PDF, JPG, JPEG, or PNG (Max 5MB)</p>
                </div>
              </div>

              {/* Mock Input for local testing */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Text Input Sandbox</label>
                  <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">OCR Simulation</span>
                </div>
                <textarea
                  value={mockText}
                  onChange={(e) => setMockText(e.target.value)}
                  placeholder="Type mock prescription text here to test spelling match (e.g. 'Amoxcillin 500mg\nParcetamol 650')"
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                />
                <p className="text-[9px] text-slate-400 italic">
                  *If provided, this sandbox text will override the image file scanning. Perfect for testing spelling corrections.
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isScanning}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-2.5 rounded-xl shadow-md shadow-primary-500/10 flex items-center justify-center gap-2 transition-all duration-200 active:scale-98"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Digitizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Run OCR Analysis
                  </>
                )}
              </button>
            </form>
          </div>

          <MedicalDisclaimer compact />
        </div>

        {/* Right Col: Extracted Data & Corrections (cols-7) */}
        <div className="lg:col-span-7">
          {isScanning ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center text-slate-400 gap-3 min-h-[350px]">
              <div className="relative flex items-center justify-center">
                <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-primary-400 opacity-75"></div>
                <div className="relative rounded-full h-8 w-8 bg-primary-500 flex items-center justify-center text-white">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">Scanning Prescription</h3>
                <p className="text-slate-500 text-xs">Preprocessing image and running character match correction...</p>
              </div>
            </div>
          ) : rawText ? (
            <div className="space-y-6 animate-fade-in">
              
              {/* Raw OCR logs */}
              <div className="bg-slate-900 text-slate-300 rounded-3xl p-5 border border-slate-800 shadow-sm space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Raw Digitized Output</span>
                <pre className="text-xs font-mono font-medium whitespace-pre-line leading-relaxed max-h-[100px] overflow-y-auto pr-1">
                  {rawText}
                </pre>
              </div>

              {/* Extracted medicines table */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800">Extracted Medicine Candidates</h3>
                <p className="text-slate-500 text-xs">Verify the fuzzy matching suggestions below, make corrections if needed, and confirm.</p>
                
                <div className="space-y-3">
                  {matches.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.confirmed 
                          ? "bg-teal-50/15 border-teal-200" 
                          : "bg-white border-slate-100 shadow-sm"
                      }`}
                    >
                      {editIndex === idx ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-grow bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary-500/20"
                          />
                          <button
                            onClick={() => handleSaveEdit(idx)}
                            className="bg-primary-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditIndex(null)}
                            className="bg-slate-100 text-slate-600 font-bold text-xs px-3 py-1.5 rounded-xl"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono text-xs">OCR:</span>
                              <span className="text-slate-700 font-semibold text-xs italic">"{item.ocr_text}"</span>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-slate-500 font-bold text-xs">Match:</span>
                              {item.matched_name ? (
                                <span className="text-slate-800 font-extrabold text-sm">{item.matched_name}</span>
                              ) : (
                                <span className="text-slate-400 text-xs italic">No matching medicine found</span>
                              )}
                              {item.confidence > 0 && (
                                <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.2 border border-teal-100 rounded">
                                  {item.confidence}% confidence
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleConfirm(idx)}
                              disabled={!item.matched_name}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                item.confirmed
                                  ? "bg-teal-500 border-teal-500 text-white"
                                  : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                              }`}
                              title={item.confirmed ? "Confirmed" : "Confirm Match"}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStartEdit(idx, item.ocr_text)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                              title="Edit Spelling"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveMatch(idx)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Remove Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {hasConfirmed && (
                  <button
                    onClick={handleLookupConfirmed}
                    className="w-full bg-gradient-to-r from-primary-600 to-accent-500 hover:from-primary-700 hover:to-accent-600 text-white font-bold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all duration-300 active:scale-98"
                  >
                    Search Stock for Confirmed Medicines <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm text-slate-400 text-center min-h-[350px]">
              <FileText className="h-10 w-10 text-slate-300 mb-3 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-sm">Prescription Queue Empty</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                Select an image file or write mock handwritten logs in the left panel to scan for matching drug catalogs.
              </p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
export default PrescriptionOCR;
