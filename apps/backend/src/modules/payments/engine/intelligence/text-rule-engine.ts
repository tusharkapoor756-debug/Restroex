import { ExtractedPaymentDetails } from '../../types/payment-analysis.types';
import { UniversalReceiptGrammarEngine } from './universal-receipt-grammar.engine';

export class PaymentTextRuleEngine {
  /**
   * Delegates parsing to the UniversalReceiptGrammarEngine.
   * Understands payment receipts semantically, decoupled from app-specific templates.
   */
  public static parseRawText(rawText: string): ExtractedPaymentDetails {
    return UniversalReceiptGrammarEngine.parseReceipt(rawText);
  }
}
