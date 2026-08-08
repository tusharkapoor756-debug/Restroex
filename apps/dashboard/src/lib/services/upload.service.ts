import { api } from '../api';

export class UploadService {
  /**
   * Uploads a file (e.g. QR code, restaurant logo) to the server.
   * Returns the signed, public URL.
   */
  static async uploadFile(file: File): Promise<{ url: string; path: string }> {
    const formData = new FormData();
    formData.append('file', file);

    // Call raw fetch to handle multipart/form-data boundary generation correctly
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
    const API_BASE = `${BACKEND_URL}/api/v1`;
    const { getToken } = require('../auth');
    const token = getToken();
    const session = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("restroex_session") || "{}") : {};

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (session.restaurantId) headers["x-restaurant-id"] = session.restaurantId;

    const response = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Upload failed');
    }

    return json.data;
  }
}
