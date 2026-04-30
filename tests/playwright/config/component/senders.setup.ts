import { test as setup } from '@playwright/test';
import senderRepository from 'helpers/sender-helpers';
import { Sender } from 'utils';
import {
  ROUTING_CONFIG_ID,
  SENDER_ID_SKIPS_NOTIFY,
  SENDER_ID_THAT_TRIGGERS_ERROR_IN_NOTIFY_SANDBOX,
  SENDER_ID_VALID_FOR_NOTIFY_SANDBOX,
} from 'constants/tests-constants';

const testSenders: Sender[] = [
  {
    senderId: SENDER_ID_SKIPS_NOTIFY,
    senderName: 'Test Sender 1',
    meshMailboxSenderId: 'test-mesh-sender-1',
    meshMailboxReportsId: 'test-mesh-reports-1',
    fallbackWaitTimeSeconds: 24 * 3600,
  },
  {
    senderId: SENDER_ID_VALID_FOR_NOTIFY_SANDBOX,
    senderName: 'componentTestSender_RoutingConfig',
    meshMailboxSenderId: 'meshMailboxSender1',
    meshMailboxReportsId: 'meshMailboxReports1',
    routingConfigId: ROUTING_CONFIG_ID,
    fallbackWaitTimeSeconds: 100,
  },
  {
    senderId: SENDER_ID_THAT_TRIGGERS_ERROR_IN_NOTIFY_SANDBOX,
    senderName: 'componentTestSender_RoutingConfigInvalid',
    meshMailboxSenderId: 'meshMailboxSender2',
    meshMailboxReportsId: 'meshMailboxReports2',
    routingConfigId: 'invalid',
    fallbackWaitTimeSeconds: 100,
  },
];

setup('Create senders', async () => {
  for (const sender of testSenders) {
    await senderRepository.putSender(sender);
  }
});
