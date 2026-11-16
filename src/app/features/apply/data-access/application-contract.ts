// Generated from the pinned application API contract by scripts/generate-contracts.py.
import { z } from 'zod/mini';

export const AcceptOfferLetterResponseDtoSchema = z.object({
  "accepted": z.boolean(),
  "acceptedAt": z.string(),
  "hash": z.string(),
});
export type AcceptOfferLetterResponseDto = z.infer<typeof AcceptOfferLetterResponseDtoSchema>;

export const StepStateDtoSchema = z.object({
  "step": z.number(),
  "status": z.enum(["PENDING", "DONE"]),
  "startedAt": z.optional(z.string()),
  "doneAt": z.optional(z.string()),
});
export type StepStateDto = z.infer<typeof StepStateDtoSchema>;

export const ApplicationStepsDtoSchema = z.object({
  "verification": StepStateDtoSchema,
  "profile": StepStateDtoSchema,
  "employment": StepStateDtoSchema,
  "salary": StepStateDtoSchema,
  "eligibility": StepStateDtoSchema,
  "offer": StepStateDtoSchema,
  "terms": StepStateDtoSchema,
  "documents": StepStateDtoSchema,
  "identity": StepStateDtoSchema,
  "offerLetter": StepStateDtoSchema,
  "mandates": StepStateDtoSchema,
  "submit": StepStateDtoSchema,
});
export type ApplicationStepsDto = z.infer<typeof ApplicationStepsDtoSchema>;

export const MaskedContactDtoSchema = z.object({
  "id": z.string(),
  "type": z.enum(["phone", "email"]),
  "masked": z.string(),
});
export type MaskedContactDto = z.infer<typeof MaskedContactDtoSchema>;

export const EmploymentResponseDtoSchema = z.object({
  "type": z.enum(["federal", "state", "paramilitary", "nysc"]),
  "mdaCode": z.optional(z.string()),
  "employerId": z.optional(z.string()),
  "monthsLeftInService": z.optional(z.number()),
});
export type EmploymentResponseDto = z.infer<typeof EmploymentResponseDtoSchema>;

export const SalaryViewDtoSchema = z.object({
  "bankCode": z.string(),
  "bankName": z.optional(z.string()),
  "accountName": z.string(),
  "accountNumberMasked": z.string(),
  "ippisNumber": z.optional(z.string()),
  "serviceNumber": z.optional(z.string()),
});
export type SalaryViewDto = z.infer<typeof SalaryViewDtoSchema>;

export const EligibilitySummaryDtoSchema = z.object({
  "outcome": z.enum(["APPROVE", "REFER", "DECLINE"]),
  "source": z.string(),
  "expiresAt": z.string(),
  "expired": z.boolean(),
});
export type EligibilitySummaryDto = z.infer<typeof EligibilitySummaryDtoSchema>;

export const FeeDtoSchema = z.object({
  "name": z.optional(z.string()),
  "type": z.optional(z.string()),
  "amount": z.number(),
});
export type FeeDto = z.infer<typeof FeeDtoSchema>;

export const QuoteCalculationDtoSchema = z.object({
  "loanAmount": z.number(),
  "duration": z.number(),
  "rate": z.nullable(z.number()),
  "interest": z.number(),
  "fees": z.array(FeeDtoSchema),
  "totalRepayment": z.number(),
  "installmentRepayment": z.number(),
  "startDate": z.optional(z.string()),
  "firstRepaymentDate": z.optional(z.string()),
  "lastRepaymentDate": z.optional(z.string()),
  "endDate": z.optional(z.string()),
  "schedule": z.array(z.record(z.string(), z.unknown())),
});
export type QuoteCalculationDto = z.infer<typeof QuoteCalculationDtoSchema>;

export const LockedOfferDtoSchema = z.object({
  "productId": z.string(),
  "caltosProductId": z.string(),
  "productName": z.string(),
  "amount": z.number(),
  "tenorMonths": z.number(),
  "referralCode": z.optional(z.string()),
  "calculation": QuoteCalculationDtoSchema,
  "lockedAt": z.string(),
});
export type LockedOfferDto = z.infer<typeof LockedOfferDtoSchema>;

export const ReviewDtoSchema = z.object({
  "required": z.boolean(),
  "reasons": z.array(z.string()),
  "reviewHold": z.optional(z.boolean()),
});
export type ReviewDto = z.infer<typeof ReviewDtoSchema>;

export const ApplicationViewDtoSchema = z.object({
  "id": z.string(),
  "status": z.enum(["DRAFT", "UNDER_REVIEW", "SUBMITTED", "FAILED", "CANCELLED"]),
  "reference": z.nullable(z.string()),
  "steps": ApplicationStepsDtoSchema,
  "suggestedNext": z.nullable(z.string()),
  "returningCustomer": z.boolean(),
  "otpVerified": z.boolean(),
  "contacts": z.optional(z.array(MaskedContactDtoSchema)),
  "employment": z.optional(EmploymentResponseDtoSchema),
  "salary": z.optional(SalaryViewDtoSchema),
  "eligibility": z.optional(EligibilitySummaryDtoSchema),
  "offer": z.optional(LockedOfferDtoSchema),
  "review": z.optional(ReviewDtoSchema),
  "createdAt": z.string(),
  "updatedAt": z.string(),
});
export type ApplicationViewDto = z.infer<typeof ApplicationViewDtoSchema>;

export const BankItemDtoSchema = z.object({
  "code": z.string(),
  "name": z.string(),
});
export type BankItemDto = z.infer<typeof BankItemDtoSchema>;

export const CancelApplicationDtoSchema = z.object({
  "reason": z.optional(z.string()),
});
export type CancelApplicationDto = z.infer<typeof CancelApplicationDtoSchema>;

export const RevocableMandateDtoSchema = z.object({
  "provider": z.string(),
  "externalId": z.nullable(z.string()),
});
export type RevocableMandateDto = z.infer<typeof RevocableMandateDtoSchema>;

export const CancelledResponseDtoSchema = z.object({
  "cancelled": z.boolean(),
  "cancelledAt": z.string(),
  "mandatesNeedingRevocation": z.array(RevocableMandateDtoSchema),
});
export type CancelledResponseDto = z.infer<typeof CancelledResponseDtoSchema>;

export const ClosedResponseDtoSchema = z.object({
  "closed": z.boolean(),
});
export type ClosedResponseDto = z.infer<typeof ClosedResponseDtoSchema>;

export const SupportChannelsDtoSchema = z.object({
  "whatsapp": z.nullable(z.string()),
  "email": z.nullable(z.string()),
  "phone": z.nullable(z.string()),
});
export type SupportChannelsDto = z.infer<typeof SupportChannelsDtoSchema>;

export const ContactUnreachableResponseDtoSchema = z.object({
  "recorded": z.boolean(),
  "support": SupportChannelsDtoSchema,
});
export type ContactUnreachableResponseDto = z.infer<typeof ContactUnreachableResponseDtoSchema>;

export const DocumentItemDtoSchema = z.object({
  "fileId": z.string(),
  "fileName": z.string(),
  "documentType": z.enum(["gov-id", "payslip", "selfie-with-id", "terms-video"]),
  "contentType": z.string(),
  "createdAt": z.string(),
});
export type DocumentItemDto = z.infer<typeof DocumentItemDtoSchema>;

export const DocumentStatusDtoSchema = z.object({
  "documents": z.array(DocumentItemDtoSchema),
  "required": z.array(z.enum(["gov-id", "payslip", "selfie-with-id", "terms-video"])),
  "missing": z.array(z.enum(["gov-id", "payslip", "selfie-with-id", "terms-video"])),
  "identityRequired": z.array(z.enum(["gov-id", "payslip", "selfie-with-id", "terms-video"])),
  "identityMissing": z.array(z.enum(["gov-id", "payslip", "selfie-with-id", "terms-video"])),
  "identityDone": z.optional(z.boolean()),
  "digisignAvailable": z.optional(z.boolean()),
});
export type DocumentStatusDto = z.infer<typeof DocumentStatusDtoSchema>;

export const EligibleOfferDtoSchema = z.object({
  "productId": z.string(),
  "name": z.string(),
  "category": z.string(),
  "minAmount": z.number(),
  "maxAmount": z.number(),
  "suggestedAmount": z.number(),
  "defaultTenorMonths": z.number(),
  "tenorOptions": z.array(z.number()),
  "calculation": QuoteCalculationDtoSchema,
});
export type EligibleOfferDto = z.infer<typeof EligibleOfferDtoSchema>;

export const EmployerItemDtoSchema = z.object({
  "id": z.string(),
  "name": z.string(),
});
export type EmployerItemDto = z.infer<typeof EmployerItemDtoSchema>;

export const EmploymentDtoSchema = z.object({
  "type": z.enum(["federal", "state", "paramilitary", "nysc"]),
  "mdaCode": z.optional(z.string()),
  "employerId": z.optional(z.string()),
  "monthsLeftInService": z.optional(z.number()),
});
export type EmploymentDto = z.infer<typeof EmploymentDtoSchema>;

export const EmploymentTypeItemDtoSchema = z.object({
  "code": z.string(),
  "name": z.string(),
  "description": z.string(),
  "status": z.enum(["AVAILABLE", "COMING_SOON"]),
});
export type EmploymentTypeItemDto = z.infer<typeof EmploymentTypeItemDtoSchema>;

export const IdentityStatusDtoSchema = z.object({
  "digisignAvailable": z.boolean(),
  "status": z.enum(["NOT_STARTED", "PENDING", "VERIFIED", "REVIEW", "FAILED"]),
  "done": z.boolean(),
  "via": z.optional(z.enum(["digisign", "uploads"])),
  "signingUrl": z.optional(z.url().check(z.refine(value => new URL(value).protocol === "https:", "HTTPS required"))),
  "expiresAt": z.optional(z.string()),
  "failureReason": z.optional(z.string()),
});
export type IdentityStatusDto = z.infer<typeof IdentityStatusDtoSchema>;

export const MandateItemDtoSchema = z.object({
  "provider": z.string(),
  "kind": z.enum(["DIRECT_DEBIT", "SALARY"]),
  "status": z.enum(["PENDING", "REQUIRES_ACTION", "ACTIVE", "FAILED", "STOPPED"]),
  "actionUrl": z.nullable(z.url().check(z.refine(value => new URL(value).protocol === "https:", "HTTPS required"))),
  "errorMessage": z.nullable(z.string()),
});
export type MandateItemDto = z.infer<typeof MandateItemDtoSchema>;

export const MandatesResponseDtoSchema = z.object({
  "complete": z.boolean(),
  "mandates": z.array(MandateItemDtoSchema),
});
export type MandatesResponseDto = z.infer<typeof MandatesResponseDtoSchema>;

export const MdaItemDtoSchema = z.object({
  "code": z.string(),
  "name": z.string(),
  "state": z.string(),
});
export type MdaItemDto = z.infer<typeof MdaItemDtoSchema>;

export const OfferLetterResponseDtoSchema = z.object({
  "html": z.string(),
  "hash": z.string(),
  "accepted": z.boolean(),
});
export type OfferLetterResponseDto = z.infer<typeof OfferLetterResponseDtoSchema>;

export const OffersResponseDtoSchema = z.object({
  "outcome": z.enum(["APPROVE", "REFER", "DECLINE"]),
  "source": z.string(),
  "monthlyIncome": z.nullable(z.number().check(z.nonnegative())),
  "expiresAt": z.string(),
  "manualReview": z.boolean(),
  "offers": z.array(EligibleOfferDtoSchema),
});
export type OffersResponseDto = z.infer<typeof OffersResponseDtoSchema>;

export const PresignDocumentDtoSchema = z.object({
  "fileName": z.string(),
  "contentType": z.string(),
  "sizeBytes": z.number(),
  "documentType": z.enum(["gov-id", "payslip", "selfie-with-id", "terms-video"]),
});
export type PresignDocumentDto = z.infer<typeof PresignDocumentDtoSchema>;

export const PresignDocumentResponseDtoSchema = z.object({
  "fileId": z.string(),
  "uploadUrl": z.string(),
  "uploadMethod": z.enum(["PUT"]),
  "uploadHeaders": z.record(z.string(), z.string()),
  "expiresIn": z.number(),
  "status": DocumentStatusDtoSchema,
});
export type PresignDocumentResponseDto = z.infer<typeof PresignDocumentResponseDtoSchema>;

export const ProfileDtoSchema = z.object({
  "streetAddress": z.string(),
  "state": z.string(),
  "lga": z.string(),
  "relationshipStatus": z.enum(["single", "married", "divorced", "widowed", "separated"]),
  "religion": z.optional(z.string()),
  "email": z.optional(z.string()),
});
export type ProfileDto = z.infer<typeof ProfileDtoSchema>;

export const ProfileNameDtoSchema = z.object({
  "firstName": z.optional(z.string()),
  "lastName": z.optional(z.string()),
  "middleName": z.optional(z.string()),
  "fullName": z.optional(z.string()),
});
export type ProfileNameDto = z.infer<typeof ProfileNameDtoSchema>;

export const ProfileValuesDtoSchema = z.object({
  "streetAddress": z.optional(z.string()),
  "state": z.optional(z.string()),
  "lga": z.optional(z.string()),
  "relationshipStatus": z.optional(z.string()),
  "religion": z.optional(z.string()),
  "email": z.optional(z.string()),
});
export type ProfileValuesDto = z.infer<typeof ProfileValuesDtoSchema>;

export const ProfileFormResponseDtoSchema = z.object({
  "name": ProfileNameDtoSchema,
  "dateOfBirth": z.optional(z.string()),
  "gender": z.optional(z.string()),
  "profile": ProfileValuesDtoSchema,
  "returningCustomer": z.boolean(),
  "done": z.boolean(),
});
export type ProfileFormResponseDto = z.infer<typeof ProfileFormResponseDtoSchema>;

export const QuoteDtoSchema = z.object({
  "productId": z.string(),
  "amount": z.number(),
  "tenorMonths": z.number(),
  "referralCode": z.optional(z.string()),
});
export type QuoteDto = z.infer<typeof QuoteDtoSchema>;

export const QuoteResponseDtoSchema = z.object({
  "eligible": z.boolean(),
  "productId": z.optional(z.string()),
  "productName": z.optional(z.string()),
  "amount": z.optional(z.number()),
  "tenorMonths": z.optional(z.number()),
  "referralCode": z.optional(z.string()),
  "calculation": z.optional(QuoteCalculationDtoSchema),
  "reason": z.optional(z.enum(["AMOUNT_EXCEEDS_ELIGIBILITY", "REPAYMENT_EXCEEDS_ELIGIBILITY", "AMOUNT_BELOW_MINIMUM", "TENOR_NOT_ALLOWED", "CALCULATION_REJECTED"])),
  "message": z.optional(z.string()),
  "requestedAmount": z.optional(z.number()),
  "requestedTenorMonths": z.optional(z.number()),
  "maxAmountForTenor": z.optional(z.number()),
  "maxMonthlyRepayment": z.optional(z.number()),
  "minAmount": z.optional(z.number()),
  "allowedTenors": z.optional(z.array(z.number())),
});
export type QuoteResponseDto = z.infer<typeof QuoteResponseDtoSchema>;

export const ResolveAccountDtoSchema = z.object({
  "bankCode": z.string(),
  "accountNumber": z.string(),
});
export type ResolveAccountDto = z.infer<typeof ResolveAccountDtoSchema>;

export const ResolveAccountResponseDtoSchema = z.object({
  "accountName": z.string(),
  "nameMatchesBvn": z.boolean(),
});
export type ResolveAccountResponseDto = z.infer<typeof ResolveAccountResponseDtoSchema>;

export const SalaryDtoSchema = z.object({
  "bankCode": z.string(),
  "accountNumber": z.string(),
  "ippisNumber": z.optional(z.string()),
  "serviceNumber": z.optional(z.string()),
});
export type SalaryDto = z.infer<typeof SalaryDtoSchema>;

export const SendOtpDtoSchema = z.object({
  "contactId": z.string(),
  "phoneNumber": z.optional(z.string()),
});
export type SendOtpDto = z.infer<typeof SendOtpDtoSchema>;

export const SendOtpResponseDtoSchema = z.object({
  "channel": z.enum(["sms", "email"]),
  "expiresAt": z.string(),
  "resendAfterSeconds": z.number(),
  "devCode": z.optional(z.string()),
});
export type SendOtpResponseDto = z.infer<typeof SendOtpResponseDtoSchema>;

export const StartApplicationDtoSchema = z.object({
  "bvn": z.string(),
  "consent": z.boolean(),
  "noticeVersion": z.optional(z.string()),
});
export type StartApplicationDto = z.infer<typeof StartApplicationDtoSchema>;

export const StartApplicationResponseDtoSchema = z.object({
  "id": z.string(),
  "status": z.enum(["DRAFT", "UNDER_REVIEW", "SUBMITTED", "FAILED", "CANCELLED"]),
  "reference": z.nullable(z.string()),
  "steps": ApplicationStepsDtoSchema,
  "suggestedNext": z.nullable(z.string()),
  "returningCustomer": z.boolean(),
  "otpVerified": z.boolean(),
  "contacts": z.optional(z.array(MaskedContactDtoSchema)),
  "employment": z.optional(EmploymentResponseDtoSchema),
  "salary": z.optional(SalaryViewDtoSchema),
  "eligibility": z.optional(EligibilitySummaryDtoSchema),
  "offer": z.optional(LockedOfferDtoSchema),
  "review": z.optional(ReviewDtoSchema),
  "createdAt": z.string(),
  "updatedAt": z.string(),
  "resumeToken": z.string(),
  "resumed": z.boolean(),
});
export type StartApplicationResponseDto = z.infer<typeof StartApplicationResponseDtoSchema>;

export const StateItemDtoSchema = z.object({
  "code": z.string(),
  "name": z.string(),
});
export type StateItemDto = z.infer<typeof StateItemDtoSchema>;

export const SubmissionStatusDtoSchema = z.object({
  "reference": z.nullable(z.string()),
  "status": z.enum(["DRAFT", "UNDER_REVIEW", "SUBMITTED", "FAILED", "CANCELLED"]),
  "manualReview": z.boolean(),
  "reviewReasons": z.array(z.string()),
  "pendingSteps": z.array(z.enum(["terms", "mandates"])),
  "loanId": z.nullable(z.string()),
});
export type SubmissionStatusDto = z.infer<typeof SubmissionStatusDtoSchema>;
