#!/usr/bin/env npx ts-node

import 'dotenv/config';
import { AgentQLService } from './src/services/content/agentql.service';
import { ScraperService } from './src/services/content/scraper.service';
import { logger } from './src/utils/logger';

async function testAgentQL() {
    const agentqlService = new AgentQLService();
    const scraperService = new ScraperService();
    const testUrl = 'https://laravel-news.com/route-shallow-resource';

    console.log('Testing Stealth Scraping + AgentQL with URL:', testUrl);
    console.log('=' .repeat(60));

    try {
        // Test stealth scraping + HTML extraction
        console.log('\n1. Testing stealth scraping + extractFromHtml():');
        const startTime = Date.now();

        console.log('Step 1: Scraping HTML with stealth mode...');
        const html = await scraperService.scrapeHtmlStealth(testUrl);
        const scrapingTime = Date.now();

        console.log('Step 2: Extracting content from HTML...');
        const extractedData = await agentqlService.extractFromHtml(html);
        const endTime = Date.now();

        console.log('\n--- EXTRACTION RESULTS ---');
        console.log('URL:', testUrl);
        console.log('Scraping time:', scrapingTime - startTime, 'ms');
        console.log('Extraction time:', endTime - scrapingTime, 'ms');
        console.log('Total processing time:', endTime - startTime, 'ms');
        console.log('HTML length:', html.length, 'characters');

        console.log('\n--- POST CONTENT ---');
        const contentPreview = extractedData.postContent.substring(0, 1000);
        console.log(contentPreview + (extractedData.postContent.length > 1000 ? '...' : ''));

        console.log('\n--- READ MORE LINKS ---');
        console.log('Found links:', extractedData.readMoreUrl.length);
        extractedData.readMoreUrl.forEach((link, index) => {
            console.log(`${index + 1}. ${link}`);
        });

        console.log('\n--- CONTENT STATS ---');
        console.log('Content length:', extractedData.postContent.length, 'characters');
        console.log('Word count (approx):', extractedData.postContent.split(/\s+/).length);
        console.log('Read more links count:', extractedData.readMoreUrl.length);

        console.log('\n--- SUCCESS ---');
        console.log('Stealth scraping + AgentQL extraction completed successfully!');

    } catch (error) {
        console.error('\n--- ERROR ---');
        console.error('Stealth scraping + AgentQL extraction failed:', error);

        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
    }
}

async function testScrapeUrl() {
    const scraperService = new ScraperService();
    const testUrl = 'https://laravel-news.com/route-shallow-resource';

    const content = await scraperService.scrapeUrl(testUrl);
    console.log('Scraped content:', content);
}

// testScrapeUrl();

// Run the test
testAgentQL()
    .then(() => {
        console.log('\nTest completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test failed with unhandled error:', error);
        process.exit(1);
    });