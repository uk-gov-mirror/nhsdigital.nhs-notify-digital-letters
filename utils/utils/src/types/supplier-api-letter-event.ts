import { z } from 'zod';

export const $SupplierApiLetterEvent = z.object({
  data: z.object({
    origin: z.object({
      subject: z
        .string()
        .regex(
          /^client\/[^/]+\/letter-request\/[^/]+$/,
          'Subject must be in format: client/{senderId}/letter-request/{messageReference}',
        ),
    }),
    specificationId: z.string(),
    status: z.enum([
      'PENDING',
      'RETURNED',
      'DISPATCHED',
      'PRINTED',
      'REJECTED',
      'ACCEPTED',
      'FAILED',
      'CANCELLED',
      'FORWARDED',
      'DELIVERED',
      'ENCLOSED',
    ]),
    supplierId: z.string(),
    reasonCode: z.string().optional(),
    reasonText: z.string().optional(),
  }),
  time: z.string(),
});

export type SupplierApiLetterEvent = z.infer<typeof $SupplierApiLetterEvent>;
