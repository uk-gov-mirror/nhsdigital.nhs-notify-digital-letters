import { randomUUID } from 'node:crypto';
import { type ChannelStatusPublishedEventV1 } from '@nhsdigital/nhs-notify-event-schemas-status-published';
import { PaperLetterOptOutRow } from 'utils/csv-reader';

/* eslint-disable no-console */

type GeneratePaperLetterOptOutEventsParams = {
  csvRows: PaperLetterOptOutRow[];
  environment: string;
};

function generatePaperLetterOptOutEvent(
  environment: string,
  row: PaperLetterOptOutRow,
): ChannelStatusPublishedEventV1 {
  const { messageReference, senderId } = row;

  return {
    specversion: '1.0',
    type: 'uk.nhs.notify.channel.status.PUBLISHED.v1',
    plane: 'data',
    datacontenttype: 'application/json',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/messaging/channel-status.published.1.0.1.schema.json',
    dataschemaversion: '1.0.1',
    sequence: '00000000000451468843',
    traceparent: '00-4d678967f96e353c07a0a31c1849b500-07f83ba58dd8df70-01',
    subject:
      'customer/037f5f76-352c-445f-89a7-c3d18776ce86/message/3COesqsClaLyf0WNuLuhz1RDbWs/plan/3COezubdtrUFJlDOV4ucAQ93Akr',
    id: randomUUID(),
    time: new Date().toISOString(),
    source: '/nhs/england/notify/comms-mgr-test/test/data-plane/messaging',
    data: {
      messageReference,
      clientId: senderId,
      messageId: '3COesqsClaLyf0WNuLuhz1RDbWs',
      channel: 'nhsapp',
      channelStatus: 'delivered',
      previousChannelStatus: 'delivered',
      supplierStatus: 'paper_letter_opted_out',
      previousSupplierStatus: 'read',
      cascadeType: 'primary',
      cascadeOrder: 1,
      timestamp: '2026-02-05T14:29:55Z',
      retryCount: 0,
    },
  };
}

export function generatePaperLetterOptOutEvents({
  csvRows,
  environment,
}: GeneratePaperLetterOptOutEventsParams): ChannelStatusPublishedEventV1[] {
  const events = csvRows.map((row) =>
    generatePaperLetterOptOutEvent(environment, row),
  );

  console.group('Event generation:');
  console.log(`Total events generated:\t\t${events.length}`);
  console.log(`Type:\t\t\t\tPaperLetterOptedOut`);
  console.groupEnd();

  return events;
}
