import { isWorkIqEnabled } from '@/backend/config';
import { postJson } from '@/backend/services/backendApi';

export interface EmailReportRequest {
  caseId: string;
  to: string[];
  subject: string;
  body: string;
  locale: string;
}

export interface EvidenceUploadRequest {
  caseId: string;
  fileName: string;
  contentBase64: string;
  contentType: string;
}

export interface O365Result {
  ok: boolean;
  simulated: boolean;
  url?: string;
}

/**
 * O365ReportService — sends case reports / AML narratives by Outlook mail and drops
 * generated evidence into SharePoint/OneDrive, via the backend using delegated Graph
 * (OBO). Gated by the same Work IQ flag; returns a simulated result otherwise.
 */
export class O365ReportService {
  async emailReport(req: EmailReportRequest): Promise<O365Result> {
    if (isWorkIqEnabled()) {
      try {
        return await postJson<O365Result>('/api/reports/email', req);
      } catch {
        /* fall through to simulated */
      }
    }
    return { ok: false, simulated: true };
  }

  async uploadEvidence(req: EvidenceUploadRequest): Promise<O365Result> {
    if (isWorkIqEnabled()) {
      try {
        return await postJson<O365Result>('/api/evidence/upload', req);
      } catch {
        /* fall through to simulated */
      }
    }
    return { ok: false, simulated: true };
  }
}

export const o365Report = new O365ReportService();
