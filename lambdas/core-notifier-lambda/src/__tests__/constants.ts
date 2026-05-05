import type {
  SingleMessageRequest,
  SingleMessageResponse,
} from 'domain/request';
import { Sender } from 'utils';

import { PDMResourceAvailable } from 'digital-letters-events';

export const mockRequest1: SingleMessageRequest = {
  data: {
    type: 'Message',
    attributes: {
      routingPlanId: 'routing-plan-id',
      messageReference: 'request-item-id_request-item-plan-id',
      billingReference:
        'test-client-id_test-campaign-id_test-billing-reference',
      recipient: {
        nhsNumber: '9999999786',
      },
      originator: {
        odsCode: 'A12345',
      },
      personalisation: {
        digitalLetterURL:
          'https://example.com/patient/digital-letters/letter?id=12345',
      },
    },
  },
};

export const mockRequest2 = {
  ...mockRequest1,
  recipient: {
    nhsNumber: '9999999788',
  },
};

export const mockResponse: SingleMessageResponse = {
  data: {
    type: 'Message',
    id: '30XcAOfwjq59r72AQTjxL4V7Heg',
    attributes: {
      messageReference: '6e6aca3f-9e83-4c37-8bc0-b2bb0b2c7e0d',
      messageStatus: 'created',
      timestamps: {
        created: '2025-07-29T08:20:13.408Z',
      },
      routingPlan: {
        id: 'fc4f8c6b-1547-4216-9237-c7027c97ae60',
        version: '4HMorh_sMD7kr98GL43u0KR3qZNik4dW',
        createdDate: '2025-07-23T10:34:13.000Z',
        name: 'SMS nudge V1.0',
      },
    },
    links: {
      self: 'https://some.url/comms/v1/messages/30XcAOfwjq59r72AQTjxL4V7Heg',
    },
  },
};

export const validPdmEvent: PDMResourceAvailable = {
  id: 'event-id-123',
  plane: 'data',
  dataschemaversion: '1.0.0',
  source: '/nhs/england/notify/development/dev-12345/digitalletters/pdm',
  dataschema:
    'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-available-data.schema.json',
  specversion: '1.0',
  type: 'uk.nhs.notify.digital.letters.pdm.resource.available.v1',
  time: '2025-12-15T10:00:00Z',
  datacontenttype: 'application/json',
  subject: 'message-subject-123',
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  recordedtime: '2025-12-15T10:00:00Z',
  severitynumber: 2,
  data: {
    senderId: 'sender-123',
    messageReference: 'msg-ref-123',
    resourceId: 'f5524783-e5d7-473e-b2a0-29582ff231da',
    nhsNumber: '9991234566',
    odsCode: 'A12345',
  },
};

export const validSender: Sender = {
  senderId: 'sender-123',
  routingConfigId: 'routing-config-123',
  senderName: 'Test Sender',
  meshMailboxSenderId: 'meshMailBoxSender-123',
  meshMailboxReportsId: 'meshMailBoxReports-123',
  fallbackWaitTimeSeconds: 100,
};
