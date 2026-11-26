import { z } from 'zod/mini';

export const LoanStatusSchema = z.enum(['open', 'closed']);
export type LoanStatus = z.infer<typeof LoanStatusSchema>;

export const LoanListItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  source: z.enum(['caltos', 'loandisk']),
  productName: z.string(),
  status: LoanStatusSchema,
  principal: z.number().check(z.nonnegative()),
  balance: z.number().check(z.nonnegative()),
  monthlyRepayment: z.number().check(z.nonnegative()),
  disbursedAt: z.nullable(z.string()),
  maturityDate: z.nullable(z.string()),
});
export type LoanListItem = z.infer<typeof LoanListItemSchema>;

export const LoansResponseSchema = z.object({
  loans: z.array(LoanListItemSchema),
  partial: z.optional(z.boolean()),
  // The screen uses the partial flag and preserves the backend's ledger metadata as sent.
  availability: z.optional(z.unknown()),
});
export type LoansResponse = z.infer<typeof LoansResponseSchema>;

export const RepaymentScheduleItemSchema = z.object({
  dueDate: z.string(),
  amountDue: z.number().check(z.nonnegative()),
  amountPaid: z.number().check(z.nonnegative()),
});

export const LoanRepaymentSchema = z.object({
  monthlyAmount: z.number().check(z.nonnegative()),
  totalRepayable: z.number().check(z.nonnegative()),
  totalPaid: z.number().check(z.nonnegative()),
  nextDueDate: z.nullable(z.string()),
  schedule: z.array(RepaymentScheduleItemSchema),
});

export const LoanMandateSchema = z.object({
  provider: z.string(),
  kind: z.string(),
  status: z.string(),
  externalId: z.nullable(z.string()),
});

export const LoanDetailSchema = z.object({
  ...LoanListItemSchema.shape,
  repayment: LoanRepaymentSchema,
  mandates: z.array(LoanMandateSchema),
});
export type LoanDetail = z.infer<typeof LoanDetailSchema>;

export const WaitlistRequestSchema = z.object({
  employmentType: z.enum(['private-sector', 'own-business']),
});
export type WaitlistRequest = z.infer<typeof WaitlistRequestSchema>;

export const WaitlistResponseSchema = z.object({
  registered: z.literal(true),
  created: z.boolean(),
  employmentType: z.enum(['private-sector', 'own-business']),
  registeredAt: z.string(),
});
export type WaitlistResponse = z.infer<typeof WaitlistResponseSchema>;

export const StatementReviewResponseSchema = z.object({
  submitted: z.literal(true),
  fileId: z.string(),
  employer: z.string(),
  bankCode: z.string(),
  status: z.enum(['UNDER_REVIEW']),
});
export type StatementReviewResponse = z.infer<typeof StatementReviewResponseSchema>;

export const EligibilityEmploymentSchema = z.object({
  type: z.enum(['federal', 'state', 'paramilitary', 'nysc']),
  mdaCode: z.optional(z.string()),
  employerId: z.optional(z.string()),
  monthsLeftInService: z.optional(z.number().check(z.minimum(1), z.maximum(11))),
});

export const EligibilityBankSchema = z.object({
  bankCode: z.string(),
  accountNumber: z.string().check(z.regex(/^\d{10}$/)),
  accountName: z.string(),
  ippisNumber: z.optional(z.string()),
  serviceNumber: z.optional(z.string()),
});

export const EligibilityIdentitySchema = z.object({
  bvn: z.string().check(z.regex(/^\d{11}$/)),
  firstName: z.string(),
  lastName: z.string(),
});

export const EligibilityPreviewRequestSchema = z.object({
  employment: EligibilityEmploymentSchema,
  bank: EligibilityBankSchema,
  identity: EligibilityIdentitySchema,
});
export type EligibilityPreviewRequest = z.infer<typeof EligibilityPreviewRequestSchema>;

export const PreviewFeeSchema = z.object({
  name: z.string(),
  type: z.string(),
  amount: z.number().check(z.nonnegative()),
});

export const PreviewCalculationSchema = z.object({
  loanAmount: z.number().check(z.nonnegative()),
  duration: z.number().check(z.nonnegative()),
  rate: z.number(),
  interest: z.number().check(z.nonnegative()),
  fees: z.array(PreviewFeeSchema),
  totalRepayment: z.number().check(z.nonnegative()),
  installmentRepayment: z.number().check(z.nonnegative()),
  startDate: z.optional(z.string()),
  firstRepaymentDate: z.optional(z.string()),
  lastRepaymentDate: z.optional(z.string()),
  endDate: z.optional(z.string()),
  schedule: z.array(z.record(z.string(), z.unknown())),
});

export const PreviewProductSchema = z.object({
  productId: z.string(),
  name: z.string(),
  category: z.string(),
  minAmount: z.number().check(z.nonnegative()),
  maxAmount: z.number().check(z.nonnegative()),
  suggestedAmount: z.number().check(z.nonnegative()),
  defaultTenorMonths: z.number().check(z.nonnegative()),
  tenorOptions: z.array(z.number().check(z.nonnegative())),
  calculation: PreviewCalculationSchema,
});

export const EligibilityPreviewResponseSchema = z.object({
  decision: z.enum(['APPROVE', 'REFER', 'DECLINE']),
  reasons: z.array(z.string()),
  maximumAmount: z.number().check(z.nonnegative()),
  maximumTenor: z.number().check(z.nonnegative()),
  eligibleProducts: z.array(PreviewProductSchema),
});
export type EligibilityPreviewResponse = z.infer<typeof EligibilityPreviewResponseSchema>;

export const NinVerificationResponseSchema = z.object({
  verified: z.literal(true),
  suggestedNext: z.nullable(z.string()),
});
