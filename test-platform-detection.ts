#!/usr/bin/env ts-node

import { ChatOllama } from '@langchain/ollama';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';

const PlatformDetectionSchema = z.object({
    platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'])
        .nullable()
        .describe('The detected social media platform where user wants to share content. Null if no platform could be determined with reasonable confidence'),

    confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score from 0.0 to 1.0 indicating how certain the agent is about the platform detection. Higher values mean more certainty'),

    needsClarification: z.boolean()
        .describe('Whether the user input requires clarification to determine the platform. Set to true when both current message and conversation context are unclear or ambiguous'),

    reasoning: z.string()
        .min(1)
        .describe('Brief explanation of why this platform was chosen or why clarification is needed. Should consider both current message and conversation context'),

    clarificationQuery: z.string()
        .nullable()
        .describe('Specific question to ask the user when clarification is needed. Should be present when needsClarification is true. Example: "Which platform would you like to share this on - Twitter, LinkedIn, or Instagram?"')
});

// TypeScript type for the schema
type PlatformDetectionResponse = z.infer<typeof PlatformDetectionSchema>;

// System prompt V1 - Detailed with comprehensive keywords
const SYSTEM_PROMPT_V1 = `Analyze the user message to detect which social media platform they want.

CONSIDERATIONS:
- USER MIGHT SAY PARTIAL NAMES, ABBREVIATIONS, OR COMMON TERMS
- USER MIGHT USE ARABIC LANGUAGE
- TWITTER MIGHT BE REFERRED TO AS "X"

RULES:
- IGNORE CASE SENSITIVITY WHEN MATCHING PLATFORM NAMES
- MUST SET YOUR CONFIDENCE SCORE BETWEEN 0.0 AND 1.0
- MUST CLARIFY YOUR REASON FOR THE PLATFORM CHOICE
- DONT TAKE GUESSES, IF UNCLEAR, ASK FOR CLARIFICATION
- IF X IS MENTIONED, TREAT IT AS TWITTER
`;

interface TestCase {
    name: string;
    message: string;
    expectedPlatform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | null;
    expectedNeedsClarification: boolean;
    conversationHistory?: { user: string; ai: string }[];
}

const TEST_CASES: TestCase[] = [
    // Clear platform mentions - English
    {
        name: "Direct Twitter mention",
        message: "Create a Twitter post about AI",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false
    },
    {
        name: "LinkedIn explicit mention",
        message: "Write a LinkedIn post about career growth",
        expectedPlatform: "linkedin",
        expectedNeedsClarification: false
    },
    {
        name: "Facebook explicit mention",
        message: "Generate a Facebook post about community events",
        expectedPlatform: "facebook",
        expectedNeedsClarification: false
    },
    {
        name: "Instagram explicit mention",
        message: "Create an Instagram caption for my photo",
        expectedPlatform: "instagram",
        expectedNeedsClarification: false
    },

    // Platform abbreviations
    {
        name: "Twitter abbreviation - X",
        message: "Post this on X",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false
    },
    {
        name: "Facebook abbreviation - FB",
        message: "Share this on FB",
        expectedPlatform: "facebook",
        expectedNeedsClarification: false
    },
    {
        name: "Instagram abbreviation - IG",
        message: "Put this on IG",
        expectedPlatform: "instagram",
        expectedNeedsClarification: false
    },

    // Platform-specific terms
    {
        name: "Tweet mention",
        message: "Write a tweet about technology",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false
    },
    {
        name: "Professional network context",
        message: "Create a professional LinkedIn update",
        expectedPlatform: "linkedin",
        expectedNeedsClarification: false
    },

    // Arabic platform mentions
    {
        name: "Arabic Twitter",
        message: "اكتب تغريدة عن التكنولوجيا",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false
    },
    {
        name: "Arabic LinkedIn",
        message: "أريد منشور للينكد إن عن العمل",
        expectedPlatform: "linkedin",
        expectedNeedsClarification: false
    },
    {
        name: "Arabic Facebook",
        message: "انشر هذا على الفيسبوك",
        expectedPlatform: "facebook",
        expectedNeedsClarification: false
    },
    {
        name: "Arabic Instagram",
        message: "اكتب تعليق للانستغرام",
        expectedPlatform: "instagram",
        expectedNeedsClarification: false
    },

    // Context-based detection with conversation history
    {
        name: "Platform clarification response",
        message: "LinkedIn",
        expectedPlatform: "linkedin",
        expectedNeedsClarification: false,
        conversationHistory: [
            { user: "I want to create a professional post", ai: "Which platform would you like to use?" }
        ]
    },
    {
        name: "Twitter context response",
        message: "Twitter",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false,
        conversationHistory: [
            { user: "Help me create social media content", ai: "What platform would you like to post on?" }
        ]
    },
    {
        name: "Arabic platform response",
        message: "تويتر",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false,
        conversationHistory: [
            { user: "أريد إنشاء منشور", ai: "أي منصة تريد استخدامها؟" }
        ]
    },

    // Partial matches and typos
    {
        name: "Partial Twitter match",
        message: "Create a twit about programming",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false
    },
    {
        name: "Partial LinkedIn match",
        message: "Write something for linke",
        expectedPlatform: "linkedin",
        expectedNeedsClarification: false
    },
    {
        name: "Partial Instagram match",
        message: "Post this on insta",
        expectedPlatform: "instagram",
        expectedNeedsClarification: false
    },

    // Cases requiring clarification
    {
        name: "No platform mentioned",
        message: "Create a social media post about AI",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },
    {
        name: "Generic social media request",
        message: "Help me write a post",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },
    {
        name: "Ambiguous content type",
        message: "Write something about technology",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },
    {
        name: "Question about platforms",
        message: "What platforms do you support?",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },

    // Arabic cases requiring clarification
    {
        name: "Arabic - no platform mentioned",
        message: "اكتب لي منشور عن التكنولوجيا",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },
    {
        name: "Arabic - generic request",
        message: "ساعدني في كتابة منشور",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },

    // Edge cases
    {
        name: "Multiple platforms mentioned",
        message: "Create posts for Twitter and LinkedIn",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },
    {
        name: "Platform in question context",
        message: "What should I post on LinkedIn?",
        expectedPlatform: "linkedin",
        expectedNeedsClarification: false
    },
    {
        name: "Platform comparison",
        message: "Should I use Twitter or LinkedIn for this?",
        expectedPlatform: null,
        expectedNeedsClarification: true
    },

    // Very short responses
    {
        name: "One word platform",
        message: "Facebook",
        expectedPlatform: "facebook",
        expectedNeedsClarification: false
    },
    {
        name: "Single letter abbreviation",
        message: "X",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false
    },
    {
        name: "Emoji with platform",
        message: "Twitter 🐦",
        expectedPlatform: "twitter",
        expectedNeedsClarification: false
    }
];

class PlatformDetectionTester {
    private model: ChatOllama;
    private parser: any;

    constructor(modelName: string = 'mistral:7b') {
        this.model = new ChatOllama({
            baseUrl: 'http://localhost:11434',
            model: modelName,
            temperature: 0.3, // Moderate temperature for balanced detection
            topP: 0.9 // Higher topP for more diverse responses
        });
        this.parser = StructuredOutputParser.fromZodSchema(PlatformDetectionSchema);
    }

    async testPrompt(systemPrompt: string, testCase: TestCase): Promise<{
        result: PlatformDetectionResponse;
        platformCorrect: boolean;
        clarificationCorrect: boolean;
        executionTime: number;
    }> {
        const startTime = Date.now();

        try {
            const messages = this.buildMessages(systemPrompt, testCase);
            const prompt = ChatPromptTemplate.fromMessages(messages);
            const chain = prompt.pipe(this.model).pipe(this.parser);

            const result = await chain.invoke({}) as PlatformDetectionResponse;
            const executionTime = Date.now() - startTime;

            return {
                result,
                platformCorrect: result.platform === testCase.expectedPlatform,
                clarificationCorrect: result.needsClarification === testCase.expectedNeedsClarification,
                executionTime
            };
        } catch (error) {
            console.error(`Error testing case "${testCase.name}":`, error);
            return {
                result: {
                    platform: null,
                    confidence: 0.0,
                    needsClarification: true,
                    reasoning: 'Error occurred during processing',
                    clarificationQuery: 'I had trouble processing your request. Which platform would you like to create content for?'
                },
                platformCorrect: false,
                clarificationCorrect: true,
                executionTime: Date.now() - startTime
            };
        }
    }

    private buildMessages(systemPrompt: string, testCase: TestCase) {
        const messages = [];

        // System message
        messages.push(new SystemMessage(systemPrompt));

        // Add conversation history if provided
        if (testCase.conversationHistory) {
            for (const exchange of testCase.conversationHistory) {
                messages.push(new HumanMessage(exchange.user));
                messages.push(new AIMessage(exchange.ai));
            }
        }

        // Format instructions
        messages.push(new HumanMessage(`<FORMAT_INSTRUCTIONS>\n${this.parser.getFormatInstructions()}\n\nRespond with ONLY the JSON object, no additional text or explanation.</FORMAT_INSTRUCTIONS>`));

        // Current user message
        messages.push(new HumanMessage(testCase.message));

        return messages;
    }

    async runAllTests() {
        console.log('🎯 Platform Detection Prompt Testing');
        console.log('====================================\n');

        const prompts = [
            { name: 'V1 - Detailed', prompt: SYSTEM_PROMPT_V1 },
        ];

        for (const { name, prompt } of prompts) {
            console.log(`\n📋 Testing Prompt: ${name}`);
            console.log('─'.repeat(50));

            let platformCorrect = 0;
            let clarificationCorrect = 0;
            let totalTime = 0;
            const results = [];

            for (const testCase of TEST_CASES) {
                const result = await this.testPrompt(prompt, testCase);
                results.push({ testCase, result });

                if (result.platformCorrect) platformCorrect++;
                if (result.clarificationCorrect) clarificationCorrect++;
                totalTime += result.executionTime;

                const platformStatus = result.platformCorrect ? '✅' : '❌';
                const clarificationStatus = result.clarificationCorrect ? '✅' : '❌';
                const confidenceColor = result.result.confidence > 0.7 ? '🟢' : result.result.confidence > 0.5 ? '🟡' : '🔴';

                console.log(`${platformStatus}${clarificationStatus} ${testCase.name}:`);
                console.log(`   Platform: ${result.result.platform || 'null'} (${confidenceColor}${result.result.confidence.toFixed(2)})`);
                console.log(`   Needs clarification: ${result.result.needsClarification} - ${result.executionTime}ms`);

                if (!result.platformCorrect || !result.clarificationCorrect) {
                    console.log(`   Expected: platform=${testCase.expectedPlatform}, clarification=${testCase.expectedNeedsClarification}`);
                    console.log(`   Reasoning: ${result.result.reasoning}`);
                    if (result.result.clarificationQuery) {
                        console.log(`   Query: ${result.result.clarificationQuery}`);
                    }
                }
                console.log();
            }

            const platformAccuracy = (platformCorrect / TEST_CASES.length) * 100;
            const clarificationAccuracy = (clarificationCorrect / TEST_CASES.length) * 100;
            const overallAccuracy = ((platformCorrect + clarificationCorrect) / (TEST_CASES.length * 2)) * 100;
            const avgTime = totalTime / TEST_CASES.length;

            console.log(`\n📊 Results:`);
            console.log(`   Platform Detection: ${platformCorrect}/${TEST_CASES.length} correct (${platformAccuracy.toFixed(1)}%)`);
            console.log(`   Clarification Logic: ${clarificationCorrect}/${TEST_CASES.length} correct (${clarificationAccuracy.toFixed(1)}%)`);
            console.log(`   Overall Accuracy: ${overallAccuracy.toFixed(1)}%`);
            console.log(`   ⏱️  Average time: ${avgTime.toFixed(0)}ms`);

            // Show failed cases
            const failedCases = results.filter(r => !r.result.platformCorrect || !r.result.clarificationCorrect);
            if (failedCases.length > 0) {
                console.log('\n❌ Failed Cases:');
                failedCases.forEach(({ testCase, result }) => {
                    const issues = [];
                    if (!result.platformCorrect) {
                        issues.push(`platform (expected: ${testCase.expectedPlatform}, got: ${result.result.platform})`);
                    }
                    if (!result.clarificationCorrect) {
                        issues.push(`clarification (expected: ${testCase.expectedNeedsClarification}, got: ${result.result.needsClarification})`);
                    }
                    console.log(`  • ${testCase.name}: ${issues.join(', ')}`);
                });
            }
        }
    }

    async testSingleMessage(message: string, conversationHistory?: { user: string; ai: string }[]) {
        console.log('\n🔍 Testing Single Message');
        console.log('========================');
        console.log(`Message: "${message}"`);
        if (conversationHistory) {
            console.log('Conversation History:');
            conversationHistory.forEach((exchange, i) => {
                console.log(`  ${i + 1}. User: ${exchange.user}`);
                console.log(`     AI: ${exchange.ai}`);
            });
        }
        console.log();

        const testCase: TestCase = {
            name: 'Single Test',
            message,
            expectedPlatform: null,
            expectedNeedsClarification: true,
            conversationHistory
        };

        const prompts = [
            { name: 'V1 - Detailed', prompt: SYSTEM_PROMPT_V1 },
        ];

        for (const { name, prompt } of prompts) {
            const result = await this.testPrompt(prompt, testCase);
            console.log(`${name}:`);
            console.log(`  Platform: ${result.result.platform || 'null'} (confidence: ${result.result.confidence.toFixed(2)})`);
            console.log(`  Needs clarification: ${result.result.needsClarification}`);
            console.log(`  Reasoning: ${result.result.reasoning}`);
            if (result.result.clarificationQuery) {
                console.log(`  Query: ${result.result.clarificationQuery}`);
            }
            console.log(`  Execution time: ${result.executionTime}ms\n`);
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const tester = new PlatformDetectionTester();

    if (args.length > 0) {
        // Test single message
        const message = args.join(' ');
        await tester.testSingleMessage(message);
    } else {
        // Run all tests
        await tester.runAllTests();
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

// Run the main function
main().catch(console.error);