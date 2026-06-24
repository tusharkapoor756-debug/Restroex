export enum SystemEvents {
  ORDER_PAID = 'ORDER_PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  HUMAN_TAKEOVER = 'HUMAN_TAKEOVER',
  ORDER_ACCEPTED = 'ORDER_ACCEPTED',
}

export class EventBus {
  public emit(event: SystemEvents, payload: any) {
    // Emit internal domain event
  }

  public subscribe(event: SystemEvents, handler: (payload: any) => void) {
    // Subscribe to internal domain event
  }
}
