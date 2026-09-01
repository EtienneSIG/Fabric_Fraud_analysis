import { isTeamsEnabled } from '@/backend/config';
import { postJson } from '@/backend/services/backendApi';
import { diag } from '@/backend/diag';

export type TeamsAction = 'approve' | 'escalate' | 'dismiss';

export interface TeamsCaseCard {
  caseId: string;
  alertId: string;
  title: string;
  summary: string;
  riskScore: number;
  actions: TeamsAction[];
  locale: string;
}

export interface TeamsNotifyResult {
  delivered: boolean;
  simulated: boolean;
  messageId?: string;
}

/**
 * TeamsNotificationService — posts an approval Adaptive Card to Teams via the
 * backend `/api/notify/teams` (proactive message through the Azure Bot). When Teams
 * is not enabled it returns a simulated result so the in-app flow still demonstrates
 * the human-in-the-loop step.
 */
export class TeamsNotificationService {
  async notifyCase(card: TeamsCaseCard): Promise<TeamsNotifyResult> {
    if (isTeamsEnabled()) {
      try {
        return await postJson<TeamsNotifyResult>('/api/notify/teams', card);
      } catch (e) {
        diag('teams', 'notify failed; simulated result', e);
      }
    }
    return { delivered: false, simulated: true };
  }
}

export const teamsNotifier = new TeamsNotificationService();
