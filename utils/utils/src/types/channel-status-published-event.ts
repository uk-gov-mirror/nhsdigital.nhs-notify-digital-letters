import { z } from 'zod';

export const $ChannelStatusPublishedEvent = z.object({
  data: z.object({
    messageReference: z.string(),
    supplierStatus: z.literal('paper_letter_opted_out'),
  }),
});

export type ChannelStatusPublishedEvent = z.infer<
  typeof $ChannelStatusPublishedEvent
>;
