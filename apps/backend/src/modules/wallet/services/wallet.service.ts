import { db } from '../../../infrastructure/database/database.client';
import { logger } from '../../../infrastructure/logger/logger';

export interface WalletBalanceInfo {
  restaurantId: string;
  creditBalance: number;
  isLowBalance: boolean;
  lowBalanceThreshold: number;
  updatedAt: string;
}

export interface WalletTransactionRecord {
  id: string;
  restaurantId: string;
  type: 'recharge' | 'deduction';
  credits: number;
  amount: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export class WalletService {
  private get client() {
    return db.getClient();
  }

  private readonly LOW_BALANCE_THRESHOLD = 50;

  /**
   * Retrieves or initializes the SaaS credit balance for a restaurant.
   */
  public async getWalletBalance(restaurantId: string): Promise<WalletBalanceInfo> {
    const { data: row, error } = await this.client
      .from('wallet_credits')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      logger.error({ error, restaurantId }, 'Failed to fetch wallet credits');
      throw new Error(`Failed to fetch wallet credits: ${error.message}`);
    }

    if (!row) {
      logger.info({ restaurantId }, 'Initializing default 1,000 SaaS software credits for restaurant');
      const { data: newRow, error: insertErr } = await this.client
        .from('wallet_credits')
        .insert({
          restaurant_id: restaurantId,
          credit_balance: 1000,
        })
        .select('*')
        .single();

      if (insertErr) {
        throw new Error(`Failed to initialize wallet credits: ${insertErr.message}`);
      }

      return {
        restaurantId,
        creditBalance: newRow.credit_balance,
        isLowBalance: false,
        lowBalanceThreshold: this.LOW_BALANCE_THRESHOLD,
        updatedAt: newRow.updated_at,
      };
    }

    return {
      restaurantId,
      creditBalance: row.credit_balance,
      isLowBalance: row.credit_balance <= this.LOW_BALANCE_THRESHOLD,
      lowBalanceThreshold: this.LOW_BALANCE_THRESHOLD,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Deducts software credits from restaurant balance and writes a transaction ledger entry.
   */
  public async deductCredits(
    restaurantId: string,
    creditsToDeduct: number,
    description: string,
    referenceId?: string
  ): Promise<WalletBalanceInfo> {
    const current = await this.getWalletBalance(restaurantId);
    const newBalance = Math.max(0, current.creditBalance - creditsToDeduct);

    const { error: updateErr } = await this.client
      .from('wallet_credits')
      .update({
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId);

    if (updateErr) {
      throw new Error(`Failed to deduct wallet credits: ${updateErr.message}`);
    }

    // Ledger record entry
    await this.client.from('wallet_transactions').insert({
      restaurant_id: restaurantId,
      type: 'deduction',
      credits: creditsToDeduct,
      amount: 0,
      description,
      reference_id: referenceId || null,
    });

    logger.info({ restaurantId, creditsToDeduct, newBalance, description }, 'SaaS credit deduction recorded');

    return {
      restaurantId,
      creditBalance: newBalance,
      isLowBalance: newBalance <= this.LOW_BALANCE_THRESHOLD,
      lowBalanceThreshold: this.LOW_BALANCE_THRESHOLD,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Recharges SaaS software credits for a restaurant.
   */
  public async rechargeCredits(
    restaurantId: string,
    creditsToAdd: number,
    amountPaid: number,
    description: string,
    referenceId?: string
  ): Promise<WalletBalanceInfo> {
    const current = await this.getWalletBalance(restaurantId);
    const newBalance = current.creditBalance + creditsToAdd;

    const { error: updateErr } = await this.client
      .from('wallet_credits')
      .update({
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId);

    if (updateErr) {
      throw new Error(`Failed to recharge wallet credits: ${updateErr.message}`);
    }

    // Ledger record entry
    await this.client.from('wallet_transactions').insert({
      restaurant_id: restaurantId,
      type: 'recharge',
      credits: creditsToAdd,
      amount: amountPaid,
      description,
      reference_id: referenceId || null,
    });

    logger.info({ restaurantId, creditsToAdd, amountPaid, newBalance }, 'SaaS credit recharge recorded');

    return {
      restaurantId,
      creditBalance: newBalance,
      isLowBalance: newBalance <= this.LOW_BALANCE_THRESHOLD,
      lowBalanceThreshold: this.LOW_BALANCE_THRESHOLD,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns transaction ledger history for a restaurant.
   */
  public async getTransactionHistory(restaurantId: string, limit = 50): Promise<WalletTransactionRecord[]> {
    const { data: rows, error } = await this.client
      .from('wallet_transactions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error({ error, restaurantId }, 'Failed to fetch transaction ledger');
      return [];
    }

    return (rows || []).map((r) => ({
      id: r.id,
      restaurantId: r.restaurant_id,
      type: r.type,
      credits: r.credits,
      amount: Number(r.amount || 0),
      description: r.description,
      referenceId: r.reference_id || undefined,
      createdAt: r.created_at,
    }));
  }
}

export const walletService = new WalletService();
