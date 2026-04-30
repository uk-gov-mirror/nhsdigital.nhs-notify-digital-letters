import { AWS_ACCOUNT_ID_SAFE } from 'constants/backend-constants';

// senderIds
export const SENDER_ID_VALID_FOR_NOTIFY_SANDBOX =
  '2b8ebb33-8b33-49bd-949e-c12e22d25320';
export const SENDER_ID_THAT_TRIGGERS_ERROR_IN_NOTIFY_SANDBOX =
  'f017669b-6da4-4576-9d59-3d2b7f005ae2';
export const SENDER_ID_SKIPS_NOTIFY = '67403568-166e-41d0-900a-1f31fe93a091';

export const EXISTING_SENDER_IDS = [
  SENDER_ID_VALID_FOR_NOTIFY_SANDBOX,
  SENDER_ID_THAT_TRIGGERS_ERROR_IN_NOTIFY_SANDBOX,
  SENDER_ID_SKIPS_NOTIFY,
];

export const ENVIRONMENT_SPECIFIC_CONSTANTS = {
  // Suppliers Dev Account (Sandbox)
  '820178564574': {
    nhsAppBaseUrl: 'https://example.com',
    routingConfigId: 'b838b13c-f98c-4def-93f0-515d4e4f4ee1',
  },

  // Suppliers Non Prod Account (Int)
  '885964308133': {
    nhsAppBaseUrl: 'https://www-onboardingaos.nhsapp.service.nhs.uk',
    routingConfigId: 'c940a9ce-e70d-4986-8046-afd168b39738',
  },
};

export const NHS_APP_BASE_URL =
  ENVIRONMENT_SPECIFIC_CONSTANTS[
    AWS_ACCOUNT_ID_SAFE as keyof typeof ENVIRONMENT_SPECIFIC_CONSTANTS
  ].nhsAppBaseUrl;

export const ROUTING_CONFIG_ID =
  ENVIRONMENT_SPECIFIC_CONSTANTS[
    AWS_ACCOUNT_ID_SAFE as keyof typeof ENVIRONMENT_SPECIFIC_CONSTANTS
  ].routingConfigId;
