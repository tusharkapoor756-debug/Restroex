import crypto from 'crypto';
import { promisify } from 'util';
import { BadRequestError, UnauthorizedError } from '../../../shared/errors/app-error';
import { RestaurantRepository } from '../../restaurants/repositories/restaurant.repository';
import { RestaurantSessionService } from '../../restaurants/services/restaurant-session.service';
import { AuthRepository } from '../repositories/auth.repository';

const scrypt = promisify(crypto.scrypt);

export class AuthService {
  private readonly authRepository: AuthRepository;
  private readonly restaurants: RestaurantRepository;
  private readonly sessions: RestaurantSessionService;

  constructor() {
    this.authRepository = new AuthRepository();
    this.restaurants = new RestaurantRepository();
    this.sessions = new RestaurantSessionService();
  }

  public async login(dto: any) {
    const email = String(dto.email || '').trim().toLowerCase();
    const password = String(dto.password || '');

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const user = await this.authRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const restaurant = await this.restaurants.findById(user.restaurantId);
    if (!restaurant || !restaurant.isActive) {
      throw new UnauthorizedError('Restaurant account is inactive');
    }

    return this.sessions.createSessionForRestaurant(restaurant);
  }

  public async register(dto: any) {
    const restaurantName = String(dto.restaurantName || dto.name || '').trim();
    const phoneNumber = String(dto.phoneNumber || '').trim();
    const email = String(dto.email || '').trim().toLowerCase();
    const password = String(dto.password || '');

    if (!restaurantName || !phoneNumber || !email || password.length < 8) {
      throw new BadRequestError('Restaurant name, phone number, email, and an 8 character password are required');
    }

    const existingUser = await this.authRepository.findByEmail(email);
    if (existingUser) {
      throw new BadRequestError('An account already exists for this email');
    }

    const restaurant = await this.restaurants.upsertByPhoneNumber(restaurantName, phoneNumber.replace(/[^\d+]/g, ''));
    const passwordHash = await this.hashPassword(password);
    await this.authRepository.createOwner(email, passwordHash, restaurant.id, restaurantName);

    return this.sessions.createSessionForRestaurant(restaurant);
  }

  public async forgotPassword(dto: any) {
    const email = String(dto.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestError('Email is required');
    }

    const user = await this.authRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('No active account exists for this email');
    }

    const temporaryPassword = this.createTemporaryPassword();
    const passwordHash = await this.hashPassword(temporaryPassword);
    await this.authRepository.updatePassword(user.id, passwordHash);

    return {
      email,
      temporaryPassword,
      message: 'Temporary password generated. Login with this password and change it later.',
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [method, salt, hash] = storedHash.split(':');
    if (method !== 'scrypt' || !salt || !hash) return false;

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey);
  }

  private createTemporaryPassword(): string {
    return `restroex-${crypto.randomBytes(4).toString('hex')}`;
  }
}
