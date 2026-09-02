import { z } from 'zod';

// Boundary schemas — every handler input is validated here before use.
export const agentRunSchema = z.object({
  agentName: z.string().min(1),
  prompt: z.string().min(1),
  context: z
    .object({
      caseId: z.string().optional(),
      alertId: z.string().optional(),
      role: z.string().optional(),
    })
    .default({}),
  locale: z.string().default('en'),
});
const teamsAction = z.enum(['approve', 'escalate', 'dismiss']);

export const teamsCardSchema = z.object({
  caseId: z.string().min(1),
  alertId: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  riskScore: z.number(),
  actions: z.array(teamsAction).min(1),
  locale: z.string().default('en'),
});

export const caseDecisionSchema = z.object({
  caseId: z.string().min(1),
  decision: teamsAction,
  userId: z.string().min(1),
  rationale: z.string().optional(),
  source: z.enum(['app', 'teams']),
});

export const emailReportSchema = z.object({
  caseId: z.string().min(1),
  to: z.array(z.string().email()).min(1),
  subject: z.string(),
  body: z.string(),
  locale: z.string().default('en'),
});

export const evidenceUploadSchema = z.object({
  caseId: z.string().min(1),
  fileName: z.string().min(1),
  contentBase64: z.string(),
  contentType: z.string(),
});

// Exports AgentRun traces into the RAFT seed-question format (WS-5). PII is scrubbed on export.
export const agentRunExportSchema = z.object({
  domain: z.string().default('aml'),
  limit: z.number().int().positive().max(1000).default(200),
});

// RAFT A/B compare (WS-6/WS-9): same AML question against baseline vs the fine-tuned student.
export const raftCompareSchema = z.object({
  prompt: z.string().min(1),
  subject: z.string().default(''),
  context: z
    .object({
      caseId: z.string().optional(),
      alertId: z.string().optional(),
      role: z.string().optional(),
    })
    .default({}),
  locale: z.string().default('en'),
});
