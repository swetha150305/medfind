import React, { useEffect, useRef, useState } from "react";
import { api } from "../services/api";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

// The Google client ID is public. It comes from the server (/api/config) so no rebuild is needed to change it.
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onCredential, text = "continue_with" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envId) {
      setClientId(envId);
      return;
    }
    api.getAuthConfig().then((c) => setClientId(c.google_client_id || ""));
  }, []);

  useEffect(() => {
    if (!clientId) return;

    const render = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (response?.credential) callbackRef.current(response.credential);
        },
      });
      containerRef.current.innerHTML = "";
      const width = Math.min(400, Math.max(200, containerRef.current.offsetWidth || 320));
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        text,
        width,
        shape: "pill",
      });
    };

    const scriptId = "google-gsi-client-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      render();
    } else {
      script.addEventListener("load", render);
    }
  }, [clientId, text]);

  // Not configured on the server: show nothing rather than a fake button.
  if (!clientId) return null;

  return (
    <div className="w-full flex justify-center">
      <div ref={containerRef} className="w-full min-h-[44px] flex justify-center"></div>
    </div>
  );
};

export default GoogleSignInButton;
