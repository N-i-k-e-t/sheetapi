
# Data API Documentation (Internal)

## Overview
This API allows authorized remote clients (Megha IT) to pull daily aggregated Excel data in JSON format.

**Base URL**: `https://sheetapi-opal.vercel.app/api/v1`

---

## Authentication
All requests must include a Bearer Token or API Key.

**Method 1: Query Parameter**
```http
GET /api/v1/data?apiKey=sk_YOUR_KEY_HERE
```

**Method 2: Authorization Header**
```http
GET /api/v1/data
Authorization: Bearer sk_YOUR_KEY_HERE
```

---

## Endpoints

### 1. Fetch All Records
Retrieves all historical records from the Cloud DB.

**Endpoint**: `GET /data`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `date` | string | No | Filter by date (YYYY-MM-DD). Example: `2026-01-07` |

**Response (200 OK)**:
```json
{
  "status": "success",
  "requester": "Megha IT",
  "count": 1500,
  "data": [
    {
      "id": "uuid-string",
      "date": "2026-01-07",
      "Name": "Ramesh",
      "ChallanID": "MH-15-2022",
      "Amount": 500
    },
    ...
  ]
}
```

---

## Performance & Constraints
- **Rate Limit**: Currently unlimited, but please restrict polling to **once every 5 seconds** max.
- **Payload Size**: Handles up to **10,000+ rows** efficiently. For larger datasets, use the `date` filter to fetch daily chunks.
- **Multiple Sheets**: The system automatically aggregates ALL tabs from the source Excel sheet into a single unified JSON stream.

## Smart Sync Behavior
- The system automatically de-duplicates rows based on content.
- If you upload a sheet with 100 old rows and 50 new rows, only the **50 new rows** are added to the database.
