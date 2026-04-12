import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { WebNavigator } from './services/web-navigator.js';

const navigator = new WebNavigator({ headless: false });

try {
  console.log('Initializing WebNavigator...');
  await navigator.init();

  console.log('Navigating to google.com...');
  await navigator.navigate('https://www.google.com');

  console.log('Typing "Something" in the search box...');
  await navigator.act('Type "Something" in the search box');

  console.log('Clicking the search button...');
  await navigator.act('Click the Search button');

  console.log('Waiting for results is displayed');
  await navigator.act('Wait for results to be displayed');

  console.log('Taking screenshot...');
  const screenshot = await navigator.screenshot();
  writeFileSync('screenshot.png', screenshot);
  console.log(`Screenshot saved to screenshot.png (${screenshot.length} bytes)`);
} catch (error) {
  console.error('Error:', error);
} finally {
  await navigator.close();
}
