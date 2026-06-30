import { api } from "../api";
import { RestaurantSession } from "../../types";
import { setSession } from "../auth";

export class AuthService {
  static async login(email: string, password: string, rememberMe: boolean = false): Promise<RestaurantSession> {
    const session = await api.post<RestaurantSession>("/auth/login", { email, password }, { requireAuth: false });
    setSession(session.token, session.restaurant, rememberMe);
    return session;
  }

  static async register(data: { restaurantName: string; phoneNumber: string; email: string; password: string }): Promise<RestaurantSession> {
    const session = await api.post<RestaurantSession>("/auth/register", data, { requireAuth: false });
    setSession(session.token, session.restaurant, false); // Always create a fresh session without rememberMe for now
    return session;
  }

  static async forgotPassword(email: string): Promise<{ email: string; temporaryPassword?: string; message: string }> {
    return api.post("/auth/forgot-password", { email }, { requireAuth: false });
  }
}
