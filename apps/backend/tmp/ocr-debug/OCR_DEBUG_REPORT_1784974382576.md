# RESTROEX PAYMENT INTELLIGENCE ENGINE — COMPLETE OCR DEBUG REPORT

Generated At: 2026-07-25T10:13:02.581Z

---

## 1. Image Preprocessing & Transformation Stages

| Stage | Filename | Size (Bytes) | Dimensions / Box |
| :--- | :--- | :--- | :--- |
| **01 Original Upload** | `01_original_1784974382576.png` | 49365 | Native Canvas |
| **02 Receipt Card Crop** | `02_cropped_card_1784974382576.png` | 49365 | Box: 0,64 (581x1128) |
| **03 Grayscale Normalization** | `03_grayscale_1784974382576.png` | 49365 | Luminance Channel |
| **04 High-Contrast Binarization** | `04_binarized_1784974382576.png` | 49365 | Contrast Amplified |
| **05 Hero Region Crop** | `05_hero_crop_1784974382576.png` | 49365 | Top 50% Card Slice |

---

## 2. Multi-Strategy Parallel OCR Ensemble Outputs

### Pass A: Full Foreground Card OCR (PSM 3)
```
Paid to
sk Suraj Khinda Ed
XXXXXX9096@ptyes
Banking Name : Suraj Khinda ©
Sent to : PAYTM + XXXXXX9096@ptyes
Transfer Details o>
PhonePe Transaction ID
T2607251542241384681091 (5)
Debited from
@ xxxxxxs3ea 21
UTR: 787878604901 B
2 C] i <
Send Again View History Split Share
Expense Receipt
(» Contact PhonePe Support >
Pay securely with fingerprint
Enjoy seamless and safer payments up to
25,000
Powered by
LIPID ves sank

```

### Pass B: Binarized Card OCR (PSM 6)
```
Paid to
sk Suraj Khinda Ed
XXXXXX9096@ptyes
Banking Name : Suraj Khinda ©
Sent to : PAYTM + XXXXXX9096@ptyes
Transfer Details o>
PhonePe Transaction ID
T2607251542241384681091 (5)
Debited from
@ xxxxxxs3ea 21
UTR: 787878604901 B
2 C] i <
Send Again View History Split Share
Expense Receipt
(» Contact PhonePe Support >
Pay securely with fingerprint
Enjoy seamless and safer payments up to
25,000
Powered by
LIPID ves sank

```

### Pass C: Hero Region Crop OCR (PSM 6)
```
A

a

Nn

i

EL

Again View History

EE

SQftactinOont

20

EE

Na

Pons

AEC

I, =

EE

J

LPs

a

```

---

## 3. OCR Text Fusion & Deduplication Engine Output
```
A
Nn
i
EL
Again View History
EE
SQftactinOont
20
Na
Pons
AEC
J
LPs
(6)
Paid to
Suraj Khinda
1
XXXXXX9096@ptyes
Banking Name
Sent to
© PAYTM « XXXXXX9096@ptyes
Transfer Details
PhonePe Transaction ID
T2607251542241384681091
Debited from
@ xxxxxxs3ea
UTR: 787878604901
B
Vd
tr
Cc]
Send Again View History
Split
Share
Expense
Receipt
Contact PhonePe Support
Pay securely with fingerprint
Enjoy seamless and safer payments up to
¥5,000
(sctamtion
Powered by
LIPID ves sank
sk Suraj Khinda Ed
Banking Name : Suraj Khinda ©
Sent to : PAYTM + XXXXXX9096@ptyes
Transfer Details o>
T2607251542241384681091 (5)
@ xxxxxxs3ea 21
UTR: 787878604901 B
2 C] i <
Send Again View History Split Share
Expense Receipt
25,000
```

---

## 4. Layout & Section Classification
- **Detected Sections**: HEADER_SECTION, STATUS_SECTION, HERO_AMOUNT_SECTION, SENDER_SECTION, HERO_AMOUNT_SECTION, RECEIVER_SECTION, STATUS_SECTION, RECEIVER_SECTION
- **Hero Candidates Count**: 2

---

## 5. Universal Candidate Generation & Evidence Score Breakdown

| Amount Value | Confidence Score | Winning Status | Source Line | Scoring Evidence Reasons |
| :--- | :--- | :--- | :--- | :--- |
| **₹20** | **40/100** | 🏆 **SELECTED WINNER** | `20` | Hero region / Top visual placement; Standalone prominent line text |
| **₹6** | **40/100** | Candidate | `(6)` | Hero region / Top visual placement; Standalone prominent line text |
| **₹1** | **40/100** | Candidate | `1` | Hero region / Top visual placement; Standalone prominent line text |

---

## 6. Final Structured Receipt Output
```json
{
  "amount": 20,
  "currency": "INR",
  "receiverName": "Suraj Khinda 1 XXXXXX9096",
  "receiverUpi": "xxxxxx9096@ptyes",
  "receiverAccount": null,
  "senderName": null,
  "senderUpi": null,
  "senderAccount": null,
  "transactionId": "T2607251542241384681091",
  "upiReference": "787878604901",
  "status": "SUCCESS",
  "paymentApp": "Paytm",
  "paymentMethod": "UPI",
  "bankName": null,
  "timestamp": null,
  "date": null,
  "confidenceScores": {
    "amountConfidence": 40,
    "receiverUpiConfidence": 95,
    "upiReferenceConfidence": 95,
    "statusConfidence": 95,
    "overallConfidence": 100,
    "isHighConfidence": true,
    "requiresSecondaryReview": false
  },
  "rawLineCount": 54
}
```