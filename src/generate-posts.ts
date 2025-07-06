import { Bot } from '@skyware/bot';
import { parse } from 'csv-parse/sync';
import { promises as fs } from 'fs';

import { BSKY_IDENTIFIER, BSKY_PASSWORD } from './config.js';
import { Label } from './types.ts';

interface Country {
  iso2: string;
  iso3: string;
  iso_numeric: string;
  fips: string;
  country: string;
  capital: string;
}

const bot = new Bot();

try {
  await bot.login({
    identifier: BSKY_IDENTIFIER,
    password: BSKY_PASSWORD,
  });
} catch (error) {
  console.error('Error logging in: ', error);
  process.exit(1);
}

process.stdout.write('WARNING: This will delete all posts in your profile. Are you sure you want to continue? (y/n) ');

const answer = await new Promise((resolve) => {
  process.stdin.once('data', (data) => {
    resolve(data.toString().trim().toLowerCase());
  });
});

if (answer != 'y') {
  console.log('Operation cancelled.');
  process.exit(1);
}

const postsToDelete = await bot.profile.getPosts();
console.log(`Deleting ${postsToDelete.posts.length} posts...`);
for (const post of postsToDelete.posts) {
  await post.delete();
}
console.log('All posts have been deleted.');

const content = await fs.readFile(`countryInfo.txt`, 'utf8');
const records = parse(content, {
  bom: true,
  delimiter: '\t',
  comment: '#',
  columns: false,
  skip_empty_lines: true,
  relaxColumnCount: true,
}) as string[][];

let countries: Country[] = records.map((record: string[]) => {
  const [iso2, iso3, iso_numeric, fips, country, capital] = record;
  return {
    iso2,
    iso3,
    iso_numeric,
    fips,
    country,
    capital,
  } as Country;
});


const topCountryISO2: string[] = ['US', 'CA', 'GB', 'AU', 'NZ', 'FR', 'DE', 'IT', 'BR', 'IN', 'ID'];
const topCountries: Country[] = topCountryISO2.map(iso2 => countries.find(x => x.iso2 === iso2)).filter(x => x !== undefined);
const otherCountries: Country[] = countries.filter((country) => !topCountryISO2.includes(country.iso2));

topCountries.sort((a, b) => topCountries.indexOf(b) - topCountries.indexOf(a));
otherCountries.sort((a, b) => -a.country.localeCompare(b.country));
countries = [...otherCountries, ...topCountries];

const output: Label[] = [];

for (const country of countries) {
  const post = await bot.post({
    text: country.country,
    threadgate: { allowLists: [] },
  });

  const rkey = post.uri.split('/').pop()!;
  output.push({
    rkey,
    identifier: `country-${country.iso2.toLowerCase()}`,
    locales: [{ lang: 'en', name: country.country, description: country.country }],
  });
}

await fs.writeFile('countries.json', JSON.stringify(output, null, 2));
console.log('Countries have been posted and saved to countries.json.');

const deletePost = await bot.post({ text: 'Like this post to delete all labels.' });
const deletePostRkey = deletePost.uri.split('/').pop()!;
console.log('Delete post rkey:');
console.log(`export const DELETE = '${deletePostRkey}';`);

process.exit(0);
