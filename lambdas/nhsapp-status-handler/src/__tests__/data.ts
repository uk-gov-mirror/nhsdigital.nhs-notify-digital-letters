import { MESHInboxMessageDownloaded } from 'digital-letters-events';
import { ChannelStatusPublishedEvent } from 'utils';

export const messageDownloadedEvent: MESHInboxMessageDownloaded = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  specversion: '1.0',
  source: '/nhs/england/notify/production/primary/digitalletters/mesh',
  subject:
    'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
  type: 'uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1',
  plane: 'data',
  time: '2023-06-20T12:00:00Z',
  recordedtime: '2023-06-20T12:00:00.250Z',
  severitynumber: 2,
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  datacontenttype: 'application/json',
  dataschema:
    'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-downloaded-data.schema.json',
  dataschemaversion: '1.0.0',
  severitytext: 'INFO',
  data: {
    meshMessageId: '12345',
    senderId: 'sender1',
    messageReference: 'ref1',
    messageUri: 'https://example.com/ttl/resource',
  },
};

export const nhsAppStatusEvent: ChannelStatusPublishedEvent = {
  data: {
    messageReference: `${messageDownloadedEvent.data.senderId}_${messageDownloadedEvent.data.messageReference}`,
    supplierStatus: 'paper_letter_opted_out',
  },
};
