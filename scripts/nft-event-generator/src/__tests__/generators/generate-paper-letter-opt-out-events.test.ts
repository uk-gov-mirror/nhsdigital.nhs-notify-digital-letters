import { generatePaperLetterOptOutEvents } from 'generators/paper-letter-opt-out-events';
import { PaperLetterOptOutRow } from 'utils/csv-reader';

const environment = 'nft';

const sampleRows: PaperLetterOptOutRow[] = [
  {
    messageReference: '037f5f76-352c-445f-89a7-c3d18776ce86',
    senderId: 'sender-001',
  },
];

describe('generatePaperLetterOptOutEvents', () => {
  it('should generate events in the expected format', () => {
    const events = generatePaperLetterOptOutEvents({
      csvRows: sampleRows,
      environment,
    });

    expect(events[0]).toStrictEqual({
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
      id: expect.any(String),
      time: expect.any(String),
      source: '/nhs/england/notify/comms-mgr-test/test/data-plane/messaging',
      data: {
        messageReference: sampleRows[0].messageReference,
        clientId: sampleRows[0].senderId,
        messageId: '3COesqsClaLyf0WNuLuhz1RDbWs',
        channel: 'nhsapp',
        channelStatus: 'delivered',
        previousChannelStatus: 'delivered',
        supplierStatus: 'paper_letter_opted_out',
        previousSupplierStatus: 'read',
        cascadeType: 'primary',
        cascadeOrder: 1,
        timestamp: expect.any(String),
        retryCount: 0,
      },
    });
  });
});
