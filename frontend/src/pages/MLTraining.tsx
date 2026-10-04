import React, { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, RefreshCw, BarChart2, TrendingUp, Cpu, Sliders } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { api } from "../services/api";

export const MLTraining: React.FC = () => {
  // Config state
  const [nEstimators, setNEstimators] = useState(200);
  const [maxDepth, setMaxDepth] = useState<number | null>(null);
  const [minSamplesLeaf, setMinSamplesLeaf] = useState(2);

  // Status state
  const [isTraining, setIsTraining] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadEvaluation = async () => {
    setIsTraining(true);
    setErrorMsg("");
    try {
      const res = await api.getMLEvaluation();
      if (res.success === false) {
        // Warning (no labeled pairs in DB)
        setErrorMsg(res.message);
        setEvalResult(null);
      } else {
        setEvalResult(res);
        setErrorMsg("");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to retrieve ML evaluation metrics.");
    } finally {
      setIsTraining(false);
    }
  };

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTraining(true);
    setErrorMsg("");
    setEvalResult(null);

    try {
      const res = await api.trainModel({
        n_estimators: nEstimators,
        max_depth: maxDepth,
        min_samples_leaf: minSamplesLeaf,
      });

      if (res.success === false) {
        setErrorMsg(res.message);
      } else {
        setEvalResult(res);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to run training pipeline.");
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    loadEvaluation();
  }, []);

  // Format feature importance data colors
  const BAR_COLORS = ["#0d9488", "#0f766e", "#6366f1", "#4f46e5"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Substitution Model Training</h1>
        <p className="text-slate-500 text-sm mt-1">Train Random Forest classifiers on pharmacist-labeled pairs using Stratified 5-Fold cross-validation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Config Panel (cols-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary-500" /> Model Hyperparameters
            </h2>

            <form onSubmit={handleTrain} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Trees (n_estimators): {nEstimators}
                </label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={nEstimators}
                  onChange={(e) => setNEstimators(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Max Depth
                </label>
                <select
                  value={maxDepth === null ? "" : maxDepth}
                  onChange={(e) => setMaxDepth(e.target.value === "" ? null : parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Unlimited (None)</option>
                  <option value="3">3 (Shallow)</option>
                  <option value="5">5 (Medium)</option>
                  <option value="10">10 (Deep)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Min Samples Leaf
                </label>
                <select
                  value={minSamplesLeaf}
                  onChange={(e) => setMinSamplesLeaf(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="1">1 (No Regularization)</option>
                  <option value="2">2 (Standard)</option>
                  <option value="4">4 (Medium Regularization)</option>
                  <option value="8">8 (High Regularization)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isTraining}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all duration-200"
              >
                {isTraining ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Training Model...
                  </>
                ) : (
                  <>
                    <Cpu className="h-4 w-4" /> Run Classifier Pipeline
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Theoretical Paper Mapping card */}
          <div className="bg-slate-100 rounded-3xl p-5 border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4.5 w-4.5 text-primary-600" /> Expected Paper Metrics
            </h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              For reference, the expected baseline metrics from the research paper based on cross-validated test trials:
            </p>
            
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 block">ROC-AUC</span>
                <span className="font-extrabold text-slate-800">0.93</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 block">Accuracy</span>
                <span className="font-extrabold text-slate-800">0.92</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 block">Precision</span>
                <span className="font-extrabold text-slate-800">0.86</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 block">Recall</span>
                <span className="font-extrabold text-slate-800">0.89</span>
              </div>
            </div>
            
            <p className="text-[9px] text-slate-400 italic">
              *The dashboard on the right displays the actual, real-time results calculated dynamically from the database.
            </p>
          </div>
        </div>

        {/* Right Column: Training metrics and ROC curve plots (cols-8) */}
        <div className="lg:col-span-8">
          {isTraining ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center text-slate-400 gap-3 min-h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">Executing 5-Fold Stratified Split</h3>
                <p className="text-slate-500 text-xs">Optimizing node depths, fitting estimators, and calculating test set AUC coordinates...</p>
              </div>
            </div>
          ) : errorMsg ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 min-h-[400px] flex flex-col justify-center">
              <div className="flex items-start gap-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl">
                <ShieldAlert className="text-amber-600 h-6 w-6 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="text-amber-800 font-extrabold text-base">Insufficient Labeled Training Data</h4>
                  <p className="text-amber-700 text-xs leading-relaxed">{errorMsg}</p>
                </div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-500 text-xs leading-relaxed space-y-2">
                <h5 className="font-bold text-slate-700">How to unlock training functions?</h5>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to the **Data Upload** tab.</li>
                  <li>Click **Reset Db** to import the seeded synthetic dataset (which includes pharmacist-labeled valid/invalid pairs).</li>
                  <li>Return to this page to train and visualize classifier metrics.</li>
                </ol>
              </div>
            </div>
          ) : evalResult ? (
            <div className="space-y-8 animate-fade-in">
              {/* Summary Stats Cards */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle className="h-4.5 w-4.5 text-teal-600" /> Training Results Summary
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 block mb-0.5">Test Accuracy</span>
                    <span className="text-lg font-black text-slate-800">{evalResult.random_forest.accuracy}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 block mb-0.5">Test Precision</span>
                    <span className="text-lg font-black text-slate-800">{evalResult.random_forest.precision}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 block mb-0.5">Test Recall</span>
                    <span className="text-lg font-black text-slate-800">{evalResult.random_forest.recall}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 block mb-0.5">F1-Score</span>
                    <span className="text-lg font-black text-slate-800">{evalResult.random_forest.f1_score}</span>
                  </div>
                  <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100">
                    <span className="text-[9px] font-bold text-teal-600 block mb-0.5">ROC-AUC</span>
                    <span className="text-lg font-black text-teal-700">{evalResult.random_forest.roc_auc}</span>
                  </div>
                </div>

                <div className="flex gap-4 items-center justify-between text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                  <span>Stratified Split: 80% Train, 20% Test</span>
                  <span>Labeled Pairs: {evalResult.total_pairs} rows</span>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Recharts ROC Curve */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800">ROC Curve (Random Forest)</h4>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={evalResult.random_forest.roc_curve}
                        margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <YAxis dataKey="tpr" type="number" domain={[0, 1]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="tpr"
                          stroke="#0d9488"
                          strokeWidth={2.5}
                          dot={false}
                          name="Random Forest"
                        />
                        <Line
                          data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]}
                          dataKey="tpr"
                          stroke="#cbd5e1"
                          strokeDasharray="4 4"
                          dot={false}
                          name="Random Guess"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Confusion Matrix */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800">Confusion Matrix (Actual Counts)</h4>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
                    {/* Header rows */}
                    <div className="text-slate-400 font-bold py-2">True \ Pred</div>
                    <div className="bg-slate-50 text-slate-500 font-extrabold py-2 rounded-xl">Neg (Not Valid)</div>
                    <div className="bg-slate-50 text-slate-500 font-extrabold py-2 rounded-xl">Pos (Valid)</div>

                    {/* Row 1 */}
                    <div className="bg-slate-50 text-slate-500 font-extrabold flex items-center justify-center rounded-xl">Neg</div>
                    <div className="bg-teal-50 border border-teal-200 text-teal-800 font-black p-4 rounded-xl flex flex-col justify-center">
                      <span>{evalResult.random_forest.confusion_matrix.tn}</span>
                      <span className="text-[8px] text-teal-600 font-medium">True Neg</span>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 font-black p-4 rounded-xl flex flex-col justify-center">
                      <span>{evalResult.random_forest.confusion_matrix.fp}</span>
                      <span className="text-[8px] text-rose-600 font-medium">False Pos</span>
                    </div>

                    {/* Row 2 */}
                    <div className="bg-slate-50 text-slate-500 font-extrabold flex items-center justify-center rounded-xl">Pos</div>
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 font-black p-4 rounded-xl flex flex-col justify-center">
                      <span>{evalResult.random_forest.confusion_matrix.fn}</span>
                      <span className="text-[8px] text-amber-600 font-medium">False Neg</span>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 text-teal-800 font-black p-4 rounded-xl flex flex-col justify-center">
                      <span>{evalResult.random_forest.confusion_matrix.tp}</span>
                      <span className="text-[8px] text-teal-600 font-medium">True Pos</span>
                    </div>
                  </div>
                  
                  <p className="text-[9px] text-slate-400 italic text-center mt-2 leading-relaxed">
                    *Clinical Safety: Minimizing **False Positives** (incorrectly advising a substitute is safe) is highly prioritized over Recall.
                  </p>
                </div>

                {/* Feature Importances */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 md:col-span-2">
                  <h4 className="text-sm font-bold text-slate-800">Feature Importance Analysis</h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={evalResult.random_forest.feature_importance}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <YAxis dataKey="feature" type="category" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <Tooltip />
                        <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                          {evalResult.random_forest.feature_importance.map((_entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm text-slate-400 text-center min-h-[400px]">
              <BarChart2 className="h-10 w-10 text-slate-300 mb-3 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-sm">No Model Evaluation Available</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                Run the training pipeline or re-seed the demo database to calculate classification metrics.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
export default MLTraining;
