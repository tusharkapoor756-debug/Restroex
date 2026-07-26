export interface DiagnosticResult {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface IPaymentDiagnostics {
  checkConnection(): Promise<DiagnosticResult>;
  checkWebhookHealth?(): Promise<DiagnosticResult>;
  validateMerchantCredentials?(restaurantId: string): Promise<DiagnosticResult>;
}
