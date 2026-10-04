const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export interface User {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  provider: "local" | "google";
}

export interface Medicine {
  id: number;
  medicine_name: string;
  brand_name?: string;
  salt_composition: string;
  strength?: string;
  dosage_form?: string;
  therapeutic_class?: string;
  is_available?: boolean;
  price_range?: string;
}

export interface Pharmacy {
  pharmacy_name: string;
  address?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  price: number;
  stock_quantity: number;
  availability: string;
  distance: number;
  score?: number;
  rank?: number;
}

export interface OCRMatch {
  ocr_text: string;
  matched_id: number | null;
  matched_name: string | null;
  confidence: number;
  confirmed: boolean;
}

export interface SubstituteExplanation {
  status: "success" | "warning" | "danger";
  message: string;
}

export interface SubstituteCandidate {
  id: number;
  medicine_name: string;
  brand_name?: string;
  salt_composition: string;
  strength?: string;
  dosage_form?: string;
  therapeutic_class?: string;
  similarity: number;
  ml_confidence: number;
  is_valid_substitute: boolean;
  verification_status: string;
  explanations: SubstituteExplanation[];
}

export interface SearchHistoryItem {
  id: number;
  medicine_name: string;
  search_time: string;
}

async function handleResponseError(res: Response, defaultMessage: string): Promise<never> {
  let errorMessage = defaultMessage;
  try {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      errorMessage = typeof data.detail === "string" ? data.detail : (data.message || text || defaultMessage);
    } catch {
      errorMessage = text || defaultMessage;
    }
  } catch {
    errorMessage = defaultMessage;
  }
  throw new Error(errorMessage);
}

export const api = {
  async searchMedicines(
    q: string,
    filters?: { strength?: string; dosage_form?: string },
    location?: { state?: string; district?: string; city?: string }
  ) {
    const params = new URLSearchParams({ q });
    if (filters?.strength) params.append("strength", filters.strength);
    if (filters?.dosage_form) params.append("dosage_form", filters.dosage_form);
    if (location?.state) params.append("state", location.state);
    if (location?.district) params.append("district", location.district);
    if (location?.city) params.append("city", location.city);

    const res = await fetch(`${API_BASE_URL}/medicines/search?${params.toString()}`);
    return res.json();
  },

  async getMedicineDetails(id: number) {
    const res = await fetch(`${API_BASE_URL}/medicines/${id}`);
    if (!res.ok) throw new Error("Medicine not found");
    return res.json();
  },

  async getNearbyPharmacies(
    medicineId: number,
    location?: { latitude: number; longitude: number; state?: string; district?: string; city?: string },
    priceWeight: number = 0.5
  ): Promise<Pharmacy[]> {
    const params = new URLSearchParams({
      medicine_id: medicineId.toString(),
      price_weight: priceWeight.toString(),
    });
    if (location?.latitude !== undefined) params.append("latitude", location.latitude.toString());
    if (location?.longitude !== undefined) params.append("longitude", location.longitude.toString());
    if (location?.state) params.append("state", location.state);
    if (location?.district) params.append("district", location.district);
    if (location?.city) params.append("city", location.city);

    const res = await fetch(`${API_BASE_URL}/pharmacies/nearby?${params.toString()}`);
    return res.json();
  },

  getUserRole(): string {
    try {
      const saved = localStorage.getItem("medfind_user");
      if (saved && saved !== "undefined") {
        const u = JSON.parse(saved);
        return u?.role || "user";
      }
    } catch (e) {
      // Ignore parse errors
    }
    return "user";
  },

  async uploadDataset(file: File, columnMapping?: Record<string, string>) {
    const formData = new FormData();
    formData.append("file", file);
    if (columnMapping) {
      formData.append("column_mapping", JSON.stringify(columnMapping));
    }
    const res = await fetch(`${API_BASE_URL}/dataset/upload`, {
      method: "POST",
      headers: {
        "X-User-Role": this.getUserRole()
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Administrative privilege required.");
    }
    return res.json();
  },

  async processOCR(file: File, mockText?: string): Promise<{ raw_text: string; matches: OCRMatch[] }> {
    const formData = new FormData();
    formData.append("file", file);
    if (mockText) {
      formData.append("mock_text", mockText);
    }
    const res = await fetch(`${API_BASE_URL}/prescription/ocr`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },

  async searchSubstitutes(medicineId: number, threshold: number = 0.8, limit: number = 10): Promise<SubstituteCandidate[]> {
    const res = await fetch(`${API_BASE_URL}/substitutes/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicine_id: medicineId, threshold, limit }),
    });
    return res.json();
  },

  async trainModel(config: { n_estimators: number; max_depth: number | null; min_samples_leaf: number }) {
    const res = await fetch(`${API_BASE_URL}/ml/train`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Role": this.getUserRole()
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Administrative privilege required.");
    }
    return res.json();
  },

  async getMLEvaluation() {
    const res = await fetch(`${API_BASE_URL}/ml/evaluation`);
    return res.json();
  },

  async saveSearchHistory(medicineName: string, sessionId: string = "default") {
    await fetch(`${API_BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicine_name: medicineName, session_id: sessionId }),
    });
  },

  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    const res = await fetch(`${API_BASE_URL}/search/history`);
    return res.json();
  },

  async getDashboardStats() {
    const res = await fetch(`${API_BASE_URL}/dashboard/statistics`);
    return res.json();
  },

  async register(email: string, password: string, name: string, role: string = "user"): Promise<{ status: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Registration failed.");
    }
    return res.json();
  },

  async login(email: string, password: string): Promise<{ status: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Login failed.");
    }
    return res.json();
  },

  async getAuthConfig(): Promise<{ google_client_id: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/config`);
      if (!res.ok) return { google_client_id: "" };
      return res.json();
    } catch {
      return { google_client_id: "" };
    }
  },

  async forgotPassword(email: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Could not send the reset email.");
    }
    return res.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Could not reset the password.");
    }
    return res.json();
  },

  async googleAuth(email: string, name: string, idToken?: string): Promise<{ status: string; user?: User; email?: string; message?: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, id_token: idToken }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Google authentication failed.");
    }
    return res.json();
  },

  async verifyGoogleMFA(email: string, mfaCode: string): Promise<{ status: string; user: User; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/google/mfa-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mfa_code: mfaCode }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Google Admin MFA Step-Up verification failed.");
    }
    return res.json();
  },

  async requestAdminOTP(email: string, name: string): Promise<{ status: string; otp_code: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/admin-otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Failed to generate Admin Security OTP.");
    }
    return res.json();
  },

  async verifyAdminOTP(email: string, password: string, name: string, otpCode: string): Promise<{ status: string; user: User; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/admin-otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, otp_code: otpCode }),
    });
    if (!res.ok) {
      await handleResponseError(res, "Admin OTP verification failed.");
    }
    return res.json();
  },

  async getAdminNotifications(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/admin/notifications`, {
      headers: { "X-User-Role": this.getUserRole() }
    });
    if (!res.ok) return [];
    return res.json();
  },

  async getSMTPSettings(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/settings/smtp`);
    if (!res.ok) return {};
    return res.json();
  },

  async saveSMTPSettings(config: { smtp_host: string; smtp_port: number; smtp_user: string; smtp_pass: string; sender_email?: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/settings/smtp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      await handleResponseError(res, "Failed to save SMTP settings.");
    }
    return res.json();
  },
};
