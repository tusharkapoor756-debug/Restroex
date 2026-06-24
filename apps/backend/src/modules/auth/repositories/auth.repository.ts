import { db } from '../../../infrastructure/database/database.client';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  restaurantId: string;
  isActive: boolean;
}

export class AuthRepository {
  private get client() {
    return db.getClient();
  }

  public async findByEmail(email: string): Promise<AuthUser | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }

    return data ? this.mapUser(data) : null;
  }

  public async createOwner(email: string, passwordHash: string, restaurantId: string, name: string): Promise<AuthUser> {
    const { data, error } = await this.client
      .from('users')
      .insert({
        name,
        email,
        password_hash: passwordHash,
        role: 'admin',
        restaurant_id: restaurantId,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create restaurant owner: ${error.message}`);
    }

    return this.mapUser(data);
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const { error } = await this.client
      .from('users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user password: ${error.message}`);
    }
  }

  private mapUser(row: any): AuthUser {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      restaurantId: row.restaurant_id,
      isActive: row.is_active,
    };
  }
}
