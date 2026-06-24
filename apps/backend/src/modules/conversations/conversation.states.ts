export enum ConversationState {
  IDLE = 'idle',
  AWAITING_ITEM = 'awaiting_item',
  AWAITING_VARIANT = 'awaiting_variant',
  AWAITING_QUANTITY = 'awaiting_quantity',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  AWAITING_PAYMENT = 'awaiting_payment',
  PAYMENT_COMPLETED = 'payment_completed',
  HUMAN_TAKEOVER = 'human_takeover',
}
