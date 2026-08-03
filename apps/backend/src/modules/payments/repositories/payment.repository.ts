import { db } from '../../../infrastructure/database/database.client';
import { Payment, CreatePaymentDto, UpdatePaymentDto, PaymentStatus } from '../types/payment.types';

export class PaymentRepository {
  private client = db.getClient();

  public async createPayment(dto: CreatePaymentDto): Promise<Payment> {
    let { data, error } = await this.client
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
      .maybeSingle();

    if (error && error.message?.includes('idempotency_key')) {
      const fallbackInsert = await this.client
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
          metadata: dto.metadata ?? {},
        })
        .select('*')
        .single();
      
      data = fallbackInsert.data;
      error = fallbackInsert.error;
    }

    if (error || !data) {
      throw new Error(`Failed to create payment: ${error?.message}`);
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
    let { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!data) {
      // Fallback search: check gateway_data->>'paymentLinkId' or provider_order_id
      const fallback = await this.client
        .from('payments')
        .select('*')
        .or(`provider_order_id.eq.${orderId},gateway_data->>paymentLinkId.eq.${orderId}`)
        .maybeSingle();
      data = fallback.data;
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  public async getByRestaurantId(restaurantId: string): Promise<Payment[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data.map((row) => this.mapToDomain(row));
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

  // ----------------------------------------------------------
  // Intelligence & Duplicate Lookup Helpers
  // ----------------------------------------------------------

  public async findByUpiReference(upiRef: string, excludePaymentId?: string): Promise<Payment | null> {
    let query = this.client
      .from('payments')
      .select('*')
      .or(`verified_transaction_reference.eq.${upiRef},provider_transaction_id.eq.${upiRef}`);

    if (excludePaymentId) {
      query = query.neq('id', excludePaymentId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findByImageHash(imageHash: string, excludePaymentId?: string): Promise<Payment | null> {
    let query = this.client
      .from('payments')
      .select('*')
      .eq('image_hash', imageHash);

    if (excludePaymentId) {
      query = query.neq('id', excludePaymentId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findByExactFingerprint(exactFingerprint: string, excludePaymentId?: string): Promise<Payment | null> {
    let query = this.client
      .from('payments')
      .select('*')
      .eq('exact_fingerprint', exactFingerprint);

    if (excludePaymentId) {
      query = query.neq('id', excludePaymentId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findBySimilarityFingerprint(similarityFingerprint: string, excludePaymentId?: string): Promise<Payment | null> {
    let query = this.client
      .from('payments')
      .select('*')
      .eq('similarity_fingerprint', similarityFingerprint);

    if (excludePaymentId) {
      query = query.neq('id', excludePaymentId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async appendAnalysisHistory(paymentId: string, analysisResult: any): Promise<void> {
    const payment = await this.getById(paymentId);
    if (!payment) return;

    const existingHistory = payment.analysisHistory ?? (payment.gatewayData as any)?.analysis_history ?? [];
    const updatedHistory = [...existingHistory, analysisResult];

    await this.update(paymentId, {
      analysisHistory: updatedHistory,
      gatewayData: {
        ...payment.gatewayData,
        analysis_history: updatedHistory,
      },
    });
  }

  // ----------------------------------------------------------
  // Update
  // ----------------------------------------------------------

  public async update(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    const payload: Record<string, any> = {};

    if (dto.paymentStatus)                  payload.payment_status              = dto.paymentStatus;
    if (dto.providerName)                   payload.provider_name               = dto.providerName;
    if (dto.gatewayData)                    payload.gateway_data                = dto.gatewayData;
    if (dto.metadata)                       payload.metadata                    = dto.metadata;
    if (dto.providerTransactionId)          payload.provider_transaction_id     = dto.providerTransactionId;
    if (dto.providerOrderId)                payload.provider_order_id           = dto.providerOrderId;
    if (dto.exactFingerprint)               payload.exact_fingerprint           = dto.exactFingerprint;
    if (dto.similarityFingerprint)          payload.similarity_fingerprint      = dto.similarityFingerprint;
    if (dto.imageHash)                      payload.image_hash                  = dto.imageHash;
    if (dto.analysisHistory)                payload.analysis_history            = dto.analysisHistory;

    if (dto.verifiedBy) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(dto.verifiedBy);
      if (isUuid) {
        payload.verified_by = dto.verifiedBy;
      }
    }
    if (dto.verificationNotes)              payload.verification_notes          = dto.verificationNotes;
    if (dto.verifiedAt)                     payload.verified_at                 = dto.verifiedAt;
    if (dto.verifiedAmount !== undefined)   payload.verified_amount             = dto.verifiedAmount;
    if (dto.verifiedTransactionReference) payload.verified_transaction_reference = dto.verifiedTransactionReference;
    if (dto.rejectedReason)                 payload.rejected_reason             = dto.rejectedReason;
    if (dto.failureReason)                  payload.failure_reason              = dto.failureReason;
    if (dto.completedAt)                    payload.completed_at                = dto.completedAt;
    if (dto.failedAt)                       payload.failed_at                   = dto.failedAt;
    if (dto.expiresAt)                      payload.expires_at                  = dto.expiresAt;

    let { data, error } = await this.client
      .from('payments')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error && (error.message.includes('column') || error.code === 'PGRST204')) {
      // Fallback: If standalone DB columns don't exist on payments table yet, persist in gateway_data
      delete payload.provider_transaction_id;
      delete payload.provider_order_id;
      delete payload.exact_fingerprint;
      delete payload.similarity_fingerprint;
      delete payload.image_hash;
      delete payload.analysis_history;

      const retry = await this.client
        .from('payments')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      throw new Error(`Failed to update payment ${id}: ${error?.message ?? 'Record not found'}`);
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
      providerTransactionId: row.provider_transaction_id ?? null,
      providerOrderId: row.provider_order_id ?? null,
      exactFingerprint: row.exact_fingerprint ?? null,
      similarityFingerprint: row.similarity_fingerprint ?? null,
      imageHash: row.image_hash ?? null,
      analysisHistory: row.analysis_history ?? [],
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
