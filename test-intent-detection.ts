#!/usr/bin/env ts-node

import { ChatOllama } from '@langchain/ollama';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';

// Zod schema for structured AI response
const IntentDetectionSchema = z.object({
    intent: z.enum(['social', 'conversation']).describe('The detected user intent'),
    confidence: z.number().min(0.1).max(1.0).describe('Confidence score between 0.1 and 1.0'),
    reasoning: z.string().describe('Brief explanation of why this intent was chosen')
});

type IntentDetectionResponse = z.infer<typeof IntentDetectionSchema>;

// Optimized system prompt for small models like llama3.2:3b
const SYSTEM_PROMPT_V1 = `You are an intent classifier. Classify user messages into exactly 2 categories:

**social**: User wants to create social media content (posts, tweets, updates)
**conversation**: User wants to have a conversation, ask questions, or get information

KEYWORDS:
- Social: create, write, generate, compose, draft, make, post, share, publish, tweet, Twitter, LinkedIn, Facebook, Instagram, اكتب، أنشئ، منشور، تغريدة، نشر، شارك، تويتر، لينكد إن، فيسبوك، انستغرام
- Conversation: what, how, why, when, where, who, which, explain, tell me, clarify, help, hello, hi, thanks, thank you, ما، كيف، لماذا، متى، أين، من، أي، اشرح، أخبرني، وضح، ساعد، مرحبا، شكرا

RULES:
1. Focus on the LATEST message
2. If unclear → choose "conversation"
3. Platform names → likely "social"
4. Questions, greetings, thanks, explanations → likely "conversation"
5. Make sure to always return confidence between 0.1 and 1.0
6. Provide a brief reasoning for your choice

Be concise and accurate.`;

// Even more optimized version for small models
const SYSTEM_PROMPT_V2 = `You are an AI assistant specialized in analyzing user messages to determine their intent. Your role is to classify whether a user wants to create social media content or ask questions.

## Intent Categories:
1. **social**: User wants to create, write, generate, compose, or draft social media content (posts, tweets, LinkedIn updates, etc.)
2. **conversation**: User wants to have a conversation, ask questions, or get information

## Detection Guidelines:

### Social Post Intent Keywords:
- **Creation verbs**: create, write, generate, compose, draft, make, produce
- **Publishing terms**: post, share, publish, tweet, update
- **Platform mentions**: Twitter, LinkedIn, Facebook, Instagram, social media
- **Content types**: post, tweet, update, content, caption

### Conversation Intent Indicators:
- **Question words**: what, how, why, when, where, who, which
- **Information seeking**: explain, tell me, clarify, help me understand
- **Request patterns**: can you, could you, would you, please

### Context-Aware Rules:
1. **Priority to Latest Message**: Focus primarily on the user's most recent message
2. **Platform Context**: If previous messages discuss social platforms and current message mentions a platform → likely "social"
3. **Conversation Flow**: If conversation is about content creation and user provides brief responses → likely "social"
4. **Clarification Responses**: If previous message asked about platform preference and current message contains platform name → "social"

### Confidence Scoring:
- **0.9-1.0**: Clear intent keywords and context
- **0.7-0.8**: Strong indication with good context
- **0.5-0.6**: Moderate indication, some ambiguity
- **0.3-0.4**: Weak indication, high uncertainty

### Default Behavior:
- When unclear or ambiguous → default to "conversation"
- Provide clear reasoning for your decision`;

// Minimal prompt for maximum efficiency
const SYSTEM_PROMPT_V3 = `Intent classifier. Two options:

1. **social**: Create social media content (posts, tweets, updates)
2. **conversation**: Chat, ask questions, or get information

Choose based on user's latest message. If unclear → "conversation".`;

interface TestCase {
    name: string;
    message: string;
    expectedIntent: 'social' | 'conversation';
    conversationHistory?: { user: string; ai: string }[];
}

const TEST_CASES: TestCase[] = [
    // Clear social intent cases
    {
        name: "Direct social request",
        message: "Create a LinkedIn post about AI trends",
        expectedIntent: "social"
    },
    {
        name: "Platform-specific request",
        message: "Write a tweet about machine learning",
        expectedIntent: "social"
    },
    {
        name: "Generate content request",
        message: "Generate a post for Instagram about productivity",
        expectedIntent: "social"
    },
    {
        name: "Platform mention only",
        message: "LinkedIn",
        expectedIntent: "social",
        conversationHistory: [
            { user: "I want to create a post", ai: "Which platform would you like to post on?" }
        ]
    },
    {
        name: "Social with brief response",
        message: "Twitter",
        expectedIntent: "social",
        conversationHistory: [
            { user: "Help me create social media content", ai: "What platform would you like to use?" }
        ]
    },

    // Arabic social intent cases
    {
        name: "Arabic social request",
        message: "اكتب تغريدة عن الذكاء الاصطناعي",
        expectedIntent: "social"
    },
    {
        name: "Arabic LinkedIn request",
        message: "ساعدني في كتابة منشور لينكد إن عن التكنولوجيا",
        expectedIntent: "social"
    },
    {
        name: "Arabic platform mention",
        message: "تويتر",
        expectedIntent: "social",
        conversationHistory: [
            { user: "أريد إنشاء منشور", ai: "أي منصة تريد استخدامها؟" }
        ]
    },
    {
        name: "Arabic create post request",
        message: "أنشئ لي منشور عن البرمجة للفيسبوك",
        expectedIntent: "social"
    },

    // Clear conversation intent cases
    {
        name: "Direct question",
        message: "What are the benefits of AI?",
        expectedIntent: "conversation"
    },
    {
        name: "How question",
        message: "How does machine learning work?",
        expectedIntent: "conversation"
    },
    {
        name: "Explanation request",
        message: "Explain the concept of neural networks",
        expectedIntent: "conversation"
    },
    {
        name: "Information seeking",
        message: "Tell me about blockchain technology",
        expectedIntent: "conversation"
    },
    {
        name: "Help request",
        message: "Help me understand quantum computing",
        expectedIntent: "conversation"
    },

    // Arabic conversation intent cases
    {
        name: "Arabic question",
        message: "ما هي فوائد الذكاء الاصطناعي؟",
        expectedIntent: "conversation"
    },
    {
        name: "Arabic how question",
        message: "كيف يعمل تعلم الآلة؟",
        expectedIntent: "conversation"
    },
    {
        name: "Arabic explanation request",
        message: "اشرح لي مفهوم الشبكات العصبية",
        expectedIntent: "conversation"
    },
    {
        name: "Arabic help request",
        message: "ساعدني في فهم الحوسبة الكمية",
        expectedIntent: "conversation"
    },

    // Edge cases and ambiguous cases
    {
        name: "Ambiguous - should default to conversation",
        message: "AI",
        expectedIntent: "conversation"
    },
    {
        name: "Greeting",
        message: "Hello",
        expectedIntent: "conversation"
    },
    {
        name: "Thank you",
        message: "Thank you",
        expectedIntent: "conversation"
    },
    {
        name: "Platform in question context",
        message: "What can I post on LinkedIn?",
        expectedIntent: "social"
    },

    // Arabic edge cases
    {
        name: "Arabic greeting",
        message: "مرحبا",
        expectedIntent: "conversation"
    },
    {
        name: "Arabic thank you",
        message: "شكرا",
        expectedIntent: "conversation"
    },
    {
        name: "Arabic platform in question",
        message: "ماذا يمكنني نشره على لينكد إن؟",
        expectedIntent: "social"
    }
];

class IntentDetectionTester {
    private model: ChatOllama;
    private parser: any;

    constructor(modelName: string = 'llama3.2:3b') {
        this.model = new ChatOllama({
            baseUrl: 'http://localhost:11434',
            model: modelName,
            temperature: 0.1, // Low temperature for consistent classification
        });
        this.parser = StructuredOutputParser.fromZodSchema(IntentDetectionSchema);
    }

    async testPrompt(systemPrompt: string, testCase: TestCase): Promise<{
        result: any;
        correct: boolean;
        executionTime: number;
    }> {
        const startTime = Date.now();

        try {
            const messages = this.buildMessages(systemPrompt, testCase);
            const prompt = ChatPromptTemplate.fromMessages(messages);
            const chain = prompt.pipe(this.model).pipe(this.parser);

            const result = await chain.invoke({});
            const executionTime = Date.now() - startTime;

            return {
                result,
                correct: (result as any).intent === testCase.expectedIntent,
                executionTime
            };
        } catch (error) {
            console.error(`Error testing case "${testCase.name}":`, error);
            return {
                result: {
                    intent: 'conversation',
                    confidence: 0.1,
                    reasoning: 'Error occurred during processing'
                },
                correct: false,
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
        messages.push(new HumanMessage(`<FORMAT_INSTRUCTIONS>\n${this.parser.getFormatInstructions()}</FORMAT_INSTRUCTIONS>`));

        // Current user message
        messages.push(new HumanMessage(testCase.message));

        return messages;
    }

    async runAllTests() {
        console.log('🧪 Intent Detection Prompt Testing');
        console.log('=====================================\n');

        const prompts = [
            { name: 'V1 - Detailed', prompt: SYSTEM_PROMPT_V1 },
            { name: 'V2 - Optimized', prompt: SYSTEM_PROMPT_V2 },
            { name: 'V3 - Minimal', prompt: SYSTEM_PROMPT_V3 }
        ];

        for (const { name, prompt } of prompts) {
            console.log(`\n📋 Testing Prompt: ${name}`);
            console.log('─'.repeat(50));

            let correct = 0;
            let totalTime = 0;
            const results = [];

            for (const testCase of TEST_CASES) {
                const result = await this.testPrompt(prompt, testCase);
                results.push({ testCase, result });

                if (result.correct) correct++;
                totalTime += result.executionTime;

                const status = result.correct ? '✅' : '❌';
                const confidenceColor = result.result.confidence > 0.7 ? '🟢' : result.result.confidence > 0.5 ? '🟡' : '🔴';

                console.log(`${status} ${testCase.name}: ${result.result.intent} (${confidenceColor}${result.result.confidence.toFixed(2)}) - ${result.executionTime}ms`);
                if (!result.correct) {
                    console.log(`   Expected: ${testCase.expectedIntent}, Got: ${result.result.intent}`);
                    console.log(`   Reasoning: ${result.result.reasoning}`);
                }
            }

            const accuracy = (correct / TEST_CASES.length) * 100;
            const avgTime = totalTime / TEST_CASES.length;

            console.log(`\n📊 Results: ${correct}/${TEST_CASES.length} correct (${accuracy.toFixed(1)}%)`);
            console.log(`⏱️  Average time: ${avgTime.toFixed(0)}ms`);

            // Show failed cases
            const failedCases = results.filter(r => !r.result.correct);
            if (failedCases.length > 0) {
                console.log('\n❌ Failed Cases:');
                failedCases.forEach(({ testCase, result }) => {
                    console.log(`  • ${testCase.name}: Expected ${testCase.expectedIntent}, got ${result.result.intent}`);
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
            expectedIntent: 'conversation', // Default for single tests
            conversationHistory
        };

        const prompts = [
            { name: 'V1 - Detailed', prompt: SYSTEM_PROMPT_V1 },
            { name: 'V2 - Optimized', prompt: SYSTEM_PROMPT_V2 },
            { name: 'V3 - Minimal', prompt: SYSTEM_PROMPT_V3 }
        ];

        for (const { name, prompt } of prompts) {
            const result = await this.testPrompt(prompt, testCase);
            console.log(`${name}: ${result.result.intent} (confidence: ${result.result.confidence.toFixed(2)}) - ${result.executionTime}ms`);
            console.log(`  Reasoning: ${result.result.reasoning}`);
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const tester = new IntentDetectionTester();

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