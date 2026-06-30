export const TOKEN_KEY = "restroex_token";
export const RESTAURANT_KEY = "restroex_restaurant";

/**
 * Retrieves the current authentication token.
 * Checks sessionStorage first, then localStorage (if "remember me" was used).
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

/**
 * Retrieves the current restaurant session details.
 */
export function getRestaurantSession(): any | null {
  if (typeof window === "undefined") return null;
  const data = sessionStorage.getItem(RESTAURANT_KEY) || localStorage.getItem(RESTAURANT_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Clears the user session completely from both storages.
 */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(RESTAURANT_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(RESTAURANT_KEY);
}

/**
 * Persists the user session.
 */
export function setSession(token: string, restaurant: any, rememberMe: boolean = false): void {
  if (typeof window === "undefined") return;
  
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(RESTAURANT_KEY, JSON.stringify(restaurant));

  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(RESTAURANT_KEY, JSON.stringify(restaurant));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(RESTAURANT_KEY);
  }
}

/**
 * Checks if the user is currently authenticated (has a token).
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}
