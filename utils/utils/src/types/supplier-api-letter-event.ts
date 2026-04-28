import { z } from 'zod';

export const $SupplierApiLetterEvent = z.object({
  data: z.object({
    origin: z.object({
      subject: z.string(),
    }),
    specificationId: z.string(),
    status: z.string(),
    supplierId: z.string(),
  }),
  time: z.string(),
});

export type SupplierApiLetterEvent = z.infer<
  typeof $SupplierApiLetterEvent
>;
