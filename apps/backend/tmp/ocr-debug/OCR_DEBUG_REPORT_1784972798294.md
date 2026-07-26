# RESTROEX PAYMENT INTELLIGENCE ENGINE — COMPLETE OCR DEBUG REPORT

Generated At: 2026-07-25T09:46:38.301Z

---

## 1. Image Preprocessing & Transformation Stages

| Stage | Filename | Size (Bytes) | Dimensions / Box |
| :--- | :--- | :--- | :--- |
| **01 Original Upload** | `01_original_1784972798294.png` | 91424 | Native Canvas |
| **02 Receipt Card Crop** | `02_cropped_card_1784972798294.png` | 91424 | Box: 0,92 (1059x1352) |
| **03 Grayscale Normalization** | `03_grayscale_1784972798294.png` | 91424 | Luminance Channel |
| **04 High-Contrast Binarization** | `04_binarized_1784972798294.png` | 91424 | Contrast Amplified |
| **05 Hero Region Crop** | `05_hero_crop_1784972798294.png` | 91424 | Top 50% Card Slice |

---

## 2. Multi-Strategy Parallel OCR Ensemble Outputs

### Pass A: Full Foreground Card OCR (PSM 3)
```
b
super.
money
Payment Successful Vv
July 7 at 5:38 PM
To: KARE TATARAO
» 7781051879@okbizaxis
fm Axis Bank
From: GORIPARTHI YAGNESWAR
6302640041@superyes
UPI reference ID: 655435698968
"
Get assured cashback on UPI spends
G * *

```

### Pass B: Binarized Card OCR (PSM 6)
```
b
super.
money
Payment Successful Vv
July 7 at 5:38 PM
To: KARE TATARAO
» 7781051879@okbizaxis
fm Axis Bank
From: GORIPARTHI YAGNESWAR
6302640041@superyes
UPI reference ID: 655435698968
"
Get assured cashback on UPI spends
G * *

```

### Pass C: Hero Region Crop OCR (PSM 6)
```
|
peta
Rl
\ AAA AAALLA
§" Getassured
BE
BEE

```

---

## 3. OCR Text Fusion & Deduplication Engine Output
```
peta
Rl
\ AAA AAALLA
§" Getassured
BE
BEE
b
super.
money
Payment Successful Vv
July 7 at 5:38 PM
To: KARE TATARAO
» 7781051879@okbizaxis
fm Axis Bank
From: GORIPARTHI YAGNESWAR
6302640041@superyes
UPI reference ID: 655435698968
Get assured cashback on UPI spends
G * *
```

---

## 4. Layout & Section Classification
- **Detected Sections**: HEADER_SECTION, STATUS_SECTION, HERO_AMOUNT_SECTION, SENDER_SECTION, RECEIVER_SECTION, TRANSACTION_SECTION
- **Hero Candidates Count**: 1

---

## 5. Universal Candidate Generation & Evidence Score Breakdown

| Amount Value | Confidence Score | Winning Status | Source Line | Scoring Evidence Reasons |
| :--- | :--- | :--- | :--- | :--- |
| None | 0 | - | - | No numeric candidates evaluated |

---

## 6. Final Structured Receipt Output
```json
{
  "amount": null,
  "currency": "INR",
  "receiverName": "KARE TATARAO",
  "receiverUpi": "7781051879@okbizaxis",
  "receiverAccount": null,
  "senderName": "GORIPARTHI YAGNESWAR",
  "senderUpi": null,
  "senderAccount": null,
  "transactionId": null,
  "upiReference": "655435698968",
  "status": "SUCCESS",
  "paymentApp": null,
  "paymentMethod": "UPI",
  "bankName": "Axis Bank",
  "timestamp": "5:38 PM",
  "date": null,
  "confidenceScores": {
    "amountConfidence": 0,
    "receiverUpiConfidence": 95,
    "upiReferenceConfidence": 95,
    "statusConfidence": 95,
    "overallConfidence": 65,
    "isHighConfidence": false,
    "requiresSecondaryReview": true
  },
  "rawLineCount": 19
}
```