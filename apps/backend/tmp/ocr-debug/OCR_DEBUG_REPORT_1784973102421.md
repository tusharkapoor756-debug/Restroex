# RESTROEX PAYMENT INTELLIGENCE ENGINE — COMPLETE OCR DEBUG REPORT

Generated At: 2026-07-25T09:51:42.426Z

---

## 1. Image Preprocessing & Transformation Stages

| Stage | Filename | Size (Bytes) | Dimensions / Box |
| :--- | :--- | :--- | :--- |
| **01 Original Upload** | `01_original_1784973102421.png` | 91424 | Native Canvas |
| **02 Receipt Card Crop** | `02_cropped_card_1784973102421.png` | 91424 | Box: 0,92 (1059x1352) |
| **03 Grayscale Normalization** | `03_grayscale_1784973102421.png` | 91424 | Luminance Channel |
| **04 High-Contrast Binarization** | `04_binarized_1784973102421.png` | 91424 | Contrast Amplified |
| **05 Hero Region Crop** | `05_hero_crop_1784973102421.png` | 91424 | Top 50% Card Slice |

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
Co

Re

VVVVVVVVVS

er

—

§" Getassured

-

BEE

```

---

## 3. OCR Text Fusion & Deduplication Engine Output
```
Co
Re
VVVVVVVVVS
er
§" Getassured
BEE
super.
money
Payment Successful
Vv
200
July 7 at 5:38 PM
To: KARE TATARAO
p 7781051879@okbizaxis
fm Axis Bank
From: GORIPARTHI YAGNESWAR
6302640041@superyes
UPI reference ID: 655435698968
SSI
cashback
IPI
pends
b
Payment Successful Vv
» 7781051879@okbizaxis
Get assured cashback on UPI spends
G * *
```

---

## 4. Layout & Section Classification
- **Detected Sections**: HEADER_SECTION, STATUS_SECTION, HERO_AMOUNT_SECTION, SENDER_SECTION, HERO_AMOUNT_SECTION, TRANSACTION_SECTION, STATUS_SECTION, RECEIVER_SECTION
- **Hero Candidates Count**: 1

---

## 5. Universal Candidate Generation & Evidence Score Breakdown

| Amount Value | Confidence Score | Winning Status | Source Line | Scoring Evidence Reasons |
| :--- | :--- | :--- | :--- | :--- |
| **₹200** | **40/100** | 🏆 **SELECTED WINNER** | `200` | Hero region / Top visual placement; Standalone prominent line text |

---

## 6. Final Structured Receipt Output
```json
{
  "amount": 200,
  "currency": "INR",
  "receiverName": "KARE TATARAO p 7781051879",
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
    "amountConfidence": 40,
    "receiverUpiConfidence": 95,
    "upiReferenceConfidence": 95,
    "statusConfidence": 95,
    "overallConfidence": 100,
    "isHighConfidence": true,
    "requiresSecondaryReview": false
  },
  "rawLineCount": 27
}
```