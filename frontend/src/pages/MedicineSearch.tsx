import React, { useState } from "react";
import { Search, MapPin, Navigation, Sliders, Info, Compass, RefreshCw, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import type { Medicine, Pharmacy } from "../services/api";
import { MapComponent } from "../components/MapComponent";
import { useLanguage } from "../context/LanguageContext";


export const MedicineSearch: React.FC = () => {
  const { t, language } = useLanguage();
  // Search state
  const [query, setQuery] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [results, setResults] = useState<Medicine[]>([]);
  const [didYouMean, setDidYouMean] = useState<{ id: number; medicine_name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Location state (Defaults to Madurai center coordinates matching synthetic data)
  const [coords, setCoords] = useState<[number, number]>([9.9252, 78.1198]);
  const [locationName, setLocationName] = useState("Madurai, Tamil Nadu");
  const [isLocating, setIsLocating] = useState(false);

  // Filters (State, District, City)
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  // Selected Medicine details & ranking
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [_selectedMedDetails, setSelectedMedDetails] = useState<any>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [priceWeight, setPriceWeight] = useState(0.5); // Default slider weight



  // Trigger geolocation
  const handleGeolocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords([position.coords.latitude, position.coords.longitude]);
          setLocationName(`GPS Coordinates (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`);
          setIsLocating(false);
        },
        (error) => {
          console.warn("Geolocation failed, using default Madurai location:", error.message);
          setIsLocating(false);
        },
        { timeout: 6000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  // Perform search
  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = customQuery || query;
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSelectedMed(null);
    setSelectedMedDetails(null);
    setPharmacies([]);

    try {
      // Log to history
      api.saveSearchHistory(searchQuery).catch(() => {});

      const res = await api.searchMedicines(
        searchQuery,
        { strength, dosage_form: dosageForm },
        { state: stateFilter, district: districtFilter, city: cityFilter }
      );
      
      setResults(res.results || []);
      setDidYouMean(res.did_you_mean || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch details and pharmacies when a medicine is selected
  const handleSelectMedicine = async (med: Medicine) => {
    setSelectedMed(med);
    
    try {
      const details = await api.getMedicineDetails(med.id);
      setSelectedMedDetails(details);
      
      // Fetch nearby stores sorted by current weight
      await refreshPharmacies(med.id, priceWeight);
    } catch (err) {
      console.error("Failed to load details:", err);
    }
  };

  // Fetch stores based on selected weight
  const refreshPharmacies = async (medId: number, weight: number) => {
    try {
      const stores = await api.getNearbyPharmacies(
        medId,
        {
          latitude: coords[0],
          longitude: coords[1],
          state: stateFilter,
          district: districtFilter,
          city: cityFilter,
        },
        weight
      );
      setPharmacies(stores);
    } catch (err) {
      console.error("Failed to load pharmacies:", err);
    }
  };

  // Handle slider changes
  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPriceWeight(val);
    if (selectedMed) {
      refreshPharmacies(selectedMed.id, val);
    }
  };



  // Check if medicine is out of stock everywhere
  const isOutOfStockEverywhere = pharmacies.length === 0 || pharmacies.every(p => p.availability !== "Available");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{language === "en" ? "Medicine Inventory & Location Search" : "மருந்து இருப்பு & இருப்பிடத் தேடல்"}</h1>
        <p className="text-slate-500 text-sm mt-1">{language === "en" ? "Search medicines fuzzy-matched against canonical catalogs, view pricing, and check local stocks." : "தரவுத்தளத்தில் மருந்துகளைத் தேடவும், விலையைப் பார்க்கவும் மற்றும் இருப்பிடங்களைச் சரிபார்க்கவும்."}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Search Form & List (cols-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary-500" /> {language === "en" ? "Search Filters" : "தேடல் வடிப்பான்கள்"}
            </h2>
            
            <form onSubmit={(e) => handleSearch(e)} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{language === "en" ? "Medicine Name" : "மருந்தின் பெயர்"}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("enterMedPlaceholder")}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  />
                  <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{language === "en" ? "Strength (Opt)" : "வீரியம் (தேவைப்பட்டால்)"}</label>
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="e.g. 500 mg, 650"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{language === "en" ? "Dosage Form (Opt)" : "மருந்து வடிவம் (தேவைப்பட்டால்)"}</label>
                  <select
                    value={dosageForm}
                    onChange={(e) => setDosageForm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  >
                    <option value="">{language === "en" ? "Any Form" : "அனைத்து வடிவம்"}</option>
                    <option value="Tablet">{language === "en" ? "Tablet" : "மாத்திரை"}</option>
                    <option value="Capsule">{language === "en" ? "Capsule" : "கேப்சூல்"}</option>
                    <option value="Syrup">{language === "en" ? "Syrup" : "திரவம்"}</option>
                    <option value="Injection">{language === "en" ? "Injection" : "ஊசி"}</option>
                  </select>
                </div>
              </div>

              {/* Location Controls */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Search Geolocation" : "புவிஇருப்பிடத் தேடல்"}</label>
                  <button
                    type="button"
                    onClick={handleGeolocation}
                    disabled={isLocating}
                    className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1 active:scale-95 transition-transform"
                  >
                    <Navigation className="h-3.5 w-3.5" /> {isLocating ? (language === "en" ? "Locating..." : "கண்டறியப்படுகிறது...") : (language === "en" ? "Use GPS" : "ஜிபிஎஸ் பயன்படுத்து")}
                  </button>
                </div>
                
                <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{locationName}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder={language === "en" ? "State" : "மாநிலம்"}
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-2.5 py-1.5 text-xs focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  />
                  <input
                    type="text"
                    placeholder={language === "en" ? "District" : "மாவட்டம்"}
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-2.5 py-1.5 text-xs focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  />
                  <input
                    type="text"
                    placeholder={language === "en" ? "City" : "நகரம்"}
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-2 py-1.5 text-xs outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-2.5 rounded-xl shadow-md shadow-primary-500/10 flex items-center justify-center gap-2 transition-all duration-200 active:scale-98"
              >
                {isSearching ? "Searching Catalog..." : "Search Medicines"}
              </button>
            </form>
          </div>

          {/* Search results list */}
          {hasSearched && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider px-1">Search Results ({results.length})</h3>
              
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary-500" />
                  <span className="text-xs font-semibold">Matching databases...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((med) => (
                    <button
                      key={med.id}
                      onClick={() => handleSelectMedicine(med)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                        selectedMed?.id === med.id
                          ? "bg-primary-50/50 border-primary-500 shadow-md shadow-primary-500/5 ring-1 ring-primary-500"
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-extrabold text-slate-800 text-sm leading-snug">{med.medicine_name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          med.is_available 
                            ? "bg-teal-50 text-teal-700 border border-teal-200" 
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {med.is_available ? "In Stock" : "Out of Stock"}
                        </span>
                      </div>
                      {med.brand_name && <p className="text-xs font-semibold text-slate-500 mt-0.5">Brand: {med.brand_name}</p>}
                      <p className="text-slate-400 text-xs mt-1 truncate">Salt: {med.salt_composition}</p>
                      <div className="flex gap-2 mt-2 text-[10px] text-slate-500 font-semibold">
                        {med.strength && <span className="bg-slate-100 px-2 py-0.5 rounded">{med.strength}</span>}
                        {med.dosage_form && <span className="bg-slate-100 px-2 py-0.5 rounded">{med.dosage_form}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
                  <div className="text-rose-500 bg-rose-50 p-3 rounded-full inline-block">
                    <Info className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-sm">No exact medicine found</h4>
                    <p className="text-slate-500 text-xs">Verify your spellings or try other names.</p>
                  </div>
                  
                  {/* Did you mean fallback suggestions */}
                  {didYouMean.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 text-left space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Did you mean?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {didYouMean.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setQuery(item.medicine_name);
                              handleSearch(undefined, item.medicine_name);
                            }}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                          >
                            {item.medicine_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Selected Medicine Details, Slider, Map, Alternatives (cols-8) */}
        <div className="lg:col-span-8 space-y-8">
          {selectedMed ? (
            <div className="space-y-8 animate-fade-in">
              {/* Selected Med Header Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedMed.therapeutic_class || "General Medicine"}</span>
                    <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedMed.medicine_name}</h2>
                    {selectedMed.brand_name && <p className="text-sm font-semibold text-slate-500">{t("brandLabel")}: {selectedMed.brand_name}</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">{t("sellingPriceLabel")}</span>
                    <span className="text-xl font-black text-primary-600">₹{selectedMed.price_range}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50 space-y-2 text-xs">
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-500 min-w-[120px]">{t("activeSaltLabel")}:</span>
                    <span className="text-slate-800 font-semibold">{selectedMed.salt_composition}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-500 min-w-[120px]">{t("dosageFormStrength")}:</span>
                    <span className="text-slate-800 font-semibold">{selectedMed.dosage_form || "N/A"} ({selectedMed.strength || "N/A"})</span>
                  </div>
                </div>

                {isOutOfStockEverywhere && (
                  <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl flex items-start gap-3">
                    <AlertTriangle className="text-rose-600 h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <h4 className="text-rose-800 font-bold text-sm">{t("outOfStockTitle")}</h4>
                      <p className="text-rose-700 text-xs leading-relaxed">
                        {t("outOfStockDesc")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pharmacy Locator and Map View */}
              {pharmacies.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left: Ranked Pharmacies List & Slider */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-slate-800 flex items-center justify-between">
                        <span>{t("rankedPharmacies", { count: pharmacies.length })}</span>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 border border-slate-100 rounded">{t("datasetInventory")}</span>
                      </h3>
                      
                      {/* Priority Slider */}
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100/50 space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-600">
                          <span className={`${priceWeight > 0.5 ? 'text-primary-600' : ''}`}>{t("pricePriority")}</span>
                          <span>{t("balanced")}</span>
                          <span className={`${priceWeight < 0.5 ? 'text-primary-600' : ''}`}>{t("distancePriority")}</span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.1"
                          value={priceWeight}
                          onChange={handleWeightChange}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                          <span>{language === "en" ? `w = ${priceWeight.toFixed(1)} price` : `w = ${priceWeight.toFixed(1)} விலை`}</span>
                          <span>{language === "en" ? `(1 - w) = ${(1 - priceWeight).toFixed(1)} dist` : `(1 - w) = ${(1 - priceWeight).toFixed(1)} தொலைவு`}</span>
                        </div>
                      </div>

                      {/* Pharmacy List */}
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {pharmacies.map((pharm) => {
                          const isAvail = pharm.availability === "Available";
                          return (
                            <div
                              key={pharm.pharmacy_name}
                              className={`p-3.5 rounded-2xl border flex justify-between items-start gap-4 transition-all ${
                                isAvail 
                                  ? "bg-white border-slate-100 shadow-sm hover:border-slate-200" 
                                  : "bg-slate-50 border-slate-100/50 opacity-60"
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-primary-500 text-white rounded-full text-[10px] font-extrabold w-4 h-4 flex items-center justify-center">
                                    {pharm.rank}
                                  </span>
                                  <h4 className="font-extrabold text-slate-800 text-xs leading-none">{pharm.pharmacy_name}</h4>
                                </div>
                                <p className="text-slate-400 text-[10px] truncate max-w-[180px]">{pharm.address}</p>
                                <div className="flex gap-2 text-[9px] font-bold mt-1 text-slate-500">
                                  <span>{t("kmAway", { dist: pharm.distance.toFixed(1) })}</span>
                                  <span>&bull;</span>
                                  <span className={isAvail ? "text-teal-600" : "text-rose-500"}>
                                    {isAvail ? (language === "en" ? "Available" : "இருப்பில் உள்ளது") : (language === "en" ? "Out of Stock" : "இருப்பில் இல்லை")}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right space-y-1">
                                <span className="text-xs font-black text-slate-800">₹{pharm.price}</span>
                                <div className="text-[9px] font-bold text-slate-400">{t("scoreLabel")}: {pharm.score?.toFixed(2)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>


                  </div>

                  {/* Right: Map view */}
                  <div className="h-full min-h-[350px]">
                    <MapComponent
                      pharmacies={pharmacies}
                      userLocation={coords}
                      center={coords}
                    />
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm text-slate-400 text-center min-h-[350px]">
              <Compass className="h-10 w-10 text-slate-300 mb-3 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-sm">{t("noMedSelected")}</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                {t("noMedSelectedDesc")}
              </p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
export default MedicineSearch;
