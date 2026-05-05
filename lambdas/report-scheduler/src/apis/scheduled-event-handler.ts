import { EventPublisher } from 'utils';
import { ISenderManagement } from 'sender-management';
import { GenerateReport, validateGenerateReport } from 'digital-letters-events';
import { randomUUID } from 'node:crypto';

export type CreateHandlerDependencies = {
  senderManagement: ISenderManagement;
  eventPublisher: EventPublisher;
};

export const createHandler = ({
  eventPublisher,
  senderManagement,
}: CreateHandlerDependencies) => {
  return async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];

    const senders = await senderManagement.listSenders();

    await eventPublisher.sendEvents<GenerateReport>(
      senders.map((sender) => ({
        data: {
          senderId: sender.senderId,
          reportDate: yesterdayString,
        },
        specversion: '1.0',
        id: randomUUID(),
        plane: 'data',
        dataschemaversion: '1.0.0',
        datacontenttype: 'application/json',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-reporting-generate-report-data.schema.json',
        source:
          '/nhs/england/notify/production/primary/digitalletters/reporting', // CCM-13892
        subject: `customer/${sender.senderId}`,
        type: 'uk.nhs.notify.digital.letters.reporting.generate.report.v1',
        time: new Date().toISOString(),
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01', // CCM-14255
        recordedtime: new Date().toISOString(),
        severitynumber: 2,
      })),
      validateGenerateReport,
    );
  };
};
