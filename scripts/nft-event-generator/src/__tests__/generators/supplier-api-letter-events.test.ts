import { generateSupplierApiLetterEvents } from 'generators/supplier-api-letter-events';

const SENDER_ID = '00f3b388-bbe9-41c9-9e76-052d37ee8988';
const SCHEMA_VERSION = '1.0.17';
const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
const DOMAIN_ID = `${SENDER_ID}_2503cbd5-6722-4e90-9fbd-5f1e96d65c22`;

describe('generateSupplierApiLetterEvents', () => {
  it('should generate events in the expected format', () => {
    const environment = 'test';
    const status = 'PRINTED';
    const generatedEvents = generateSupplierApiLetterEvents({
      status,
      environment,
      numberOfEvents: 1,
    });

    expect(generatedEvents).toHaveLength(1);

    const generatedEvent = generatedEvents[0];
    expect(generatedEvent).toStrictEqual({
      specversion: '1.0',
      plane: 'data',
      datacontenttype: 'application/json',
      dataschemaversion: SCHEMA_VERSION,
      severitynumber: 2,
      severitytext: 'INFO',
      traceparent: TRACEPARENT,
      id: expect.any(String),
      time: expect.any(String),
      recordedtime: expect.any(String),
      source: `/data-plane/supplier-api/${environment}/update-status`,
      type: `uk.nhs.notify.supplier-api.letter.${status}.v1`,
      dataschema: `https://notify.nhs.uk/cloudevents/schemas/supplier-api/letter.${status}.${SCHEMA_VERSION}.schema.json`,
      subject: expect.stringMatching(
        new RegExp(`^letter-origin/letter-rendering/letter/${SENDER_ID}_`),
      ),
      data: {
        domainId: DOMAIN_ID,
        billingRef: '1y3q9v1zzzz',
        groupId: 'client_template',
        specificationId: '1y3q9v1zzzz',
        supplierId: 'supplier-1',
        status,
        origin: {
          domain: 'letter-rendering',
          event: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          source: '/data-plane/letter-rendering/prod/render-pdf',
          subject: expect.stringMatching(
            new RegExp(`^client/${SENDER_ID}/letter-request/`),
          ),
        },
      },
    });
  });

  it('should use the provided fixed values', () => {
    const fixedId = '11111111-1111-1111-1111-111111111111';
    const fixedTime = '2024-01-15T10:30:00.000Z';
    const fixedSubject = 'my-custom-subject';
    const fixedMessageReference = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const generatedEvents = generateSupplierApiLetterEvents({
      status: 'ACCEPTED',
      environment: 'test',
      numberOfEvents: 1,
      id: fixedId,
      time: fixedTime,
      subject: fixedSubject,
      messageReference: fixedMessageReference,
    });

    const event = generatedEvents[0];
    expect(event.id).toBe(fixedId);
    expect(event.time).toBe(fixedTime);
    expect(event.subject).toBe(fixedSubject);
    expect(event.data.origin.subject).toBe(
      `client/${SENDER_ID}/letter-request/${fixedMessageReference}`,
    );
  });

  it('should generate unique ids per event when no id is provided', () => {
    const generatedEvents = generateSupplierApiLetterEvents({
      status: 'ACCEPTED',
      environment: 'test',
      numberOfEvents: 5,
    });

    const ids = generatedEvents.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });
});
