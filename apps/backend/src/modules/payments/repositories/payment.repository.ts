import { db } from '../../../infrastructure/database/database.client';
import { Payment, CreatePaymentDto, UpdatePaymentDto, PaymentStatus } from '../types/payment.types';

export class PaymentRepository {
  private client = db.getClient();

  public async createPayment(dto: CreatePaymentDto): Promise<Payment> {
    const { data, error } = await this.client
      .from('payments')
      .insert({
        order_id: dto.orderId,
        restaurant_id: dto.restaurantId,
        customer_phone: dto.customerPhone,
        payment_method: dto.paymentMethod,
        provider_name: dto.providerName,
        payment_status: 'pending',
        amount: dto.amount,
        currency: dto.currency ?? 'INR',
        gateway_data: dto.gatewayData ?? {},
        idempotency_key: dto.idempotencyKey ?? null,
        metadata: dto.metadata ?? {},
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async getById(id: string): Promise<Payment | null> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async getByOrderId(orderId: string): Promise<Payment | null> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async getByRestaurantId(restaurantId: string): Promise<Payment[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data.map(this.mapToDomain);
  }

  public async getByIdempotencyKey(key: string): Promise<Payment | null> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async update(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    const payload: Record<string, any> = {};

    if (dto.paymentStatus)      payload.payment_status    = dto.paymentStatus;
    if (dto.gatewayData)        payload.gateway_data      = dto.gatewayData;
    if (dto.metadata)           payload.metadata          = dto.metadata;
    if (dto.verifiedBy)         payload.verified_by       = dto.verifiedBy;
    if (dto.verificationNotes)  payload.verification_notes = dto.verificationNotes;
    if (dto.verifiedAt)         payload.verified_at       = dto.verifiedAt;
    if (dto.verifiedAmount !== undefined) payload.verified_amount = dto.verifiedAmount;
    if (dto.verifiedTransactionReference) payload.verified_transaction_reference = dto.verifiedTransactionReference;
    if (dto.rejectedReason)     payload.rejected_reason   = dto.rejectedReason;
    if (dto.failureReason)      payload.failure_reason    = dto.failureReason;
    if (dto.completedAt)        payload.completed_at      = dto.completedAt;
    if (dto.failedAt)           payload.failed_at         = dto.failedAt;
    if (dto.expiresAt)          payload.expires_at        = dto.expiresAt;

    const { data, error } = await this.client
      .from('payments')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update payment ${id}: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  private mapToDomain(row: any): Payment {
    return {
      id: row.id,
      orderId: row.order_id,
      restaurantId: row.restaurant_id,
      customerPhone: row.customer_phone,
      paymentMethod: row.payment_method,
      providerName: row.provider_name,
      paymentStatus: row.payment_status as PaymentStatus,
      amount: Number(row.amount),
      currency: row.currency,
      gatewayData: row.gateway_data ?? {},
      verifiedBy: row.verified_by,
      verificationNotes: row.verification_notes,
      verifiedAt: row.verified_at,
      verifiedAmount: row.verified_amount ? Number(row.verified_amount) : null,
      verifiedTransactionReference: row.verified_transaction_reference,
      rejectedReason: row.rejected_reason,
      failureReason: row.failure_reason,
      idempotencyKey: row.idempotency_key,
      paymentAttempt: Number(row.payment_attempt ?? 1),
      expiresAt: row.expires_at,
      metadata: row.metadata ?? {},
      initiatedAt: row.initiated_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
