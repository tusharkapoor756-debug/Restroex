export interface SemanticOntologyCategory {
  entity: string;
  labels: string[];
  description: string;
}

export interface SemanticStatusKeywords {
  keywords: string[];
  state: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN';
}

export interface SemanticOntologyConfig {
  version: string;
  lastUpdated: string;
  categories: {
    receiver: SemanticOntologyCategory;
    sender: SemanticOntologyCategory;
    transactionId: SemanticOntologyCategory;
    amount: SemanticOntologyCategory;
  };
  statuses: {
    success: SemanticStatusKeywords;
    failed: SemanticStatusKeywords;
    pending: SemanticStatusKeywords;
  };
  supportedPaymentApps: string[];
  supportedBanks: string[];
}

export const DEFAULT_SEMANTIC_ONTOLOGY: SemanticOntologyConfig = {
  version: '2.0.0',
  lastUpdated: '2026-07-24',
  categories: {
    receiver: {
      entity: 'receiver',
      labels: ['to', 'paid to', 'money sent to', 'transfer to', 'recipient', 'payee', 'beneficiary', 'received by', 'sent to', 'paid towards'],
      description: 'Keywords triggering the RECEIVER_SECTION boundary and entity extraction.',
    },
    sender: {
      entity: 'sender',
      labels: ['from', 'paid by', 'sender', 'payer', 'paid from', 'customer', 'debited from', 'remitter', 'paid via', 'account'],
      description: 'Keywords triggering the SENDER_SECTION boundary and entity extraction.',
    },
    transactionId: {
      entity: 'transactionId',
      labels: ['upi ref', 'upi ref no', 'upi reference', 'upi reference id', 'utr', 'rrn', 'ref no', 'transaction id', 'txn id', 'cbs ref no', 'reference no'],
      description: 'Keywords indicating financial transaction identifiers.',
    },
    amount: {
      entity: 'amount',
      labels: ['amount', 'paid', 'total', 'payment of', 'sum of'],
      description: 'Keywords accompanying order payment amounts.',
    },
  },
  statuses: {
    success: {
      keywords: ['completed', 'successful', 'success', 'paid', 'paid successfully', 'transferred', 'executed', 'sent'],
      state: 'SUCCESS',
    },
    failed: {
      keywords: ['failed', 'declined', 'cancelled', 'unsuccessful', 'rejected', 'bounced'],
      state: 'FAILED',
    },
    pending: {
      keywords: ['processing', 'pending', 'awaiting confirmation', 'in progress'],
      state: 'PENDING',
    },
  },
  supportedPaymentApps: [
    'Paytm', 'Google Pay', 'GPay', 'PhonePe', 'BHIM', 'CRED', 'Amazon Pay', 'SuperMoney', 'Navi', 'WhatsApp', 'WhatsApp Pay'
  ],
  supportedBanks: [
    'Paytm Payments Bank', 'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'SBI', 'Axis Bank',
    'Kotak Mahindra Bank', 'IndusInd Bank', 'Punjab National Bank', 'PNB',
    'Bank of Baroda', 'Union Bank', 'Canara Bank', 'IDFC FIRST Bank'
  ],
};
