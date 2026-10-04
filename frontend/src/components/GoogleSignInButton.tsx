import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (credential: string, profile?: { email: string; name: string }) => void;
  onFallback?: () => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  theme?: "outline" | "filled_blue" | "filled_black";
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onFallback,
  text = "continue_with",
  theme = "outline"
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    // Only attempt GSI script rendering if a real Client ID is supplied via environment variables
    if (!clientId) return;

    const scriptId = "google-gsi-client-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initGoogleGSI = () => {
      if (window.google?.accounts?.id && containerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: any) => {
              if (response?.credential) {
                try {
                  const base64Url = response.credential.split(".")[1];
                  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                  const jsonPayload = decodeURIComponent(
                    atob(base64)
                      .split("")
                      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                      .join("")
                  );
                  const parsed = JSON.parse(jsonPayload);
                  onSuccess(response.credential, { email: parsed.email, name: parsed.name });
                } catch (e) {
                  onSuccess(response.credential);
                }
              }
            },
            use_fedcm_for_prompt: true,
            auto_select: false,
          });

          containerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(containerRef.current, {
            theme,
            size: "large",
            text,
            width: "100%",
            shape: "pill",
            logo_alignment: "left",
          });
        } catch (err) {
          console.warn("Google Identity Services initialization:", err);
        }
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogleGSI;
      document.head.appendChild(script);
    } else {
      initGoogleGSI();
    }
  }, [clientId, text, theme, onSuccess]);

  if (!clientId) {
    return (
      <button
        type="button"
        onClick={() => onFallback && onFallback()}
        className="w-full py-3 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24">
          <path
            fill="#EA4335"
            d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.68 14.9.72 12 .72c-4.74 0-8.8 2.73-10.79 6.72l3.77 2.92C5.9 7.42 8.7 5.04 12 5.04z"
          />
          <path
            fill="#4285F4"
            d="M23.28 12.25c0-.82-.07-1.6-.21-2.35H12v4.45h6.32c-.27 1.43-1.08 2.64-2.29 3.45l3.58 2.78c2.1-1.94 3.67-4.79 3.67-8.33z"
          />
          <path
            fill="#FBBC05"
            d="M5.01 14.73c-.24-.72-.38-1.5-.38-2.31 0-.81.14-1.59.38-2.31L1.24 7.19C.45 8.78 0 10.54 0 12.42c0 1.88.45 3.64 1.24 5.23l3.77-2.92z"
          />
          <path
            fill="#34A853"
            d="M12 23.28c3.24 0 5.97-1.07 7.96-2.91l-3.58-2.78c-.99.66-2.27 1.06-3.8 1.06-3.3 0-6.1-2.38-7.1-5.32L1.24 16.3c2.0 3.99 6.05 6.72 10.76 6.72z"
          />
        </svg>
        {text === "signup_with" ? "Sign up with Google" : "Continue with Google"}
      </button>
    );
  }

  return (
    <div className="w-full flex justify-center my-2">
      <div ref={containerRef} className="w-full min-h-[44px] flex justify-center"></div>
    </div>
  );
};

export default GoogleSignInButton;
