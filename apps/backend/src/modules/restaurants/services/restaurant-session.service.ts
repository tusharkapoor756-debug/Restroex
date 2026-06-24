import crypto from 'crypto';
import { BadRequestError, ForbiddenError } from '../../../shared/errors/app-error';
import { Restaurant, RestaurantRepository } from '../repositories/restaurant.repository';

export interface RestaurantSession {
  restaurant: Restaurant;
  token: string;
  expiresAt: string;
}

interface RestaurantSessionPayload {
  restaurantId: string;
  exp: number;
}

export class RestaurantSessionService {
  private readonly restaurants: RestaurantRepository;
  private readonly secret: string;

  constructor() {
    this.restaurants = new RestaurantRepository();
    this.secret = process.env.JWT_SECRET || process.env.RECEIPT_SIGNING_SECRET || 'restroex-development-session-secret';
  }

  public async login(name: string, phoneNumber: string): Promise<RestaurantSession> {
    if (!name || name.length < 2) {
      throw new BadRequestError('Restaurant name is required');
    }

    if (!phoneNumber || phoneNumber.length < 8) {
      throw new BadRequestError('Restaurant WhatsApp phone number is required');
    }

    const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
    const restaurant = await this.restaurants.upsertByPhoneNumber(name, normalizedPhone);
    return this.createSessionForRestaurant(restaurant);
  }

  public createSessionForRestaurant(restaurant: Restaurant): RestaurantSession {
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    return {
      restaurant,
      token: this.sign({ restaurantId: restaurant.id, exp: expiresAt }),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  public verify(token: string): RestaurantSessionPayload {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) {
      throw new ForbiddenError('Invalid restaurant session');
    }

    const expected = this.signature(payloadPart);
    if (!this.safeEqual(expected, signaturePart)) {
      throw new ForbiddenError('Invalid restaurant session');
    }

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as RestaurantSessionPayload;
    if (!payload.restaurantId || payload.exp < Date.now()) {
      throw new ForbiddenError('Restaurant session expired');
    }

    return payload;
  }

  private sign(payload: RestaurantSessionPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.signature(encoded)}`;
  }

  private signature(payload: string): string {
    return crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
