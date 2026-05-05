/* eslint-disable no-console */

import { generateGuardFunctions } from 'generate-guard-functions';

generateGuardFunctions().catch((error) => {
  console.error('Error generating guard functions:', error);
  throw error;
});
