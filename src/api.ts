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
  constructor(private config: AppConfig) { }

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

    // 先处理env参数，确保在不同环境下使用不同的API URL
    let env = this.config.env;
    let url = this.config.searchBillUrl;
    url = resolveUrl(url, { env });
    // 如果keyword为空, 不带keyword参数
    if (keyword && keyword.trim() !== '') {
      url = resolveUrl(url, { keyword });
    } else {
      // 如果keyword为空，则移除URL中的keyword参数
      url = url.replace(/\&keyword=\{keyword\}/, '');
    }
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`API ${res.status} ${res.statusText}`);
    }
    const raw: RawBill[] = await res.json();
    if(raw.length === 0 || (raw.length === 1 && raw[0].billId === undefined)) {
      throw new Error('未找到相关表单数据');
    }
    return raw.map(rawToBill);
  }

  async getBillScript(billId: string): Promise<BillScript> {

    let env = this.config.env;
    let url = this.config.getBillScriptUrl;
    url = resolveUrl(url, { env });
    url = resolveUrl(url, { billId });
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`API ${res.status} ${res.statusText}`);
    }
    const raw: RawBillScript = await res.json();
    return { billId: billId, billScript: raw.billScript };
  }

  async updateBillScript(billId: string, billScript: string): Promise<void> {
    let env = this.config.env;
    let url = this.config.putBillScriptUrl;
    url = resolveUrl(url, { env });
    url = resolveUrl(url, { billId });
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
