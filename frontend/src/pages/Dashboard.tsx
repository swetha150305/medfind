import React from "react";
import { Link } from "react-router-dom";
import { Search, FileText, MapPin, Activity } from "lucide-react";
import { MedicalDisclaimer } from "../components/MedicalDisclaimer";
import { useLanguage } from "../context/LanguageContext";

export const Dashboard: React.FC = () => {
  const { t, language } = useLanguage();

  const cards = [
    {
      title: t("searchStockCard"),
      desc: t("searchStockDesc"),
      to: "/search",
      icon: Search,
      color: "from-teal-500 to-primary-600",
      iconColor: "text-teal-600",
      bgColor: "bg-teal-50",
    },
    {
      title: t("prescriptionOcr"),
      desc: t("ocrDesc"),
      to: "/ocr",
      icon: FileText,
      color: "from-indigo-500 to-accent-600",
      iconColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: t("historyCard"),
      desc: t("historyDesc"),
      to: "/search",
      icon: MapPin,
      color: "from-amber-500 to-orange-600",
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-950 via-primary-950 to-primary-900 text-white p-8 sm:p-12 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent_50%)]"></div>
        <div className="relative z-10 max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-primary-500/10 border border-primary-500/30 text-teal-400 uppercase tracking-widest animate-pulse">
            <Activity className="h-3.5 w-3.5" /> {language === "en" ? "Smart Geolocation & Locator System" : "புத்திசாலி புவிஇருப்பிடம் & கண்டுபிடிப்பு அமைப்பு"}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            {language === "en" ? "MedFind Medicine Locator & Stock Finder" : "மெட்ஃபைண்ட் மருந்து இருப்பிடம் & இருப்பு கண்டறிவான்"}
          </h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            {t("dashboardSub")}
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              to="/search"
              className="bg-primary-500 hover:bg-primary-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-primary-500/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {language === "en" ? "Start Medicine Search" : "மருந்து தேடலைத் தொடங்கு"}
            </Link>
            <Link
              to="/ocr"
              className="bg-slate-800/80 hover:bg-slate-800 text-slate-100 font-bold px-6 py-3 rounded-xl border border-slate-700 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {language === "en" ? "Digitize Prescription" : "மருந்துச்சீட்டைப் பதிவேற்று"}
            </Link>
          </div>
        </div>
      </div>

      {/* Safety Disclaimer Banner */}
      <MedicalDisclaimer />

      {/* Action Cards Grid */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{t("coreServices")}</h2>
          <p className="text-slate-500 text-sm mt-1">
            {language === "en" ? "Select an action module to check medicine details." : "விவரங்களைக் காண கீழே உள்ள ஒரு தொகுதியைத் தேர்ந்தெடுக்கவும்."}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.to}
                className="group relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-xl hover:border-slate-300/80 transition-all duration-300 flex flex-col justify-between overflow-hidden hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-slate-50 group-hover:scale-110 transition-transform duration-300 -z-10 opacity-50"></div>
                <div className="space-y-4">
                  <div className={`inline-flex p-3 rounded-xl ${card.bgColor} ${card.iconColor} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-primary-600 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{card.desc}</p>
                  </div>
                </div>
                <div className="mt-6 flex items-center text-xs font-bold text-primary-600 group-hover:text-primary-700 gap-1">
                  Access Module &rarr;
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
};
export default Dashboard;
