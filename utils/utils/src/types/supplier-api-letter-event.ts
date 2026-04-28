import { z } from 'zod';

export const $SupplierApiLetterEvent = z.object({
  data: z.object({
    origin: z.object({
      subject: z.string(),
    }),
    specificationId: z.string(),
    status: z.enum([
      'RETURNED',
      'DISPATCHED',
      'PRINTED',
      'REJECTED',
      'ACCEPTED',
      'FAILED',
    ]),
    supplierId: z.string(),
    reasonCode: z.string().optional(),
    reasonText: z.string().optional(),
  }),
  time: z.string(),
});

export type SupplierApiLetterEvent = z.infer<typeof $SupplierApiLetterEvent>;
