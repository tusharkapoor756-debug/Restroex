import { getToken, clearSession } from "./auth";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const API_BASE = `${BACKEND_URL}/api/v1`;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

export class ApiError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requireAuth = true, headers, ...customConfig } = options;

  const config: RequestInit = {
    ...customConfig,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (requireAuth) {
    const token = getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    } else {
      // If auth is required but no token exists, we could redirect or throw
      throw new ApiError("No authentication token found", 401);
    }
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      throw new ApiError(json.message || "An error occurred during the request.", response.status);
    }

    // Backend responses are wrapped in { success: true, data: T }
    return json.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError((error as Error).message || "Network error");
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) => 
    fetchApi<T>(endpoint, { ...options, method: "GET" }),
    
  post: <T>(endpoint: string, body?: any, options?: RequestOptions) => 
    fetchApi<T>(endpoint, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),
    
  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) => 
    fetchApi<T>(endpoint, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
    
  put: <T>(endpoint: string, body?: any, options?: RequestOptions) => 
    fetchApi<T>(endpoint, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
    
  delete: <T>(endpoint: string, options?: RequestOptions) => 
    fetchApi<T>(endpoint, { ...options, method: "DELETE" }),
};
