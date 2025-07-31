#!/usr/bin/env npx ts-node

import 'dotenv/config';
import { AgentQLService } from './src/services/content/agentql.service';
import { logger } from './src/utils/logger';

async function testAgentQL() {
    const agentqlService = new AgentQLService();
    const testUrl = 'https://freek.dev/2769-using-1password-for-laravel-environment-variables';

    console.log('Testing AgentQLService with URL:', testUrl);
    console.log('=' .repeat(60));

    try {
        // Test content extraction
        console.log('\n1. Testing extract():');
        const startTime = Date.now();
        const extractedData = await agentqlService.extract(testUrl);
        const endTime = Date.now();

        console.log('\n--- EXTRACTION RESULTS ---');
        console.log('URL:', testUrl);
        console.log('Processing time:', endTime - startTime, 'ms');

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
        console.log('AgentQL extraction completed successfully!');

    } catch (error) {
        console.error('\n--- ERROR ---');
        console.error('AgentQL extraction failed:', error);

        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
    }
}

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