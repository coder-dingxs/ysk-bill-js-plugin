import { AppConfig } from './config';

interface RawBill {
  billId: number;
  billName: string;
  billSn: string;
}

interface RawBillScript {
  billScript: string;
}

export interface Bill {
  billId: string;
  billName: string;
  billSn: string;
}

export interface BillScript {
  billId: string;
  billScript: string;
}

function rawToBill(raw: RawBill): Bill {
  return {
    billId: String(raw.billId),
    billName: raw.billName,
    billSn: raw.billSn,
  };
}

function resolveUrl(template: string, params: Record<string, string>): string {
  let url = template;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`{${key}}`, encodeURIComponent(value));
  }
  return url;
}

export class ApiClient {
  constructor(private config: AppConfig) {}

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    return headers;
  }

  async searchBills(keyword: string): Promise<Bill[]> {
    const url = keyword
      ? resolveUrl(this.config.searchBillUrl, { keyword })
      : this.config.searchBillUrl.replace(/\?keyword=\{keyword\}/, '');
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`API ${res.status} ${res.statusText}`);
    }
    const raw: RawBill[] = await res.json();
    return raw.map(rawToBill);
  }

  async getBillScript(billId: string): Promise<BillScript> {
    const url = resolveUrl(this.config.getBillScriptUrl, { billId });
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`API ${res.status} ${res.statusText}`);
    }
    const raw: RawBillScript = await res.json();
    return { billId: billId, billScript: raw.billScript };
  }

  async updateBillScript(billId: string, billScript: string): Promise<void> {
    const url = resolveUrl(this.config.putBillScriptUrl, { billId });
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ billScript: billScript }),
    });
    if (!res.ok) {
      throw new Error(`API ${res.status} ${res.statusText}`);
    }
  }
}
