import { type ComAtprotoLabelDefs } from '@atproto/api';
import { type LoginCredentials, setLabelerLabelDefinitions } from '@skyware/labeler/scripts';
import { promises as fs } from 'fs';

import { BSKY_IDENTIFIER, BSKY_PASSWORD, DID } from './config.ts';
//import { LABELS } from './constants.js';
import logger from './logger.ts';

const loginCredentials: LoginCredentials = {
  identifier: DID,
  password: BSKY_PASSWORD,
};
console.log(
  `Using identifier: ${loginCredentials.identifier},${loginCredentials.password ? ' password provided' : ' no password'}`,
);

const content = await fs.readFile(`countries.json`, 'utf8');
const countries = JSON.parse(content);

const labelDefinitions: ComAtprotoLabelDefs.LabelValueDefinition[] = [];

for (const [key, country] of Object.entries(countries)) {
  const labelValueDefinition: ComAtprotoLabelDefs.LabelValueDefinition = {
    identifier: `country-${country.iso2.toLowerCase()}`,
    severity: 'inform',
    blurs: 'none',
    defaultSetting: 'warn',
    adultOnly: false,
    locales: [{ lang: 'en', name: country.name, description: country.name }],
  };

  labelDefinitions.push(labelValueDefinition);
}

// console.log(JSON.stringify(labelDefinitions, null, 2));
// process.exit(0);

try {
  await setLabelerLabelDefinitions(loginCredentials, labelDefinitions);
  logger.info('Label definitions set successfully.');
} catch (error) {
  logger.error(`Error setting label definitions: ${error}`);
}
