import React from "react";
import { ShieldAlert } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface DisclaimerProps {
  className?: string;
  compact?: boolean;
}

export const MedicalDisclaimer: React.FC<DisclaimerProps> = ({ className = "", compact = false }) => {
  const { t } = useLanguage();

  return (
    <div
      className={`bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3 ${className}`}
      role="alert"
    >
      <ShieldAlert className="text-amber-600 h-5 w-5 mt-0.5 flex-shrink-0" />
      <div>
        <h4 className="text-amber-800 font-bold text-sm uppercase tracking-wider">
          {t("medicalDisclaimer")}
        </h4>
        <p className="text-amber-700 text-xs mt-1 leading-relaxed">
          {t("disclaimerText")}
        </p>
        {!compact && (
          <p className="text-amber-600 text-[10px] mt-2 italic">
            Reference Flow: Unavailable Medicine &rarr; Candidate Similarity Search &rarr; ML Verification &rarr; Pharmacist Confirm
          </p>
        )}
      </div>
    </div>
  );
};
